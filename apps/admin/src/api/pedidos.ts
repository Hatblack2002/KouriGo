/**
 * Consultas y operaciones de pedidos de la consola administrativa.
 *
 * Lecturas por PostgREST bajo RLS: el administrador ve todos los pedidos
 * (política SQL); un no administrador solo vería los suyos — la consola
 * bloquea esa vía igualmente. Las operaciones privilegiadas (transición y
 * despacho) pasan SIEMPRE por las Edge Functions del runtime (ADR-0005):
 * el actor lo determina el servidor desde el JWT.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { esTransicionValida, TRANSICIONES_POR_ACTOR, type EstadoPedido } from "@kourigo/domain";
import type { ConfiguracionPublica } from "../configuracion";
import {
  invocarFuncion,
  type RespuestaDespacho,
  type RespuestaTransicion,
  type ResultadoFuncion,
} from "../funciones";

export interface FilaPedido {
  readonly id: string;
  readonly client_id: string;
  readonly order_type: string;
  readonly status: string;
  readonly pickup_address_text: string;
  readonly dropoff_address_text: string;
  readonly store_address_text: string | null;
  readonly notes: string | null;
  readonly currency: string;
  readonly service_fee_amount: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface FilaItem {
  readonly id: string;
  readonly order_id: string;
  readonly description: string;
  readonly quantity: number;
  readonly estimated_price_amount: number | null;
  readonly actual_price_amount: number | null;
}

export interface FilaEvento {
  readonly id: string;
  readonly event_type: string;
  readonly actor_id: string | null;
  readonly from_status: string | null;
  readonly to_status: string | null;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
}

export interface FilaAsignacion {
  readonly id: string;
  readonly order_id: string;
  readonly courier_user_id: string;
  readonly status: string;
  readonly offered_at: string;
  readonly accepted_at: string | null;
  readonly completed_at: string | null;
}

export type FiltroEstado = "todos" | EstadoPedido;

const COLUMNAS_PEDIDO =
  "id,client_id,order_type,status,pickup_address_text,dropoff_address_text," +
  "store_address_text,notes,currency,service_fee_amount,created_at,updated_at";

/** Lista pedidos reales con filtro de estado (el administrador los ve todos). */
export async function listarPedidos(
  cliente: SupabaseClient,
  filtro: FiltroEstado,
  limite = 100,
): Promise<{ filas: FilaPedido[]; error: string | null }> {
  let consulta = cliente
    .from("orders")
    .select(COLUMNAS_PEDIDO)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (filtro !== "todos") {
    consulta = consulta.eq("status", filtro);
  }
  const { data, error } = await consulta;
  if (error !== null) {
    return { filas: [], error: error.message };
  }
  return { filas: (data ?? []) as unknown as FilaPedido[], error: null };
}

export async function obtenerPedido(
  cliente: SupabaseClient,
  pedidoId: string,
): Promise<{ pedido: FilaPedido | null; error: string | null }> {
  const { data, error } = await cliente
    .from("orders")
    .select(COLUMNAS_PEDIDO)
    .eq("id", pedidoId)
    .maybeSingle();
  if (error !== null) {
    return { pedido: null, error: error.message };
  }
  return { pedido: (data as unknown as FilaPedido | null) ?? null, error: null };
}

export async function obtenerItems(
  cliente: SupabaseClient,
  pedidoId: string,
): Promise<{ filas: FilaItem[]; error: string | null }> {
  const { data, error } = await cliente
    .from("order_items")
    .select("id,order_id,description,quantity,estimated_price_amount,actual_price_amount")
    .eq("order_id", pedidoId)
    .order("created_at", { ascending: true });
  if (error !== null) {
    return { filas: [], error: error.message };
  }
  return { filas: (data ?? []) as unknown as FilaItem[], error: null };
}

export async function obtenerEventos(
  cliente: SupabaseClient,
  pedidoId: string,
): Promise<{ filas: FilaEvento[]; error: string | null }> {
  const { data, error } = await cliente
    .from("order_events")
    .select("id,event_type,actor_id,from_status,to_status,metadata,created_at")
    .eq("order_id", pedidoId)
    .order("created_at", { ascending: true });
  if (error !== null) {
    return { filas: [], error: error.message };
  }
  return { filas: (data ?? []) as unknown as FilaEvento[], error: null };
}

export async function obtenerAsignaciones(
  cliente: SupabaseClient,
  pedidoId: string,
): Promise<{ filas: FilaAsignacion[]; error: string | null }> {
  const { data, error } = await cliente
    .from("order_assignments")
    .select("id,order_id,courier_user_id,status,offered_at,accepted_at,completed_at")
    .eq("order_id", pedidoId)
    .order("offered_at", { ascending: true });
  if (error !== null) {
    return { filas: [], error: error.message };
  }
  return { filas: (data ?? []) as unknown as FilaAsignacion[], error: null };
}

/**
 * Cuenta pedidos por estado. Se hace en el cliente a partir de una lectura
 * liviana de solo estados (el volumen de un MVP de zona piloto cabe de
 * sobra; agrupar es función pura probada sin red).
 */
export async function contarPedidosPorEstado(
  cliente: SupabaseClient,
): Promise<{ conteos: Record<string, number>; total: number; error: string | null }> {
  const { data, error } = await cliente.from("orders").select("status");
  if (error !== null) {
    return { conteos: {}, total: 0, error: error.message };
  }
  const conteos = agruparPorEstado((data ?? []) as unknown as { status: string }[]);
  const total = conteos.__total ?? 0;
  return { conteos, total, error: null };
}

/** Agrupa filas por estado (función pura, probada sin red). */
export function agruparPorEstado(filas: readonly { status: string }[]): Record<string, number> {
  const conteos: Record<string, number> = { __total: 0 };
  for (const fila of filas) {
    conteos.__total = (conteos.__total ?? 0) + 1;
    conteos[fila.status] = (conteos[fila.status] ?? 0) + 1;
  }
  return conteos;
}

export interface OpcionTransicion {
  readonly destino: EstadoPedido;
  /** Corrección administrativa: exige motivo registrado (README §12). */
  readonly correccion: boolean;
}

/**
 * Estados a los que el ADMINISTRADOR puede mover el pedido desde el estado
 * actual según la matriz compartida de @kourigo/domain (la misma que
 * imponen el trigger SQL y la Edge Function). Los pares exclusivos del
 * administrador son correcciones administrativas: piden motivo.
 * Función pura, probada sin red.
 */
export function transicionesAdminDisponibles(estadoActual: string): OpcionTransicion[] {
  const otros: readonly ("cliente" | "repartidor" | "sistema")[] = [
    "cliente",
    "repartidor",
    "sistema",
  ];
  const opciones: OpcionTransicion[] = [];
  for (const transicion of TRANSICIONES_POR_ACTOR.administrador) {
    if (transicion.de !== estadoActual) {
      continue;
    }
    const compartida = otros.some((actor) =>
      esTransicionValida(transicion.de, transicion.a, actor),
    );
    opciones.push({ destino: transicion.a, correccion: !compartida });
  }
  return opciones;
}

/**
 * Transición de estado vía la Edge Function real `transicion-pedido` del
 * runtime. El motivo se envía cuando la corrección lo exige; el servidor
 * vuelve a imponer la regla y registra la auditoría.
 */
export async function transicionarPedido(
  configuracion: ConfiguracionPublica,
  accessToken: string,
  pedidoId: string,
  destino: EstadoPedido,
  motivo: string | null,
): Promise<ResultadoFuncion<RespuestaTransicion>> {
  const cuerpo: Record<string, unknown> = {
    pedido_id: pedidoId,
    estado_destino: destino,
  };
  if (motivo !== null && motivo.trim().length > 0) {
    cuerpo["motivo"] = motivo.trim();
  }
  return invocarFuncion<RespuestaTransicion>(
    configuracion,
    accessToken,
    "transicion-pedido",
    cuerpo,
  );
}

/**
 * Despacho de un pedido pending a un repartidor aprobado, vía la Edge
 * Function real `despachar-pedido` (RPC atómico por service_role,
 * migración 0004; auditoría incluida en la transacción).
 */
export async function despacharPedido(
  configuracion: ConfiguracionPublica,
  accessToken: string,
  pedidoId: string,
  repartidorId: string,
): Promise<ResultadoFuncion<RespuestaDespacho>> {
  return invocarFuncion<RespuestaDespacho>(configuracion, accessToken, "despachar-pedido", {
    pedido_id: pedidoId,
    repartidor_id: repartidorId,
  });
}
