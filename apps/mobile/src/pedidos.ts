/**
 * Servicio de pedidos de la app móvil. Toda operación toca el backend REAL
 * (ADR-0001): la creación es PostgREST bajo RLS (el cliente solo puede
 * insertar su propio pedido en `draft`), las transiciones pasan por la Edge
 * Function `transicion-pedido` (el actor lo determina el servidor), y la
 * validación local reutiliza las reglas compartidas de @kourigo/domain que
 * el trigger SQL vuelve a imponer en la base de datos.
 *
 * La moneda y la tarifa de servicio son parámetros sin valor por defecto:
 * son decisiones pendientes del fundador (README sección 22) y el código no
 * las fija (plan-etapas.md, notas de cumplimiento).
 */
import {
  validarCreacionPedido,
  TRANSICIONES_POR_ACTOR,
  type ArticuloPedido,
  type EstadoPedido,
  type TipoPedido,
} from "@kourigo/domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConfiguracionPublica } from "./configuracion";
import { invocarFuncion, type RespuestaTransicion } from "./funciones";

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
  readonly order_id: string;
  readonly event_type: string;
  readonly from_status: string | null;
  readonly to_status: string | null;
  readonly created_at: string;
  readonly metadata: Record<string, unknown>;
}

export interface DatosFormularioPedido {
  readonly tipo: TipoPedido;
  readonly recogidaTexto: string;
  readonly destinoTexto: string;
  /** Solo compra asistida: comercio donde el repartidor compra. */
  readonly comercioTexto: string | null;
  readonly notas: string | null;
  /** Código ISO 4217 (decisión pendiente del fundador; sin valor fijado). */
  readonly moneda: string;
  /** Entero en la unidad mínima de la moneda (README sección 11). */
  readonly tarifaServicio: number;
  readonly items: readonly ArticuloPedido[];
}

const PATRON_MONEDA = /^[A-Z]{3}$/;

export type ResultadoPedido<T> =
  | { tipo: "ok"; datos: T }
  | { tipo: "error"; mensaje: string };

/**
 * Validación de la app con claves de mensaje localizables (src/i18n.ts).
 * Los límites son los mismos que el backend impone (CHECK y trigger SQL).
 */
export function validarFormularioPedido(
  datos: DatosFormularioPedido,
): readonly ClaveErrorFormulario[] {
  const errores: ClaveErrorFormulario[] = [];
  const recogida = datos.recogidaTexto.trim();
  const destino = datos.destinoTexto.trim();
  if (recogida.length < 5 || recogida.length > 300) {
    errores.push("err_recogida");
  }
  if (destino.length < 5 || destino.length > 300) {
    errores.push("err_destino");
  }
  if (datos.tipo === "assisted_purchase" && (datos.comercioTexto ?? "").trim().length === 0) {
    errores.push("err_comercio");
  }
  if ((datos.notas ?? "").length > 500) {
    errores.push("err_notas");
  }
  if (!PATRON_MONEDA.test(datos.moneda)) {
    errores.push("err_moneda");
  }
  if (!Number.isSafeInteger(datos.tarifaServicio) || datos.tarifaServicio < 0) {
    errores.push("err_tarifa");
  }
  if (datos.items.length < 1 || datos.items.length > 20) {
    errores.push("err_items_vacio");
  } else {
    datos.items.forEach((item) => {
      const descripcion = item.descripcion.trim();
      if (descripcion.length < 1 || descripcion.length > 300) {
        errores.push("err_item_descripcion");
      }
      if (!Number.isSafeInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > 999) {
        errores.push("err_item_cantidad");
      }
      if (
        item.precioEstimado !== undefined &&
        (!Number.isSafeInteger(item.precioEstimado) || item.precioEstimado < 0)
      ) {
        errores.push("err_item_precio");
      }
    });
  }
  return errores;
}

export type ClaveErrorFormulario =
  | "err_recogida"
  | "err_destino"
  | "err_comercio"
  | "err_notas"
  | "err_moneda"
  | "err_tarifa"
  | "err_items_vacio"
  | "err_item_descripcion"
  | "err_item_cantidad"
  | "err_item_precio"
  | "err_dominio";

/**
 * Crea el pedido en borrador con sus artículos (RLS: «pedidos_insertar_
 * propio_borrador» e «items_escribir_cliente_borrador»). Antes de tocar la
 * red revalida con @kourigo/domain: si el dominio rechaza, no se envía nada.
 */
export async function crearPedidoBorrador(
  cliente: SupabaseClient,
  datos: DatosFormularioPedido,
): Promise<ResultadoPedido<FilaPedido>> {
  const datosDominio = {
    tipo: datos.tipo,
    recogidaTexto: datos.recogidaTexto.trim(),
    destinoTexto: datos.destinoTexto.trim(),
    notas: datos.notas ?? undefined,
    items: datos.items,
    presupuestoTotal:
      datos.tipo === "assisted_purchase"
        ? datos.items.reduce((total, item) => total + (item.precioEstimado ?? 0) * item.cantidad, 0)
        : undefined,
  };
  const erroresDominio = validarCreacionPedido(datosDominio);
  if (erroresDominio.length > 0) {
    return { tipo: "error", mensaje: `${erroresDominio[0] ?? "Datos inválidos"}` };
  }

  const insertado = await cliente
    .from("orders")
    .insert({
      order_type: datos.tipo,
      status: "draft",
      pickup_address_text: datos.recogidaTexto.trim(),
      dropoff_address_text: datos.destinoTexto.trim(),
      store_address_text: datos.tipo === "assisted_purchase" ? datos.comercioTexto : null,
      notes: datos.notas,
      currency: datos.moneda,
      service_fee_amount: datos.tarifaServicio,
    })
    .select("id, client_id, order_type, status, pickup_address_text, dropoff_address_text, store_address_text, notes, currency, service_fee_amount, created_at, updated_at")
    .single();
  if (insertado.error !== null || insertado.data === null) {
    return { tipo: "error", mensaje: `orders: ${insertado.error?.message ?? "sin datos"}` };
  }
  const pedido = insertado.data as unknown as FilaPedido;

  const articulos = await cliente.from("order_items").insert(
    datos.items.map((item) => ({
      order_id: pedido.id,
      description: item.descripcion.trim(),
      quantity: item.cantidad,
      estimated_price_amount: item.precioEstimado ?? null,
    })),
  );
  if (articulos.error !== null) {
    // El pedido no puede quedarse sin artículos: se elimina el borrador
    // parcial y se informa el error real.
    await cliente.from("orders").delete().eq("id", pedido.id);
    return { tipo: "error", mensaje: `order_items: ${articulos.error.message}` };
  }
  return { tipo: "ok", datos: pedido };
}

export async function listarPedidos(
  cliente: SupabaseClient,
): Promise<ResultadoPedido<FilaPedido[]>> {
  const { data, error } = await cliente
    .from("orders")
    .select("id, client_id, order_type, status, pickup_address_text, dropoff_address_text, store_address_text, notes, currency, service_fee_amount, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error !== null || data === null) {
    return { tipo: "error", mensaje: `orders: ${error?.message ?? "sin datos"}` };
  }
  return { tipo: "ok", datos: data as unknown as FilaPedido[] };
}

export type PedidoObtenido = ResultadoPedido<FilaPedido | null>;

export async function obtenerPedido(
  cliente: SupabaseClient,
  pedidoId: string,
): Promise<PedidoObtenido> {
  const { data, error } = await cliente
    .from("orders")
    .select("id, client_id, order_type, status, pickup_address_text, dropoff_address_text, store_address_text, notes, currency, service_fee_amount, created_at, updated_at")
    .eq("id", pedidoId)
    .maybeSingle();
  if (error !== null) {
    return { tipo: "error", mensaje: `orders: ${error.message}` };
  }
  return { tipo: "ok", datos: (data ?? null) as FilaPedido | null };
}

export async function obtenerItems(
  cliente: SupabaseClient,
  pedidoId: string,
): Promise<ResultadoPedido<FilaItem[]>> {
  const { data, error } = await cliente
    .from("order_items")
    .select("id, order_id, description, quantity, estimated_price_amount, actual_price_amount")
    .eq("order_id", pedidoId)
    .order("created_at", { ascending: true });
  if (error !== null || data === null) {
    return { tipo: "error", mensaje: `order_items: ${error?.message ?? "sin datos"}` };
  }
  return { tipo: "ok", datos: data as unknown as FilaItem[] };
}

export async function obtenerEventos(
  cliente: SupabaseClient,
  pedidoId: string,
): Promise<ResultadoPedido<FilaEvento[]>> {
  const { data, error } = await cliente
    .from("order_events")
    .select("id, order_id, event_type, from_status, to_status, created_at, metadata")
    .eq("order_id", pedidoId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error !== null || data === null) {
    return { tipo: "error", mensaje: `order_events: ${error?.message ?? "sin datos"}` };
  }
  return { tipo: "ok", datos: data as unknown as FilaEvento[] };
}

/**
 * Transición de estado vía la Edge Function real `transicion-pedido`.
 * El actor lo determina el servidor (JWT); la respuesta incluye de/a/actor.
 */
export async function transicionarPedido(
  configuracion: ConfiguracionPublica,
  cliente: SupabaseClient,
  pedidoId: string,
  destino: EstadoPedido,
): Promise<ResultadoPedido<RespuestaTransicion>> {
  const { data: datosSesion } = await cliente.auth.getSession();
  const token = datosSesion.session?.access_token;
  if (typeof token !== "string" || token.length === 0) {
    return { tipo: "error", mensaje: "La sesión no está activa: vuelve a iniciar sesión." };
  }
  const resultado = await invocarFuncion<RespuestaTransicion>(
    configuracion,
    token,
    "transicion-pedido",
    {
      pedido_id: pedidoId,
      estado_destino: destino,
    },
  );
  if (!resultado.ok || resultado.datos === null) {
    return { tipo: "error", mensaje: resultado.mensajeError ?? `HTTP ${resultado.estado}` };
  }
  return { tipo: "ok", datos: resultado.datos };
}

/**
 * Estados a los que el CLIENTE puede mover el pedido desde el estado actual,
 * según la matriz compartida de @kourigo/domain (la misma que impone el
 * trigger SQL y la Edge Function en el servidor).
 */
export function transicionesClienteDesde(estado: EstadoPedido): readonly EstadoPedido[] {
  return TRANSICIONES_POR_ACTOR.cliente.filter((t) => t.de === estado).map((t) => t.a);
}
