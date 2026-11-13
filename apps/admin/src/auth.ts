/**
 * Autenticación real de la consola administrativa contra Supabase Auth
 * (ADR-0001), con la regla dura del README sección 12: NO existe registro
 * público de administradores; las cuentas las crea o invita el
 * administrador principal (Supabase Admin API / panel). La consola solo
 * inicia sesión con cuentas ya aprovisionadas.
 *
 * El permiso administrativo se comprueba SIEMPRE en los datos del backend
 * (tabla user_roles bajo RLS, igual que hace `es_admin()` en SQL): una
 * sesión válida sin rol admin activo queda bloqueada en la consola y, aun
 * si conociera las URLs, RLS le devolvería listas vacías y negaría las
 * operaciones privilegiadas (README sección 21, criterio 568).
 */
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { ConfiguracionPublica } from "./configuracion";

export interface SesionActiva {
  readonly usuarioId: string;
  readonly correo: string;
  readonly accessToken: string;
}

export type ResultadoSesion =
  | { readonly tipo: "ok"; readonly sesion: SesionActiva }
  | { readonly tipo: "error"; readonly mensaje: string };

export type ResultadoSesionRestaurada =
  | { readonly tipo: "ok"; readonly sesion: SesionActiva }
  | { readonly tipo: "sin-sesion" }
  | { readonly tipo: "error"; readonly mensaje: string };

export type ResultadoRol =
  | { readonly tipo: "ok"; readonly administrador: boolean }
  | { readonly tipo: "error"; readonly mensaje: string };

/** Cliente de Supabase con sesión persistente del navegador (localStorage). */
export function crearClienteAdmin(configuracion: ConfiguracionPublica): SupabaseClient {
  return createClient(configuracion.supabaseUrl, configuracion.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

function aSesionActiva(sesion: Session): SesionActiva {
  return {
    usuarioId: sesion.user.id,
    correo: sesion.user.email ?? "",
    accessToken: sesion.access_token,
  };
}

const CLAVES_ERROR: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  "Invalid login credentials": "Correo o contraseña incorrectos.",
  email_not_confirmed: "El correo de la cuenta aún no está confirmado.",
  user_banned: "La cuenta está suspendida.",
  too_many_requests: "Demasiados intentos: espera unos minutos y vuelve a probar.",
};

function mensajeDeError(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const texto = String((error as { message: unknown }).message);
    for (const [clave, mensaje] of Object.entries(CLAVES_ERROR)) {
      if (texto.includes(clave)) {
        return mensaje;
      }
    }
    return texto;
  }
  return "No se pudo completar la operación de autenticación.";
}

/** Inicio de sesión real (correo + contraseña) contra Supabase Auth. */
export async function iniciarSesion(
  cliente: SupabaseClient,
  correo: string,
  contrasena: string,
): Promise<ResultadoSesion> {
  const { data, error } = await cliente.auth.signInWithPassword({
    email: correo.trim(),
    password: contrasena,
  });
  if (error !== null || data.session === null) {
    return { tipo: "error", mensaje: mensajeDeError(error) };
  }
  return { tipo: "ok", sesion: aSesionActiva(data.session) };
}

/** Cierra la sesión real (revoca el token en el servidor). */
export async function cerrarSesion(cliente: SupabaseClient): Promise<void> {
  await cliente.auth.signOut();
}

/** Restaura la sesión persistida al abrir la consola. */
export async function sesionActual(cliente: SupabaseClient): Promise<ResultadoSesionRestaurada> {
  const { data, error } = await cliente.auth.getSession();
  if (error !== null) {
    return { tipo: "error", mensaje: mensajeDeError(error) };
  }
  if (data.session === null) {
    return { tipo: "sin-sesion" };
  }
  return { tipo: "ok", sesion: aSesionActiva(data.session) };
}

/**
 * Comprueba el permiso administrativo en el backend: fila activa de rol
 * `admin` en user_roles visible bajo RLS. Para un no administrador la
 * política devuelve solo sus propias filas, así que la respuesta es
 * honesta en ambos sentidos.
 */
export async function leerRolAdministrador(cliente: SupabaseClient): Promise<ResultadoRol> {
  const { data, error } = await cliente
    .from("user_roles")
    .select("user_id, role, status")
    .eq("role", "admin")
    .eq("status", "active");
  if (error !== null) {
    return { tipo: "error", mensaje: error.message };
  }
  const { data: datosSesion } = await cliente.auth.getSession();
  const usuarioId = datosSesion.session?.user.id;
  if (typeof usuarioId !== "string" || usuarioId.length === 0) {
    return { tipo: "error", mensaje: "La sesión no está activa: vuelve a iniciar sesión." };
  }
  const administrador = (data ?? []).some((fila) => fila.user_id === usuarioId);
  return { tipo: "ok", administrador };
}

/** Nombre visible del perfil propio (RLS lo permite a cualquier sesión). */
export async function leerNombrePropio(cliente: SupabaseClient): Promise<string | null> {
  const { data: datosSesion } = await cliente.auth.getSession();
  const usuarioId = datosSesion.session?.user.id;
  if (typeof usuarioId !== "string" || usuarioId.length === 0) {
    return null;
  }
  const { data } = await cliente
    .from("profiles")
    .select("full_name")
    .eq("id", usuarioId)
    .maybeSingle();
  const nombre = data?.full_name;
  return typeof nombre === "string" && nombre.trim().length > 0 ? nombre.trim() : null;
}
