/**
 * Edge Function `despachar-pedido` (Etapa 3): oferta de un pedido pending
 * a un repartidor aprobado. Operación privilegiada de la administración.
 *
 * Entrada: POST {pedido_id: uuid, repartidor_id: uuid}.
 * Salida: 200 {pedido_id, repartidor_id, asignacion_id, estado: "offered"}
 * o error JSON con estado 4xx/5xx.
 *
 * Solo un administrador con sesión real puede invocarla (rol comprobado
 * contra user_roles con el JWT del llamador). La operación atómica vive en
 * el RPC `public.despachar_pedido` (migración 0004), ejecutable SOLO por
 * service_role: crear la asignación, mover el pedido a offered y registrar
 * auditoría ocurren en una única transacción. La identidad del
 * administrador se pasa ya verificada; el RPC nunca la acepta del cliente
 * sin pasar por esta función.
 * Ver docs/decisions/ADR-0005-edge-functions.md.
 */
import { exigirAdministrador, verificarJwt } from "../_shared/auth.ts";
import { ErrorHttp, leerEntorno } from "../_shared/config.ts";
import {
  exigirMetodo,
  exigirUuid,
  leerCuerpoJson,
  respuestaError,
  respuestaJson,
} from "../_shared/http.ts";
import { registrarAuditoria } from "../_shared/auditoria.ts";
import { rest } from "../_shared/rest.ts";

export async function procesar(req: Request): Promise<Response> {
  try {
    exigirMetodo(req, "POST");
    const entorno = leerEntorno();
    const sesion = await verificarJwt(entorno, req);
    await exigirAdministrador(entorno, sesion);
    const cuerpo = await leerCuerpoJson(req);
    const pedidoId = exigirUuid(cuerpo, "pedido_id");
    const repartidorId = exigirUuid(cuerpo, "repartidor_id");

    const asignacionId = await rest<string>(
      entorno,
      "POST",
      "/rest/v1/rpc/despachar_pedido",
      {
        id_pedido: pedidoId,
        id_repartidor: repartidorId,
        id_administrador: sesion.usuarioId,
      },
      { servicio: true },
    );
    if (typeof asignacionId !== "string" || asignacionId.length === 0) {
      throw new ErrorHttp(422, "El despacho no devolvió la asignación creada.");
    }

    await registrarAuditoria(entorno, {
      actorId: sesion.usuarioId,
      accion: "despachar_pedido_edge_function",
      tipoRecurso: "order",
      idRecurso: pedidoId,
      metadatos: {
        assignment_id: asignacionId,
        funcion: "despachar-pedido",
      },
    });

    return respuestaJson(200, {
      pedido_id: pedidoId,
      repartidor_id: repartidorId,
      asignacion_id: asignacionId,
      estado: "offered",
    });
  } catch (error) {
    return respuestaError(error);
  }
}

if (import.meta.main) {
  Deno.serve((req: Request) => procesar(req));
}
