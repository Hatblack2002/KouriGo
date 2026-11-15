/**
 * Edge Function `subir-imagen` — almacenamiento de imágenes de perfil y de
 * catálogo con el proveedor externo INVISIBLE para el usuario (principio de
 * camuflaje definido en docs/product/perfiles-imagenes-verificacion.md).
 *
 * La APK y la consola admin jamás hablan con el proveedor ni contienen
 * credenciales: toda subida pasa por esta función, que autentica la sesión
 * contra Supabase Auth, aplica las reglas por contexto y firma la subida con
 * el secreto del runtime (CLOUDINARY_URL, formato cloudinary://key:secret@cloud).
 * El cliente solo recibe una referencia interna (public_id) y la URL para
 * renderizar la imagen; ninguna marca del proveedor aparece en la interfaz.
 *
 * Reglas por contexto:
 * - "avatar": cualquier usuario autenticado sube SOLO su propia foto de
 *   perfil (la identidad viene del JWT, nunca del cuerpo). Carpeta
 *   kourigo/avatares/<user_id>, public_id fijo por usuario con
 *   sobrescritura, máximo 2 MB.
 * - "catalogo": SOLO administrador (rol admin activo en user_roles).
 *   Carpeta kourigo/catalogo/<categoria> con categoría de lista blanca,
 *   public_id nuevo por imagen, máximo 5 MB.
 *
 * Los documentos de identidad de repartidores NUNCA pasan por aquí: usan el
 * bucket privado courier-identity-private de Supabase (ADR-0004).
 *
 * Entrada: POST {contexto: "avatar"|"catalogo", archivo: "data:image/jpeg;base64,...", categoria?: string}.
 * Salida: 200 {public_id, url} o error JSON en español.
 * Ver docs/decisions/ADR-0005-edge-functions.md.
 */
import { esAdministrador, verificarJwt } from "../_shared/auth.ts";
import type { Entorno } from "../_shared/config.ts";
import { ErrorHttp, leerEntorno } from "../_shared/config.ts";
import {
  exigirMetodo,
  leerCuerpoJson,
  respuestaError,
  respuestaJson,
} from "../_shared/http.ts";
import { registrarAuditoria } from "../_shared/auditoria.ts";

const PREFIJOS_ADMITIDOS = [
  "data:image/jpeg;base64,",
  "data:image/png;base64,",
  "data:image/webp;base64,",
] as const;

const CATEGORIAS_CATALOGO = [
  "cat_electronique",
  "cat_maison",
  "cat_mode",
  "cat_plus",
] as const;

const MAX_BASE64_AVATAR = 2_800_000; // ≈ 2 MB decodificados
const MAX_BASE64_CATALOGO = 7_000_000; // ≈ 5 MB decodificados

interface CredencialesImagen {
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly cloud: string;
}

function leerCredencialesImagen(): CredencialesImagen {
  const cruda = (Deno.env.get("CLOUDINARY_URL") ?? "").trim();
  const coincidencia = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(cruda);
  if (!coincidencia) {
    throw new ErrorHttp(
      500,
      "El servicio de imágenes no está configurado en el runtime.",
    );
  }
  return {
    apiKey: coincidencia[1],
    apiSecret: coincidencia[2],
    cloud: coincidencia[3],
  };
}

async function firmaSha1(
  params: Record<string, string>,
  secreto: string,
): Promise<string> {
  const canonico =
    Object.keys(params)
      .sort()
      .map((clave) => `${clave}=${params[clave]}`)
      .join("&") + secreto;
  const digerido = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(canonico),
  );
  return Array.from(new Uint8Array(digerido))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function leerArchivo(cuerpo: Record<string, unknown>, maximo: number): string {
  const archivo = cuerpo["archivo"];
  if (typeof archivo !== "string" || archivo.length === 0) {
    throw new ErrorHttp(400, "El campo archivo es obligatorio.");
  }
  const admitido = PREFIJOS_ADMITIDOS.some((prefijo) => archivo.startsWith(prefijo));
  if (!admitido) {
    throw new ErrorHttp(400, "Formato no admitido: solo JPEG, PNG o WebP.");
  }
  if (archivo.length > maximo) {
    throw new ErrorHttp(413, "La imagen supera el tamaño máximo permitido.");
  }
  return archivo;
}

interface ResultadoSubida {
  readonly public_id?: string;
  readonly secure_url?: string;
}

async function enviar(
  credenciales: CredencialesImagen,
  params: Record<string, string>,
  firma: string,
  archivo: string,
): Promise<void> {
  const formulario = new FormData();
  formulario.append("file", archivo);
  formulario.append("api_key", credenciales.apiKey);
  for (const [clave, valor] of Object.entries(params)) {
    formulario.append(clave, valor);
  }
  formulario.append("signature", firma);
  let respuesta: Response;
  try {
    respuesta = await fetch(
      `https://api.cloudinary.com/v1_1/${credenciales.cloud}/image/upload`,
      { method: "POST", body: formulario },
    );
  } catch {
    throw new ErrorHttp(502, "El servicio de imágenes no está disponible.");
  }
  if (!respuesta.ok) {
    console.error("[kourigo] rechazo del servicio de imágenes:", respuesta.status);
    throw new ErrorHttp(502, "El servicio de imágenes no aceptó el archivo.");
  }
  const resultado = (await respuesta.json()) as ResultadoSubida;
  if (
    !resultado ||
    typeof resultado.public_id !== "string" ||
    resultado.public_id.length === 0 ||
    typeof resultado.secure_url !== "string"
  ) {
    throw new ErrorHttp(502, "El servicio de imágenes no devolvió la referencia.");
  }
}

export async function procesar(req: Request): Promise<Response> {
  try {
    exigirMetodo(req, "POST");
    const entorno: Entorno = leerEntorno();
    const credenciales = leerCredencialesImagen();
    const sesion = await verificarJwt(entorno, req);
    const cuerpo = await leerCuerpoJson(req);

    const contexto = cuerpo["contexto"];
    if (contexto !== "avatar" && contexto !== "catalogo") {
      throw new ErrorHttp(
        400,
        'El campo contexto debe ser "avatar" o "catalogo".',
      );
    }

    let carpeta: string;
    let publicId: string;
    let accionAuditoria: string;

    if (contexto === "avatar") {
      const archivo = leerArchivo(cuerpo, MAX_BASE64_AVATAR);
      carpeta = `kourigo/avatares/${sesion.usuarioId}`;
      publicId = `av-${sesion.usuarioId}`;
      const marcaTiempo = Math.floor(Date.now() / 1000).toString();
      const params = {
        folder: carpeta,
        overwrite: "true",
        public_id: publicId,
        timestamp: marcaTiempo,
      };
      const firma = await firmaSha1(params, credenciales.apiSecret);
      await enviar(credenciales, params, firma, archivo);
      accionAuditoria = "avatar_actualizado";
    } else {
      if (!(await esAdministrador(entorno, sesion))) {
        throw new ErrorHttp(
          403,
          "Solo un administrador puede agregar imágenes al catálogo.",
        );
      }
      const categoria = cuerpo["categoria"];
      if (
        typeof categoria !== "string" ||
        !(CATEGORIAS_CATALOGO as readonly string[]).includes(categoria)
      ) {
        throw new ErrorHttp(
          400,
          `El campo categoria debe ser una de: ${CATEGORIAS_CATALOGO.join(", ")}.`,
        );
      }
      const archivo = leerArchivo(cuerpo, MAX_BASE64_CATALOGO);
      carpeta = `kourigo/catalogo/${categoria}`;
      publicId = `pro-${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
      const marcaTiempo = Math.floor(Date.now() / 1000).toString();
      const params = {
        folder: carpeta,
        public_id: publicId,
        timestamp: marcaTiempo,
      };
      const firma = await firmaSha1(params, credenciales.apiSecret);
      await enviar(credenciales, params, firma, archivo);
      accionAuditoria = "imagen_catalogo_subida";
    }

    await registrarAuditoria(entorno, {
      actorId: sesion.usuarioId,
      accion: accionAuditoria,
      tipoRecurso: "imagen",
      idRecurso: publicId,
      metadatos: { contexto },
    });

    // La URL de renderizado aplica las transformaciones fijas en la entrega;
    // el proveedor queda camuflado: la interfaz nunca muestra ni nombra la
    // cadena completa.
    const url = `https://res.cloudinary.com/${credenciales.cloud}/image/upload/f_auto,q_auto/${carpeta}/${publicId}`;

    return respuestaJson(200, { public_id: publicId, url });
  } catch (error) {
    return respuestaError(error);
  }
}

if (import.meta.main) {
  Deno.serve((req: Request) => procesar(req));
}
