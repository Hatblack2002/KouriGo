/**
 * Configuración compartida de las Edge Functions de KouriGo (Etapa 3).
 *
 * Las credenciales llegan SOLO del entorno de ejecución (secretos de la
 * función o del workflow); nunca se leen del cuerpo de la solicitud ni del
 * repositorio. La clave service_role solo se usa para operaciones
 * verdaderamente privilegiadas (ver docs/decisions/ADR-0005-edge-functions.md):
 * invocar el RPC de despacho, registrar en audit_logs y firmar documentos
 * KYC del bucket privado.
 */

/** Error con estado HTTP asociado; se traduce a una respuesta JSON limpia. */
export class ErrorHttp extends Error {
  readonly estado: number;

  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.name = "ErrorHttp";
    this.estado = estado;
  }
}

export interface Entorno {
  /** URL base del proyecto Supabase, sin barra final. */
  readonly url: string;
  readonly anonKey: string;
  readonly serviceKey: string;
}

export function leerEntorno(): Entorno {
  const url = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anonKey || !serviceKey) {
    throw new ErrorHttp(
      500,
      "Faltan las variables de entorno SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return { url: url.replace(/\/+$/, ""), anonKey, serviceKey };
}
