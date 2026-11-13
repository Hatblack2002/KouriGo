/**
 * Cliente mínimo de PostgREST para las Edge Functions de la Etapa 3.
 *
 * Sin dependencias externas: usa `fetch` con la clave de la sesión del
 * llamador (sus operaciones pasan por RLS y los triggers ven su identidad)
 * o con la clave service_role (solo para lo privilegiado: RPC de despacho,
 * audit_logs y firma de documentos). Los errores de PostgREST, incluidos
 * los mensajes de los triggers, se traducen a ErrorHttp con su estado.
 */
import type { Entorno } from "./config.ts";
import { ErrorHttp } from "./config.ts";

export interface CredencialRest {
  /** JWT de la sesión verificada; omítelo cuando uses service_role. */
  readonly jwt?: string;
  /** Usa la clave service_role en lugar de la sesión del llamador. */
  readonly servicio?: boolean;
}

interface ErrorPostgrest {
  readonly message?: string;
  readonly details?: string;
  readonly hint?: string;
}

export async function rest<T>(
  entorno: Entorno,
  metodo: "GET" | "POST" | "PATCH" | "DELETE",
  ruta: string,
  cuerpo: unknown,
  credencial: CredencialRest = {},
): Promise<T> {
  const clave = credencial.servicio
    ? entorno.serviceKey
    : (credencial.jwt ?? entorno.anonKey);
  const respuesta = await fetch(`${entorno.url}${ruta}`, {
    method: metodo,
    headers: {
      "apikey": clave,
      "Authorization": `Bearer ${clave}`,
      "Content-Type": "application/json",
      ...(metodo !== "GET" ? { "Prefer": "return=representation" } : {}),
    },
    body: metodo === "GET" || cuerpo === null ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  let datos: unknown = null;
  if (texto.length > 0) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }
  if (!respuesta.ok) {
    const error = (datos ?? {}) as ErrorPostgrest;
    throw new ErrorHttp(
      respuesta.status,
      error.message ?? "La operación en el backend no se pudo completar.",
    );
  }
  return datos as T;
}
