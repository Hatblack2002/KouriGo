/**
 * Edge Function `documento-firmado` (Etapa 3): emisión de signed URLs de
 * corta duración para revisar documentos KYC del bucket privado
 * `courier-identity-private` (docs/operations/
 * courier-identity-verification.md, sección 7; ADR-0004 asigna esta
 * emisión a la Etapa 3).
 *
 * Entrada: POST {documento_id: uuid}.
 * Salida: 200 {documento_id, url_firmada, expira_en_segundos} o error JSON.
 *
 * Solo un administrador con sesión real puede invocarla. La firma se hace
 * con la clave service_role tras comprobar, con el JWT del administrador,
 * que el documento existe, pertenece al bucket privado y su ruta conserva
 * la convención de carpeta por usuario (primera carpeta = titular del
 * documento). Cada emisión se registra en audit_logs sin datos personales.
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

const BUCKET_PRIVADO = "courier-identity-private";
const EXPIRACION_SEGUNDOS = 300;

interface FilaDocumento {
  readonly id: string;
  readonly case_id: string;
  readonly courier_user_id: string;
  readonly storage_bucket: string;
  readonly storage_path: string;
}

interface RespuestaFirma {
  readonly signedURL?: string;
}

export async function procesar(req: Request): Promise<Response> {
  try {
    exigirMetodo(req, "POST");
    const entorno = leerEntorno();
    const sesion = await verificarJwt(entorno, req);
    await exigirAdministrador(entorno, sesion);
    const cuerpo = await leerCuerpoJson(req);
    const documentoId = exigirUuid(cuerpo, "documento_id");

    const filas = await rest<FilaDocumento[]>(
      entorno,
      "GET",
      `/rest/v1/courier_verification_documents?id=eq.${documentoId}&select=id,case_id,courier_user_id,storage_bucket,storage_path`,
      null,
      { jwt: sesion.jwt },
    );
    if (!Array.isArray(filas) || filas.length !== 1) {
      throw new ErrorHttp(404, "El documento no existe o no es visible para tu sesión.");
    }
    const documento = filas[0];
    if (
      documento.storage_bucket !== BUCKET_PRIVADO ||
      !documento.storage_path.startsWith(`${documento.courier_user_id}/`)
    ) {
      throw new ErrorHttp(
        422,
        "El documento no cumple la convención del bucket privado de identidad.",
      );
    }

    const firma = await rest<RespuestaFirma>(
      entorno,
      "POST",
      `/storage/v1/object/sign/${documento.storage_bucket}/${documento.storage_path}`,
      { expiresIn: EXPIRACION_SEGUNDOS },
      { servicio: true },
    );
    if (!firma || typeof firma.signedURL !== "string" || firma.signedURL.length === 0) {
      throw new ErrorHttp(502, "El servicio de almacenamiento no devolvió la URL firmada.");
    }
    const urlFirmada = `${entorno.url}/storage/v1${firma.signedURL}`;

    await registrarAuditoria(entorno, {
      actorId: sesion.usuarioId,
      accion: "documento_firmado",
      tipoRecurso: "courier_verification_document",
      idRecurso: documentoId,
      metadatos: {
        case_id: documento.case_id,
        expiracion_segundos: EXPIRACION_SEGUNDOS,
      },
    });

    return respuestaJson(200, {
      documento_id: documentoId,
      url_firmada: urlFirmada,
      expira_en_segundos: EXPIRACION_SEGUNDOS,
    });
  } catch (error) {
    return respuestaError(error);
  }
}

if (import.meta.main) {
  Deno.serve((req: Request) => procesar(req));
}
