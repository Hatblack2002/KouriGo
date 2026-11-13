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
import type { ClaveTexto } from "./idiomas";

export interface SesionActiva {
  readonly usuarioId: string;
  readonly correo: string;
  readonly accessToken: string;
}

export type ResultadoSesion =
  | { readonly tipo: "ok"; readonly sesion: SesionActiva }
  | {
      readonly tipo: "error";
      readonly mensaje: string;
      readonly clave: ClaveTexto | null;
    };

export type ResultadoSesionRestaurada =
  | { readonly tipo: "ok"; readonly sesion: SesionActiva }
  | { readonly tipo: "sin-sesion" }
  | { readonly tipo: "error"; readonly mensaje: string; readonly clave: ClaveTexto | null };

export type ResultadoRol =
  | { readonly tipo: "ok"; readonly administrador: boolean }
  | { readonly tipo: "error"; readonly mensaje: string; readonly clave: ClaveTexto | null };

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

/**
 * Clave de traducción para los errores de autenticación conocidos (README
 * sección 9: los mensajes visibles salen del diccionario de idiomas). El
 * mensaje técnico original se conserva para diagnóstico y registro.
 */
const CLAVES_ERROR: readonly { patron: string; clave: ClaveTexto }[] = [
  { patron: "invalid_credentials", clave: "credenciales_invalidas" },
  { patron: "Invalid login credentials", clave: "credenciales_invalidas" },
  { patron: "email_not_confirmed", clave: "correo_no_confirmado" },
  { patron: "user_banned", clave: "cuenta_suspendida" },
  { patron: "too_many_requests", clave: "limite_intentos" },
];

function mensajeDeError(error: unknown): { mensaje: string; clave: ClaveTexto | null } {
  if (typeof error === "object" && error !== null && "message" in error) {
    const texto = String((error as { message: unknown }).message);
    for (const { patron, clave } of CLAVES_ERROR) {
      if (texto.includes(patron)) {
        return { mensaje: texto, clave };
      }
    }
    return { mensaje: texto, clave: null };
  }
  return { mensaje: "No se pudo completar la operación de autenticación.", clave: null };
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
    const fallo = mensajeDeError(error);
    return { tipo: "error", mensaje: fallo.mensaje, clave: fallo.clave };
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
    const fallo = mensajeDeError(error);
    return { tipo: "error", mensaje: fallo.mensaje, clave: fallo.clave };
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
    return { tipo: "error", mensaje: error.message, clave: null };
  }
  const { data: datosSesion } = await cliente.auth.getSession();
  const usuarioId = datosSesion.session?.user.id;
  if (typeof usuarioId !== "string" || usuarioId.length === 0) {
    return {
      tipo: "error",
      mensaje: "La sesión no está activa: vuelve a iniciar sesión.",
      clave: "sesion_inactiva",
    };
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
