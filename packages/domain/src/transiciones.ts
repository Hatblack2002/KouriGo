/**
 * Transiciones de estado permitidas para los pedidos, por actor
 * (README secciones 3, 4 y 12; docs/architecture/backend-supabase.md).
 *
 * El backend debe validar las transiciones: el cliente no puede enviar
 * libremente cualquier estado. La fuente de imposición en base de datos es
 * el trigger `validar_transicion_pedido` de database/migrations/; este
 * módulo es la misma regla expresada en TypeScript para la capa de
 * aplicación y las pruebas. Mantener ambos listados sincronizados.
 */
import type { Actor } from "./actores.js";
import type { EstadoPedido } from "./estados-pedido.js";

export interface Transicion {
  readonly de: EstadoPedido;
  readonly a: EstadoPedido;
}

/** El cliente puede confirmar su solicitud y cancelarla antes de la asignación. */
const TRANSICIONES_CLIENTE: readonly Transicion[] = [
  { de: "draft", a: "pending" }, // confirmar la solicitud
  { de: "draft", a: "cancelled" }, // cancelar sin llegar a confirmar
  { de: "pending", a: "cancelled" }, // cancelar mientras espera asignación
  { de: "offered", a: "cancelled" }, // cancelar mientras hay oferta sin aceptar
];

/** El repartidor aprobado recorre el ciclo operativo y puede reportar incidencias. */
const TRANSICIONES_REPARTIDOR: readonly Transicion[] = [
  { de: "offered", a: "accepted" },
  { de: "accepted", a: "at_pickup" },
  { de: "at_pickup", a: "picked_up" },
  { de: "picked_up", a: "in_transit" },
  { de: "in_transit", a: "delivered" },
  { de: "accepted", a: "issue" },
  { de: "at_pickup", a: "issue" },
  { de: "picked_up", a: "issue" },
  { de: "in_transit", a: "issue" },
];

/** El sistema ofrece pedidos y devuelve a la cola las ofertas sin respuesta. */
const TRANSICIONES_SISTEMA: readonly Transicion[] = [
  { de: "pending", a: "offered" },
  { de: "offered", a: "pending" },
];

/**
 * Correcciones administrativas con permiso, motivo y auditoría
 * (README sección 4): incluyen las transiciones ordinarias más las
 * cancelaciones justificadas y la resolución de incidencias.
 */
const TRANSICIONES_EXTRA_ADMIN: readonly Transicion[] = [
  { de: "accepted", a: "cancelled" },
  { de: "at_pickup", a: "cancelled" },
  { de: "picked_up", a: "cancelled" },
  { de: "in_transit", a: "cancelled" },
  { de: "issue", a: "pending" },
  { de: "issue", a: "delivered" },
  { de: "issue", a: "cancelled" },
];

function unirSinDuplicados(listas: readonly (readonly Transicion[])[]): readonly Transicion[] {
  const vistas = new Set<string>();
  const resultado: Transicion[] = [];
  for (const lista of listas) {
    for (const transicion of lista) {
      const clave = `${transicion.de}->${transicion.a}`;
      if (!vistas.has(clave)) {
        vistas.add(clave);
        resultado.push(transicion);
      }
    }
  }
  return resultado;
}

export const TRANSICIONES_POR_ACTOR: Record<Actor, readonly Transicion[]> = {
  cliente: TRANSICIONES_CLIENTE,
  repartidor: TRANSICIONES_REPARTIDOR,
  administrador: unirSinDuplicados([
    TRANSICIONES_CLIENTE,
    TRANSICIONES_REPARTIDOR,
    TRANSICIONES_SISTEMA,
    TRANSICIONES_EXTRA_ADMIN,
  ]),
  sistema: TRANSICIONES_SISTEMA,
};

export function esTransicionValida(de: EstadoPedido, a: EstadoPedido, actor: Actor): boolean {
  if (de === a) {
    return false;
  }
  return TRANSICIONES_POR_ACTOR[actor].some((t) => t.de === de && t.a === a);
}

export function explicarTransicionInvalida(
  de: EstadoPedido,
  a: EstadoPedido,
  actor: Actor,
): string {
  return `La transición de estado ${de} -> ${a} no está permitida para el rol ${actor}.`;
}
