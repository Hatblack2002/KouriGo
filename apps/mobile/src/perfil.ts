/**
 * Perfil propio del usuario autenticado (RLS «perfiles_leer_propio_o_admin»:
 * nadie puede leer el perfil de otro usuario). Lo usan las pestañas de
 * perfil y parámetros de la concha principal. Datos reales o nada.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface FilaPerfil {
  readonly id: string;
  readonly full_name: string | null;
  readonly phone: string | null;
  readonly locale: string | null;
}

export type ResultadoPerfil<T> = { tipo: "ok"; datos: T } | { tipo: "error"; mensaje: string };

export async function leerPerfilPropio(
  cliente: SupabaseClient,
): Promise<ResultadoPerfil<FilaPerfil | null>> {
  const { data, error } = await cliente
    .from("profiles")
    .select("id, full_name, phone, locale")
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
