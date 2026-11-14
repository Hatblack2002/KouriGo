/**
 * Servicio de datos REALES del repartidor en la app móvil (ADR-0001).
 * Todo pasa por el backend: user_roles (rol efectivo), courier_profiles
 * (expediente, zona de trabajo, disponibilidad), order_assignments con el
 * pedido embebido (ofertas y cursos del repartidor bajo las políticas RLS
 * «roles_leer_propio_o_admin», «courier_leer_propio_o_admin» y
 * «asignaciones_leer_propio_o_admin»). Nada se simula: si el backend no
 * devuelve datos, la pantalla muestra su estado vacío real.
 *
 * Las transiciones del pedido pasan por la Edge Function `transicion-pedido`
 * (el actor «repartidor» lo determina el servidor); el estado de la
 * ASIGNACIÓN se actualiza aparte con PostgREST bajo RLS y el trigger
 * `validar_transicion_asignacion` (offered->accepted/rejected,
 * accepted->completed) es el que impone las reglas en la base de datos.
 */
import { esEstadoPedido, type EstadoPedido } from "@kourigo/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface FilaPedidoAsignado {
  readonly id: string;
  readonly status: string;
  readonly order_type: string;
  readonly pickup_address_text: string;
  readonly dropoff_address_text: string;
  readonly store_address_text: string | null;
  readonly currency: string;
  readonly service_fee_amount: number;
  readonly created_at: string;
}

export interface FilaAsignacion {
  readonly id: string;
  readonly order_id: string;
  readonly status: string;
  readonly offered_at: string;
  readonly accepted_at: string | null;
  readonly completed_at: string | null;
  readonly orders: FilaPedidoAsignado | null;
}

export interface FilaPerfilCourier {
  readonly verification_status: string;
  readonly account_active: boolean;
  readonly work_zone: string | null;
  readonly available: boolean;
}

export type ResultadoRepartidor<T> = { tipo: "ok"; datos: T } | { tipo: "error"; mensaje: string };

/** Roles activos del usuario autenticado (RLS: solo los propios o admin). */
export async function leerRolesActivos(
  cliente: SupabaseClient,
): Promise<ResultadoRepartidor<readonly string[]>> {
  const { data, error } = await cliente.from("user_roles").select("role").eq("status", "active");
  if (error !== null || data === null) {
    return { tipo: "error", mensaje: `user_roles: ${error?.message ?? "sin datos"}` };
  }
  const roles = data
    .map((fila) => (fila as { role: string }).role)
    .filter((rol) => typeof rol === "string");
  return { tipo: "ok", datos: roles };
}

/**
 * Expediente del repartidor autenticado. Si la fila aún no existe (el
 * expediente se crea en el flujo de registro de repartidor), devuelve null:
 * la pantalla muestra el aviso honesto de expediente no iniciado.
 */
export async function leerPerfilCourier(
  cliente: SupabaseClient,
): Promise<ResultadoRepartidor<FilaPerfilCourier | null>> {
  const { data, error } = await cliente
    .from("courier_profiles")
    .select("verification_status, account_active, work_zone, available")
    .maybeSingle();
  if (error !== null) {
    return { tipo: "error", mensaje: `courier_profiles: ${error.message}` };
  }
  if (data === null) {
    return { tipo: "ok", datos: null };
  }
  const fila = data as unknown as {
    verification_status: string;
    account_active: boolean | null;
    work_zone: string | null;
    available: boolean | null;
  };
  return {
    tipo: "ok",
    datos: {
      verification_status: fila.verification_status,
      account_active: fila.account_active === true,
      work_zone: fila.work_zone,
      available: fila.available === true,
    },
  };
}

/** Guarda el interruptor de disponibilidad (RLS: courier_actualizar_…propio). */
export async function guardarDisponibilidad(
  cliente: SupabaseClient,
  disponible: boolean,
): Promise<ResultadoRepartidor<boolean>> {
  const usuarioId = (await cliente.auth.getUser()).data.user?.id;
  if (typeof usuarioId !== "string" || usuarioId.length === 0) {
    return { tipo: "error", mensaje: "La sesión no está activa: vuelve a iniciar sesión." };
  }
  const { error } = await cliente
    .from("courier_profiles")
    .update({ available: disponible })
    .eq("user_id", usuarioId);
  if (error !== null) {
    return { tipo: "error", mensaje: `courier_profiles: ${error.message}` };
  }
  return { tipo: "ok", datos: disponible };
}

/** Guarda la zona de trabajo declarada (texto real del expediente). */
export async function guardarZonaTrabajo(
  cliente: SupabaseClient,
  zona: string,
): Promise<ResultadoRepartidor<string>> {
  const usuarioId = (await cliente.auth.getUser()).data.user?.id;
  if (typeof usuarioId !== "string" || usuarioId.length === 0) {
    return { tipo: "error", mensaje: "La sesión no está activa: vuelve a iniciar sesión." };
  }
  const { error } = await cliente
    .from("courier_profiles")
    .update({ work_zone: zona })
    .eq("user_id", usuarioId);
  if (error !== null) {
    return { tipo: "error", mensaje: `courier_profiles: ${error.message}` };
  }
  return { tipo: "ok", datos: zona };
}

/**
 * Asignaciones del repartidor autenticado con el pedido embebido. RLS
 * «asignaciones_leer_propio_o_admin»: sin expediente aprobado el backend
 * devuelve cero filas (la app muestra la lista vacía real).
 */
export async function listarAsignaciones(
  cliente: SupabaseClient,
): Promise<ResultadoRepartidor<readonly FilaAsignacion[]>> {
  const { data, error } = await cliente
    .from("order_assignments")
    .select(
      "id, order_id, status, offered_at, accepted_at, completed_at, " +
        "orders(status, order_type, pickup_address_text, dropoff_address_text, " +
        "store_address_text, currency, service_fee_amount, created_at)",
    )
    .order("offered_at", { ascending: false })
    .limit(50);
  if (error !== null || data === null) {
    return { tipo: "error", mensaje: `order_assignments: ${error?.message ?? "sin datos"}` };
  }
  return { tipo: "ok", datos: data as unknown as FilaAsignacion[] };
}

/**
 * Estado de la asignación (offered->accepted/rejected, accepted->completed).
 * El trigger SQL `validar_transicion_asignacion` vuelve a imponer las reglas.
 */
export async function actualizarAsignacion(
  cliente: SupabaseClient,
  asignacionId: string,
  estado: "accepted" | "rejected" | "completed",
): Promise<ResultadoRepartidor<string>> {
  const { error } = await cliente
    .from("order_assignments")
    .update({ status: estado })
    .eq("id", asignacionId);
  if (error !== null) {
    return { tipo: "error", mensaje: `order_assignments: ${error.message}` };
  }
  return { tipo: "ok", datos: estado };
}

// ---------------------------------------------------------------------------
// Helpers puros (cobiertos por tests unitarios; sin acceso a red).
// ---------------------------------------------------------------------------

export interface CursosCourier {
  /** Ofertas sin respuesta del despacho administrativo. */
  readonly ofertas: readonly FilaAsignacion[];
  /** Cursos aceptados en curso operativo (accepted..in_transit). */
  readonly activos: readonly FilaAsignacion[];
  /** Cursos terminados (asignación completed). */
  readonly terminados: readonly FilaAsignacion[];
}

export function clasificarAsignaciones(filas: readonly FilaAsignacion[]): CursosCourier {
  const ofertas: FilaAsignacion[] = [];
  const activos: FilaAsignacion[] = [];
  const terminados: FilaAsignacion[] = [];
  filas.forEach((fila) => {
    if (fila.status === "offered" && fila.orders?.status === "offered") {
      ofertas.push(fila);
      return;
    }
    if (fila.status === "completed") {
      terminados.push(fila);
      return;
    }
    if (fila.status === "accepted" || fila.status === "rejected") {
      if (fila.status === "accepted") {
        activos.push(fila);
      }
      return;
    }
    // Asignación offered cuyo pedido ya no está offered (devuelto a la cola
    // por el sistema): queda como oferta sin vigencia y no se muestra.
  });
  return { ofertas, activos, terminados };
}

/**
 * Siguiente transición operativa del repartidor según la matriz compartida de
 * @kourigo/domain (la misma que imponen el trigger SQL y la Edge Function).
 */
export function siguienteTransicionCourier(estadoPedido: string): EstadoPedido | null {
  switch (estadoPedido) {
    case "offered":
      return "accepted";
    case "accepted":
      return "at_pickup";
    case "at_pickup":
      return "picked_up";
    case "picked_up":
      return "in_transit";
    case "in_transit":
      return "delivered";
    default:
      return null;
  }
}

export interface KpisCourier {
  readonly entregasHoy: number;
  readonly entregasTotales: number;
}

/** KPIs reales calculados de las asignaciones terminadas (sin inventar nota). */
export function calcularKpisCourier(filas: readonly FilaAsignacion[], ahora: Date): KpisCourier {
  const terminadas = filas.filter((fila) => fila.status === "completed");
  const inicioHoy = new Date(
    Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()),
  );
  const entregasHoy = terminadas.filter(
    (fila) =>
      fila.completed_at !== null && new Date(fila.completed_at).getTime() >= inicioHoy.getTime(),
  ).length;
  return { entregasHoy, entregasTotales: terminadas.length };
}

/** ¿El expediente permite operar? (la misma regla que `repartidor_aprobado()`). */
export function courierOperativo(perfil: FilaPerfilCourier | null): boolean {
  return perfil !== null && perfil.verification_status === "approved" && perfil.account_active;
}

export function esEstadoValido(estado: string): boolean {
  return esEstadoPedido(estado);
}
