/**
 * Auditoría de operaciones sensibles para la consola (README secciones 12
 * y 14). La tabla `audit_logs` solo tiene política de lectura para el
 * administrador (migración 0001): un no administrador obtiene una lista
 * vacía por RLS aunque conociera la URL de la consola.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface FilaAuditoria {
  readonly id: string;
  readonly actor_id: string | null;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string | null;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
}

export type FiltroAccion = "todas" | string;

const ACCIONES_CONOCIDAS = [
  "despachar_pedido",
  "transicion_administrativa",
  "decision_expediente",
  "revision_documento",
  "documento_firmado",
] as const;

export function accionesConocidas(): readonly string[] {
  return ACCIONES_CONOCIDAS;
}

/** Lista las últimas entradas de auditoría reales visibles para el admin. */
export async function listarAuditoria(
  cliente: SupabaseClient,
  filtroAccion: FiltroAccion,
  limite = 150,
): Promise<{ filas: FilaAuditoria[]; error: string | null }> {
  let consulta = cliente
    .from("audit_logs")
    .select("id,actor_id,action,resource_type,resource_id,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (filtroAccion !== "todas") {
    consulta = consulta.eq("action", filtroAccion);
  }
  const { data, error } = await consulta;
  if (error !== null) {
    return { filas: [], error: error.message };
  }
  return { filas: (data ?? []) as FilaAuditoria[], error: null };
}
