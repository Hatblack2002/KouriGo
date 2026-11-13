/**
 * Edge Function `transicion-pedido` (Etapa 3): transiciones de estado de
 * pedidos con el actor determinado SIEMPRE en el servidor.
 *
 * Entrada: POST {pedido_id: uuid, estado_destino: string, motivo?: string}.
 * Salida: 200 {pedido_id, de, a, actor} o error JSON con estado 4xx/5xx.
 *
 * El motivo es OBLIGATORIO cuando el actor es administrador y el par de
 * estados es una corrección administrativa (los pares que solo el rol
 * administrador puede aplicar: cancelaciones justificadas y resolución
 * de incidencias; README sección 12: «permiso, motivo y registro de
 * auditoría»). El motivo queda en audit_logs con la acción
 * `transicion_administrativa`, sin datos personales.
 *
 * El actor se resuelve desde el JWT verificado y los datos del backend
 * (rol administrador, cliente propietario, repartidor aprobado con
 * asignación); nunca desde un campo del cuerpo. La matriz local valida el
 * par antes de tocar el backend y el trigger `validar_transicion_pedido`
 * vuelve a imponerla con la sesión real, además de registrar el evento.
 * Ver docs/decisions/ADR-0005-edge-functions.md.
 */
import { esAdministrador, verificarJwt } from "../_shared/auth.ts";
import type { Entorno } from "../_shared/config.ts";
import { ErrorHttp, leerEntorno } from "../_shared/config.ts";
import {
  esCorreccionAdministrativa,
  esEstadoPedido,
  explicarTransicionInvalida,
  esTransicionValida,
  type Actor,
} from "../_shared/dominio.ts";
import {
  cadenaOpcional,
  exigirMetodo,
  exigirUuid,
  leerCuerpoJson,
  respuestaError,
  respuestaJson,
} from "../_shared/http.ts";
import { registrarAuditoria } from "../_shared/auditoria.ts";
import { rest } from "../_shared/rest.ts";
import type { SesionLlamador } from "../_shared/auth.ts";

interface FilaPedido {
  readonly id: string;
  readonly client_id: string;
  readonly status: string;
}

interface FilaPerfilCourier {
  readonly verification_status: string;
  readonly account_active: boolean;
}

async function resolverActor(
  entorno: Entorno,
  sesion: SesionLlamador,
  pedido: FilaPedido,
): Promise<Actor> {
  if (await esAdministrador(entorno, sesion)) {
    return "administrador";
  }
  if (pedido.client_id === sesion.usuarioId) {
    return "cliente";
  }
  const perfiles = await rest<FilaPerfilCourier[]>(
    entorno,
    "GET",
    `/rest/v1/courier_profiles?user_id=eq.${sesion.usuarioId}&select=verification_status,account_active`,
    null,
    { jwt: sesion.jwt },
  );
  const operativo = Array.isArray(perfiles) && perfiles.length === 1 &&
    perfiles[0].verification_status === "approved" &&
    perfiles[0].account_active === true;
  if (operativo) {
    const asignaciones = await rest<{ id: string }[]>(
      entorno,
      "GET",
      `/rest/v1/order_assignments?order_id=eq.${pedido.id}&courier_user_id=eq.${sesion.usuarioId}&select=id`,
      null,
      { jwt: sesion.jwt },
    );
    if (Array.isArray(asignaciones) && asignaciones.length > 0) {
      return "repartidor";
    }
  }
  throw new ErrorHttp(403, "El usuario no tiene permiso para modificar este pedido.");
}

export async function procesar(req: Request): Promise<Response> {
  try {
    exigirMetodo(req, "POST");
    const entorno = leerEntorno();
    const sesion = await verificarJwt(entorno, req);
    const cuerpo = await leerCuerpoJson(req);
    const pedidoId = exigirUuid(cuerpo, "pedido_id");
    const destino = cuerpo["estado_destino"];
    if (!esEstadoPedido(destino)) {
      throw new ErrorHttp(400, "El campo estado_destino no es un estado válido.");
    }
    const motivo = cadenaOpcional(cuerpo, "motivo", 500);

    const filas = await rest<FilaPedido[]>(
      entorno,
      "GET",
      `/rest/v1/orders?id=eq.${pedidoId}&select=id,client_id,status`,
      null,
      { jwt: sesion.jwt },
    );
    if (!Array.isArray(filas) || filas.length !== 1) {
      throw new ErrorHttp(404, "El pedido no existe o no es visible para tu sesión.");
    }
    const pedido = filas[0];
    if (!esEstadoPedido(pedido.status)) {
      throw new ErrorHttp(500, "El pedido tiene un estado desconocido.");
    }
    const actor = await resolverActor(entorno, sesion, pedido);
    if (!esTransicionValida(pedido.status, destino, actor)) {
      throw new ErrorHttp(
        422,
        explicarTransicionInvalida(pedido.status, destino, actor),
      );
    }

    if (actor === "administrador" && esCorreccionAdministrativa(pedido.status, destino) &&
      motivo === null) {
      throw new ErrorHttp(
        422,
        "La corrección administrativa exige un motivo registrado (README sección 12).",
      );
    }

    const actualizados = await rest<FilaPedido[]>(
      entorno,
      "PATCH",
      `/rest/v1/orders?id=eq.${pedidoId}&select=id,status`,
      { status: destino },
      { jwt: sesion.jwt },
    );
    if (!Array.isArray(actualizados) || actualizados.length !== 1) {
      throw new ErrorHttp(422, "La transición del pedido no se pudo aplicar.");
    }
    if (actor === "administrador" && motivo !== null) {
      await registrarAuditoria(entorno, {
        actorId: sesion.usuarioId,
        accion: "transicion_administrativa",
        tipoRecurso: "order",
        idRecurso: pedidoId,
        metadatos: { motivo, de: pedido.status, a: destino },
      });
    }
    return respuestaJson(200, {
      pedido_id: actualizados[0].id,
      de: pedido.status,
      a: destino,
      actor,
    });
  } catch (error) {
    return respuestaError(error);
  }
}

if (import.meta.main) {
  Deno.serve((req: Request) => procesar(req));
}
