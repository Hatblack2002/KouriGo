/**
 * Edge Function `decision-verificacion` (Etapa 3): decisiones del flujo de
 * revisión del expediente de repartidores y revisión de documentos.
 * Operación privilegiada de la administración.
 *
 * Entrada: POST {caso_id: uuid, decision: string, motivo?, metodo?,
 *               documento_id?, estado_revision?, notas?}.
 *   - decision ∈ DECISIONES_EXPEDIENTE (iniciar_revision, pedir_informacion,
 *     programar_verificacion, aprobar, rechazar, suspender,
 *     solicitar_reverificacion, expirar).
 *   - decision = "revision_documento" revisa un documento concreto:
 *     {caso_id, decision: "revision_documento", documento_id,
 *      estado_revision: "accepted"|"rejected", notas?}.
 * Salida: 200 con el resultado o error JSON con estado 4xx/5xx.
 *
 * Solo un administrador con sesión real puede invocarla. Las mutaciones se
 * aplican con el JWT del propio administrador: las políticas RLS de la
 * administración y el trigger `validar_transicion_expediente` imponen los
 * pares, el motivo fresco (migración 0003) y el método de comprobación, y
 * los eventos del expediente quedan con el actor real (auth.uid()).
 * Ver docs/decisions/ADR-0005-edge-functions.md.
 */
import { exigirAdministrador, verificarJwt } from "../_shared/auth.ts";
import type { SesionLlamador } from "../_shared/auth.ts";
import type { Entorno } from "../_shared/config.ts";
import { ErrorHttp, leerEntorno } from "../_shared/config.ts";
import {
  DECISIONES_EXPEDIENTE,
  esDecisionExpediente,
  esEstadoExpediente,
  METODOS_VERIFICACION,
  parAdminExpedientePermitido,
} from "../_shared/dominio.ts";
import {
  cadenaOpcional,
  exigirCadena,
  exigirMetodo,
  exigirUuid,
  leerCuerpoJson,
  respuestaError,
  respuestaJson,
} from "../_shared/http.ts";
import { registrarAuditoria } from "../_shared/auditoria.ts";
import { rest } from "../_shared/rest.ts";

interface FilaCaso {
  readonly id: string;
  readonly status: string;
}

const ESTADOS_REVISION_DOCUMENTO = ["accepted", "rejected"] as const;

async function revisarDocumento(
  entorno: Entorno,
  sesion: SesionLlamador,
  casoId: string,
  documentoId: string,
  estadoRevision: (typeof ESTADOS_REVISION_DOCUMENTO)[number],
  notas: string | null,
): Promise<Response> {
  const documentos = await rest<{ id: string; case_id: string }[]>(
    entorno,
    "GET",
    `/rest/v1/courier_verification_documents?id=eq.${documentoId}&case_id=eq.${casoId}&select=id,case_id`,
    null,
    { jwt: sesion.jwt },
  );
  if (!Array.isArray(documentos) || documentos.length !== 1) {
    throw new ErrorHttp(404, "El documento no existe en el expediente indicado.");
  }
  const actualizados = await rest<{ id: string; review_status: string }[]>(
    entorno,
    "PATCH",
    `/rest/v1/courier_verification_documents?id=eq.${documentoId}&select=id,review_status`,
    {
      review_status: estadoRevision,
      review_notes: notas,
    },
    { jwt: sesion.jwt },
  );
  if (!Array.isArray(actualizados) || actualizados.length !== 1) {
    throw new ErrorHttp(422, "La revisión del documento no se pudo aplicar.");
  }
  await registrarAuditoria(entorno, {
    actorId: sesion.usuarioId,
    accion: "revision_documento_expediente",
    tipoRecurso: "courier_verification_document",
    idRecurso: documentoId,
    metadatos: { case_id: casoId, review_status: estadoRevision },
  });
  return respuestaJson(200, {
    documento_id: actualizados[0].id,
    review_status: actualizados[0].review_status,
  });
}

export async function procesar(req: Request): Promise<Response> {
  try {
    exigirMetodo(req, "POST");
    const entorno = leerEntorno();
    const sesion = await verificarJwt(entorno, req);
    await exigirAdministrador(entorno, sesion);
    const cuerpo = await leerCuerpoJson(req);
    const casoId = exigirUuid(cuerpo, "caso_id");
    const decision = cuerpo["decision"];
    if (!esDecisionExpediente(decision)) {
      throw new ErrorHttp(400, "El campo decision no es una decisión válida.");
    }

    const filas = await rest<FilaCaso[]>(
      entorno,
      "GET",
      `/rest/v1/courier_verification_cases?id=eq.${casoId}&select=id,status`,
      null,
      { jwt: sesion.jwt },
    );
    if (!Array.isArray(filas) || filas.length !== 1) {
      throw new ErrorHttp(404, "El expediente no existe o no es visible para tu sesión.");
    }
    const caso = filas[0];

    if (decision === "revision_documento") {
      const documentoId = exigirUuid(cuerpo, "documento_id");
      const estado = exigirCadena(cuerpo, "estado_revision", 20);
      if (!ESTADOS_REVISION_DOCUMENTO.includes(
        estado as (typeof ESTADOS_REVISION_DOCUMENTO)[number],
      )) {
        throw new ErrorHttp(400, "El campo estado_revision debe ser accepted o rejected.");
      }
      const notas = cadenaOpcional(cuerpo, "notas", 500);
      return await revisarDocumento(
        entorno,
        sesion,
        casoId,
        documentoId,
        estado as (typeof ESTADOS_REVISION_DOCUMENTO)[number],
        notas,
      );
    }

    const datos = DECISIONES_EXPEDIENTE[decision];
    if (!esEstadoExpediente(caso.status)) {
      throw new ErrorHttp(500, "El expediente tiene un estado desconocido.");
    }
    if (!parAdminExpedientePermitido(caso.status, datos.estado)) {
      throw new ErrorHttp(
        422,
        `La decisión ${decision} no aplica a un expediente en estado ${caso.status}.`,
      );
    }
    const motivo = cadenaOpcional(cuerpo, "motivo", 1000);
    const metodo = cadenaOpcional(cuerpo, "metodo", 30);
    if (datos.requiereMotivo && motivo === null) {
      throw new ErrorHttp(422, "La decisión del expediente exige un motivo registrado.");
    }
    if (datos.requiereMetodo && metodo === null) {
      throw new ErrorHttp(
        422,
        "La decisión del expediente exige registrar el método de verificación.",
      );
    }
    if (metodo !== null && !(METODOS_VERIFICACION as readonly string[]).includes(metodo)) {
      throw new ErrorHttp(400, "El campo metodo no es un método de verificación válido.");
    }

    const cambio: Record<string, unknown> = { status: datos.estado };
    if (motivo !== null) {
      cambio["decision_reason"] = motivo;
    }
    if (metodo !== null) {
      cambio["verification_method"] = metodo;
    }
    const actualizados = await rest<FilaCaso[]>(
      entorno,
      "PATCH",
      `/rest/v1/courier_verification_cases?id=eq.${casoId}&select=id,status`,
      cambio,
      { jwt: sesion.jwt },
    );
    if (!Array.isArray(actualizados) || actualizados.length !== 1) {
      throw new ErrorHttp(422, "La decisión del expediente no se pudo aplicar.");
    }

    await registrarAuditoria(entorno, {
      actorId: sesion.usuarioId,
      accion: `decision_expediente:${decision}`,
      tipoRecurso: "courier_verification_case",
      idRecurso: casoId,
      metadatos: { de: caso.status, a: datos.estado },
    });

    return respuestaJson(200, {
      caso_id: actualizados[0].id,
      decision,
      de: caso.status,
      a: actualizados[0].status,
    });
  } catch (error) {
    return respuestaError(error);
  }
}

if (import.meta.main) {
  Deno.serve((req: Request) => procesar(req));
}
