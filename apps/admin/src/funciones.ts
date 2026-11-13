/**
 * Invocación de las Edge Functions del proyecto (ADR-0005) desde la
 * consola administrativa. Las operaciones privilegiadas (transiciones,
 * despacho, decisiones del expediente, documentos firmados) pasan SIEMPRE
 * por las funciones del runtime: el actor lo determina el servidor a
 * partir del JWT; la consola nunca envía su rol ni usa la clave
 * service-role. La respuesta de error es JSON con la clave `error`
 * (sección compartida _shared/http.ts).
 */
import type { ConfiguracionPublica } from "./configuracion";

export interface ResultadoFuncion<T> {
  readonly estado: number;
  readonly ok: boolean;
  readonly datos: T | null;
  readonly mensajeError: string | null;
}

export interface RespuestaTransicion {
  readonly pedido_id: string;
  readonly de: string;
  readonly a: string;
  readonly actor: string;
}

export interface RespuestaDespacho {
  readonly pedido_id: string;
  readonly repartidor_id: string;
  readonly asignacion_id: string;
  readonly estado: string;
}

export interface RespuestaDecision {
  readonly caso_id: string;
  readonly decision: string;
  readonly estado: string;
}

export interface RespuestaUrlFirmada {
  readonly documento_id: string;
  readonly url_firmada: string;
  readonly expira_en_segundos: number;
}

/**
 * Interpreta el cuerpo textual de una respuesta de Edge Function.
 * Función pura: la prueba unitaria la cubre sin red.
 */
export function interpretarCuerpo<T>(estado: number, texto: string): ResultadoFuncion<T> {
  let cuerpo: unknown = null;
  if (texto.length > 0) {
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      cuerpo = texto;
    }
  }
  if (estado >= 200 && estado < 300 && cuerpo !== null && typeof cuerpo === "object") {
    return { estado, ok: true, datos: cuerpo as T, mensajeError: null };
  }
  const mensaje =
    cuerpo !== null && typeof cuerpo === "object" && "error" in cuerpo
      ? String((cuerpo as { error: unknown }).error)
      : typeof cuerpo === "string" && cuerpo.length > 0
        ? cuerpo
        : `La función respondió con el estado ${estado}.`;
  return { estado, ok: false, datos: null, mensajeError: mensaje };
}

/**
 * Reintenta la llamada ante fallos de red transitorios. Las respuestas
 * HTTP se devuelven tal cual: el reintento solo cubre fallos de conexión,
 * no errores del backend.
 */
async function conReintentos<T>(operacion: () => Promise<T>, intentos = 3): Promise<T> {
  let ultimoError: unknown = null;
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      return await operacion();
    } catch (error) {
      ultimoError = error;
      if (intento < intentos) {
        await new Promise((resolver) => setTimeout(resolver, 1500 * intento));
      }
    }
  }
  throw ultimoError;
}

export async function invocarFuncion<T>(
  configuracion: ConfiguracionPublica,
  accessToken: string,
  nombre: string,
  cuerpo: Record<string, unknown>,
): Promise<ResultadoFuncion<T>> {
  try {
    const respuesta = await conReintentos(() =>
      fetch(`${configuracion.supabaseUrl}/functions/v1/${nombre}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: configuracion.supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cuerpo),
      }),
    );
    const texto = await respuesta.text();
    return interpretarCuerpo<T>(respuesta.status, texto);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Fallo de red desconocido.";
    return {
      estado: 0,
      ok: false,
      datos: null,
      mensajeError: `No se pudo contactar con el backend: ${mensaje}`,
    };
  }
}
