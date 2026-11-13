/**
 * Perfiles visibles para la consola bajo RLS (el administrador lee todos).
 * Se usan para mostrar nombres reales junto a los identificadores y para
 * el selector de repartidores aprobados del despacho.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoExpediente } from "@kourigo/domain";

export interface FilaPerfil {
  readonly id: string;
  readonly full_name: string | null;
  readonly phone: string | null;
  readonly created_at: string;
}

export interface FilaCourierPerfil {
  readonly user_id: string;
  readonly verification_status: EstadoExpediente;
  readonly account_active: boolean;
  readonly updated_at: string;
}

export async function listarPerfiles(
  cliente: SupabaseClient,
  limite = 500,
): Promise<{ filas: FilaPerfil[]; error: string | null }> {
  const { data, error } = await cliente
    .from("profiles")
    .select("id,full_name,phone,created_at")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error !== null) {
    return { filas: [], error: error.message };
  }
  return { filas: (data ?? []) as unknown as FilaPerfil[], error: null };
}

/**
 * Repartidores con expediente aprobado y cuenta activa — los únicos que el
 * despacho acepta (regla `repartidorOperativo` de @kourigo/domain y RPC
 * `despachar_pedido` de la migración 0004).
 */
export async function listarRepartidoresOperativos(
  cliente: SupabaseClient,
): Promise<{ filas: FilaCourierPerfil[]; error: string | null }> {
  const { data, error } = await cliente
    .from("courier_profiles")
    .select("user_id,verification_status,account_active,updated_at")
    .eq("verification_status", "approved")
    .eq("account_active", true)
    .order("updated_at", { ascending: false });
  if (error !== null) {
    return { filas: [], error: error.message };
  }
  return { filas: (data ?? []) as unknown as FilaCourierPerfil[], error: null };
}
