/**
 * Perfil propio del usuario autenticado (RLS «perfiles_leer_propio_o_admin»:
 * nadie puede leer el perfil de otro usuario). Lo usan las pestañas de
 * perfil y parámetros de la concha principal. Datos reales o nada.
 *
 * Migración 0006 (decisión del fundador 2026-11-15): el perfil del cliente
 * lleva foto, teléfono SOLO en formato Haití (+509 y 8 dígitos), nombre
 * completo, departamento, ville, código postal y número de casa («#113»).
 * Todo editable a favor del usuario; sirve para prellenar la dirección de
 * entrega al crear un pedido.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { texto, type ClaveTexto, type Idioma } from "./i18n";

export interface FilaPerfil {
  readonly id: string;
  readonly full_name: string | null;
  readonly phone: string | null;
  readonly locale: string | null;
  readonly departamento: string | null;
  readonly ville: string | null;
  readonly codigo_postal: string | null;
  readonly numero_casa: string | null;
  readonly avatar_public_id: string | null;
  readonly avatar_url: string | null;
}

export type ResultadoPerfil<T> = { tipo: "ok"; datos: T } | { tipo: "error"; mensaje: string };

export async function leerPerfilPropio(
  cliente: SupabaseClient,
): Promise<ResultadoPerfil<FilaPerfil | null>> {
  const { data, error } = await cliente
    .from("profiles")
    .select(
      "id, full_name, phone, locale, departamento, ville, codigo_postal, " +
        "numero_casa, avatar_public_id, avatar_url",
    )
    .maybeSingle();
  if (error !== null) {
    return { tipo: "error", mensaje: `profiles: ${error.message}` };
  }
  return { tipo: "ok", datos: (data ?? null) as FilaPerfil | null };
}

export async function guardarNombrePerfil(
  cliente: SupabaseClient,
  usuarioId: string,
  nombreCompleto: string,
): Promise<ResultadoPerfil<string>> {
  const { error } = await cliente
    .from("profiles")
    .update({ full_name: nombreCompleto })
    .eq("id", usuarioId);
  if (error !== null) {
    return { tipo: "error", mensaje: `profiles: ${error.message}` };
  }
  return { tipo: "ok", datos: nombreCompleto };
}

/**
 * Los 10 departamentos de Haití (nombres oficiales; los dos idiomas de la
 * interfaz los usan igual en los formularios).
 */
export const DEPARTAMENTOS_HAITI: readonly string[] = [
  "Ouest",
  "Artibonite",
  "Centre",
  "Grand'Anse",
  "Nippes",
  "Nord",
  "Nord-Est",
  "Nord-Ouest",
  "Sud",
  "Sud-Est",
];

/**
 * Normaliza y valida un teléfono de Haití. Acepta «37141234», «509 3714
 * 1234», «+50937141234», «0050937141234»… y devuelve la forma normalizada
 * «+50937141234» (8 dígitos locales cuyo primer dígito es 2, 3 o 4) o null
 * si no es válido. Función pura: la prueba unitaria la cubre sin red.
 */
export function normalizarTelefonoHaiti(entrada: string): string | null {
  const soloDigitos = entrada.replace(/[^\d]/g, "");
  let local = soloDigitos;
  if (local.startsWith("00509")) {
    local = local.slice(5);
  } else if (local.startsWith("509")) {
    local = local.slice(3);
  }
  if (local.length !== 8 || !/^[234][0-9]{7}$/.test(local)) {
    return null;
  }
  return `+509${local}`;
}

export interface DatosPerfilEdicion {
  readonly nombreCompleto: string;
  readonly telefono: string;
  readonly departamento: string;
  readonly ville: string;
  readonly codigoPostal: string;
  readonly numeroCasa: string;
}

/**
 * Valida el formulario de edición del perfil (mismas reglas que las
 * restricciones CHECK de la migración 0006). Devuelve las claves de error
 * en orden de aparición; vacío = válido.
 */
export function validarPerfilEdicion(datos: DatosPerfilEdicion): readonly ClaveTexto[] {
  const errores: ClaveTexto[] = [];
  if (datos.nombreCompleto.trim().length === 0 || datos.nombreCompleto.trim().length > 120) {
    errores.push("err_nombre_vacio");
  }
  if (normalizarTelefonoHaiti(datos.telefono) === null) {
    errores.push("err_telefono_509");
  }
  if (datos.departamento.trim().length === 0) {
    errores.push("err_departamento_vacio");
  }
  if (datos.ville.trim().length === 0 || datos.ville.trim().length > 120) {
    errores.push("err_ville_vacio");
  }
  if (datos.numeroCasa.trim().length === 0 || datos.numeroCasa.trim().length > 120) {
    errores.push("err_casa_vacio");
  }
  return errores;
}

export async function guardarPerfilEdicion(
  cliente: SupabaseClient,
  usuarioId: string,
  idioma: Idioma,
  datos: DatosPerfilEdicion,
): Promise<ResultadoPerfil<string>> {
  const errores = validarPerfilEdicion(datos);
  if (errores.length > 0) {
    return { tipo: "error", mensaje: texto(idioma, errores[0]) };
  }
  const telefono = normalizarTelefonoHaiti(datos.telefono);
  if (telefono === null) {
    return { tipo: "error", mensaje: texto(idioma, "err_telefono_509") };
  }
  const { error } = await cliente
    .from("profiles")
    .update({
      full_name: datos.nombreCompleto.trim(),
      phone: telefono,
      departamento: datos.departamento,
      ville: datos.ville.trim(),
      codigo_postal: datos.codigoPostal.trim().length > 0 ? datos.codigoPostal.trim() : null,
      numero_casa: datos.numeroCasa.trim(),
    })
    .eq("id", usuarioId);
  if (error !== null) {
    return { tipo: "error", mensaje: `profiles: ${error.message}` };
  }
  return { tipo: "ok", datos: telefono };
}

export async function guardarAvatarPerfil(
  cliente: SupabaseClient,
  usuarioId: string,
  avatarPublicId: string,
  avatarUrl: string,
): Promise<ResultadoPerfil<string>> {
  const { error } = await cliente
    .from("profiles")
    .update({ avatar_public_id: avatarPublicId, avatar_url: avatarUrl })
    .eq("id", usuarioId);
  if (error !== null) {
    return { tipo: "error", mensaje: `profiles: ${error.message}` };
  }
  return { tipo: "ok", datos: avatarUrl };
}

/**
 * Dirección de entrega compuesta a partir del perfil (número de casa,
 * ville y departamento): la que prellena el formulario de pedido para que
 * el repartidor llegue. Función pura, probada sin red.
 */
export function componerDireccionEntrega(
  perfil: Pick<FilaPerfil, "numero_casa" | "ville" | "departamento">,
): string {
  const partes = [perfil.numero_casa, perfil.ville, perfil.departamento]
    .map((parte) => (parte ?? "").trim())
    .filter((parte) => parte.length > 0);
  return partes.join(", ");
}
