/**
 * Servicio de autenticación real de la app móvil contra Supabase Auth
 * (ADR-0001 y docs/architecture/backend-supabase.md sección 2): registro,
 * inicio de sesión, cierre de sesión y perfil propio. Nada se simula:
 * las sesiones son reales y se persisten en el adaptador de almacenamiento
 * inyectado. El rol nunca se decide en el cliente: la autorización la
 * aplican las políticas RLS y las Edge Functions del backend.
 */
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { AlmacenSesion } from "./almacen-memoria";
import type { ConfiguracionPublica } from "./configuracion";

export interface SesionActiva {
  readonly usuarioId: string;
  readonly correo: string | null;
  readonly accessToken: string;
}

export type ClaveErrorAuth =
  | "credenciales_invalidas"
  | "correo_no_confirmado"
  | "contrasena_debil"
  | "usuario_ya_existe"
  | "limite_intentos"
  | "desconocido";

export type ResultadoAuth =
  | { tipo: "ok"; sesion: SesionActiva }
  | { tipo: "pendiente_confirmacion"; usuarioId: string }
  | { tipo: "error"; clave: ClaveErrorAuth; mensaje: string };

export type ResultadoSesion =
  | { tipo: "ok"; sesion: SesionActiva }
  | { tipo: "error"; clave: ClaveErrorAuth; mensaje: string };

/**
 * Crea el cliente de Supabase de la app con la sesión persistida en el
 * adaptador dado (AsyncStorage en el móvil, memoria en la prueba E2E).
 */
export function crearClienteApp(
  configuracion: ConfiguracionPublica,
  almacen: AlmacenSesion,
): SupabaseClient {
  return createClient(configuracion.supabaseUrl, configuracion.supabaseAnonKey, {
    auth: {
      storage: almacen,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

function extraerSesion(sesion: Session): SesionActiva {
  return {
    usuarioId: sesion.user.id,
    correo: sesion.user.email ?? null,
    accessToken: sesion.access_token,
  };
}

function mapearClaveError(error: { code?: string; status?: number }): ClaveErrorAuth {
  switch (error.code) {
    case "invalid_credentials":
    case "user_not_found":
      return "credenciales_invalidas";
    case "email_not_confirmed":
      return "correo_no_confirmado";
    case "weak_password":
      return "contrasena_debil";
    case "user_already_exists":
      return "usuario_ya_existe";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "limite_intentos";
    default:
      return "desconocido";
  }
}

function errorAuth(error: unknown): ResultadoAuth {
  const datos = error as { code?: string; status?: number; message?: string };
  return {
    tipo: "error",
    clave: mapearClaveError(datos),
    mensaje: typeof datos.message === "string" ? datos.message : String(error),
  };
}

/**
 * Registro público como cliente (README sección 2.1 y criterio del MVP:
 * «un usuario nuevo puede registrarse como cliente»; el registro público no
 * crea administradores). Si el proyecto exige confirmación de correo, la
 * sesión queda pendiente y la app lo comunica.
 */
export async function registrarCliente(
  cliente: SupabaseClient,
  correo: string,
  contrasena: string,
  nombreCompleto: string,
): Promise<ResultadoAuth> {
  const { data, error } = await cliente.auth.signUp({ email: correo, password: contrasena });
  if (error !== null) {
    return errorAuth(error);
  }
  if (data.session === null || data.user === null) {
    // El proyecto exige confirmación de correo: la cuenta existe (con id
    // real) pero aún no hay sesión.
    if (data.user !== null) {
      return { tipo: "pendiente_confirmacion", usuarioId: data.user.id };
    }
    return { tipo: "error", clave: "desconocido", mensaje: "El registro no devolvió usuario." };
  }
  const guardado = await guardarPerfil(cliente, data.user.id, nombreCompleto);
  if (guardado !== null) {
    return { tipo: "error", clave: "desconocido", mensaje: guardado };
  }
  return { tipo: "ok", sesion: extraerSesion(data.session) };
}

export async function iniciarSesion(
  cliente: SupabaseClient,
  correo: string,
  contrasena: string,
): Promise<ResultadoSesion> {
  const { data, error } = await cliente.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });
  if (error !== null) {
    const datos = error as { code?: string; status?: number; message?: string };
    return {
      tipo: "error",
      clave: mapearClaveError(datos),
      mensaje: typeof datos.message === "string" ? datos.message : String(error),
    };
  }
  return { tipo: "ok", sesion: extraerSesion(data.session) };
}

/**
 * Crea la fila de perfil del usuario autenticado (RLS: «perfiles_insertar_
 * propio») y su perfil de cliente. Devuelve null si todo salió bien o el
 * mensaje de error real del backend.
 */
export async function guardarPerfil(
  cliente: SupabaseClient,
  usuarioId: string,
  nombreCompleto: string,
): Promise<string | null> {
  const perfil = await cliente
    .from("profiles")
    .insert({ id: usuarioId, full_name: nombreCompleto })
    .select("id")
    .single();
  if (perfil.error !== null) {
    return `profiles: ${perfil.error.message}`;
  }
  const clientePerfil = await cliente
    .from("customer_profiles")
    .insert({ user_id: usuarioId })
    .select("user_id")
    .single();
  if (clientePerfil.error !== null) {
    return `customer_profiles: ${clientePerfil.error.message}`;
  }
  return null;
}

export async function cerrarSesion(cliente: SupabaseClient): Promise<void> {
  await cliente.auth.signOut();
}

/**
 * Restaura la sesión persistida (si existe y sigue vigente). Con
 * persistSession y autoRefreshToken, supabase-js refresca el token contra
 * Supabase Auth.
 */
export async function sesionActual(cliente: SupabaseClient): Promise<SesionActiva | null> {
  const { data } = await cliente.auth.getSession();
  if (data.session === null) {
    return null;
  }
  return extraerSesion(data.session);
}

/** Suscripción a cambios de sesión (inicio/cierre desde otros flujos). */
export function suscribirseCambiosSesion(
  cliente: SupabaseClient,
  alCambiar: (sesion: SesionActiva | null) => void,
): () => void {
  const { data } = cliente.auth.onAuthStateChange((_evento, sesion) => {
    alCambiar(sesion === null ? null : extraerSesion(sesion));
  });
  return () => {
    data.subscription.unsubscribe();
  };
}
