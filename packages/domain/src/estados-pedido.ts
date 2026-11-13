/**
 * Estados de los pedidos definidos en el README de KouriGo (sección 4).
 *
 * Los valores son los literales que se almacenan en la base de datos
 * (tabla `orders`, columna `status`) y en los registros de eventos.
 * Deben mantenerse idénticos a los del trigger SQL en database/migrations/.
 */
export const ESTADOS_PEDIDO = [
  "draft",
  "pending",
  "offered",
  "accepted",
  "at_pickup",
  "picked_up",
  "in_transit",
  "delivered",
  "cancelled",
  "issue",
] as const;

export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

/** Estados finales: un pedido en estos estados no puede cambiar de estado. */
export const ESTADOS_FINALES_PEDIDO = ["delivered", "cancelled"] as const;

/**
 * Hitos específicos de la compra asistida ("Achte pou mwen + livre").
 * Se registran como eventos del pedido sin forzar esos pasos en una
 * entrega normal (README sección 4).
 */
export const HITOS_COMPRA_ASISTIDA = [
  "purchase_started",
  "purchase_completed",
  "amount_confirmed",
] as const;

export type HitoCompraAsistida = (typeof HITOS_COMPRA_ASISTIDA)[number];

export function esEstadoPedido(valor: unknown): valor is EstadoPedido {
  return typeof valor === "string" && (ESTADOS_PEDIDO as readonly string[]).includes(valor);
}

export function esEstadoFinal(valor: EstadoPedido): boolean {
  return (ESTADOS_FINALES_PEDIDO as readonly string[]).includes(valor);
}
