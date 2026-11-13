/**
 * Espejo de las reglas de dominio que aplican las Edge Functions de la
 * Etapa 3 (docs/architecture/backend-supabase.md, sección "Edge Functions y
 * servidor").
 *
 * Las listas de transiciones y los requisitos de cada decisión son los
 * mismos que imponen los triggers de database/migrations/ y los que
 * expresan packages/domain/src/ para la capa de aplicación. Mantener las
 * tres fuentes sincronizadas: las pruebas unitarias de
 * supabase/functions/_pruebas/ y las pruebas SQL de database/tests/ cierran
 * el ciclo de consistencia.
 */

// ---------------------------------------------------------------------------
// Pedidos (espejo de packages/domain/src/estados-pedido.ts y transiciones.ts)
// ---------------------------------------------------------------------------
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

export const ACTORES = ["cliente", "repartidor", "administrador", "sistema"] as const;

export type Actor = (typeof ACTORES)[number];

export function esEstadoPedido(valor: unknown): valor is EstadoPedido {
  return typeof valor === "string" && (ESTADOS_PEDIDO as readonly string[]).includes(valor);
}

export interface Transicion {
  readonly de: EstadoPedido;
  readonly a: EstadoPedido;
}

const TRANSICIONES_CLIENTE: readonly Transicion[] = [
  { de: "draft", a: "pending" },
  { de: "draft", a: "cancelled" },
  { de: "pending", a: "cancelled" },
  { de: "offered", a: "cancelled" },
];

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

const TRANSICIONES_SISTEMA: readonly Transicion[] = [
  { de: "pending", a: "offered" },
  { de: "offered", a: "pending" },
];

const TRANSICIONES_EXTRA_ADMIN: readonly Transicion[] = [
  { de: "accepted", a: "cancelled" },
  { de: "at_pickup", a: "cancelled" },
  { de: "picked_up", a: "cancelled" },
  { de: "in_transit", a: "cancelled" },
  { de: "issue", a: "pending" },
  { de: "issue", a: "delivered" },
  { de: "issue", a: "cancelled" },
];

function unirSinDuplicados(
  listas: readonly (readonly Transicion[])[],
): readonly Transicion[] {
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

export function esTransicionValida(
  de: EstadoPedido,
  a: EstadoPedido,
  actor: Actor,
): boolean {
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

/**
 * Corrección administrativa (Etapa 5): par de estados válido para el
 * administrador que NINGÚN otro actor puede aplicar (cancelaciones
 * justificadas y resolución de incidencias). Esas correcciones exigen
 * motivo registrado y auditoría (README secciones 4 y 12).
 */
export function esCorreccionAdministrativa(de: EstadoPedido, a: EstadoPedido): boolean {
  const otros: readonly Actor[] = ["cliente", "repartidor", "sistema"];
  if (!esTransicionValida(de, a, "administrador")) {
    return false;
  }
  return otros.every((actor) => !esTransicionValida(de, a, actor));
}

// ---------------------------------------------------------------------------
// Expediente de verificación (espejo de packages/domain/src/expediente.ts y
// del trigger validar_transicion_expediente, migraciones 0002 y 0003)
// ---------------------------------------------------------------------------
export const ESTADOS_EXPEDIENTE = [
  "draft",
  "submitted",
  "under_review",
  "needs_information",
  "verification_scheduled",
  "approved",
  "rejected",
  "suspended",
  "expired",
  "reverification_required",
] as const;

export type EstadoExpediente = (typeof ESTADOS_EXPEDIENTE)[number];

export function esEstadoExpediente(valor: unknown): valor is EstadoExpediente {
  return typeof valor === "string" && (ESTADOS_EXPEDIENTE as readonly string[]).includes(valor);
}

/** Métodos de comprobación admitidos (especificación sección 3). */
export const METODOS_VERIFICACION = [
  "documental",
  "videoconferencia",
  "presencial",
] as const;

export type MetodoVerificacion = (typeof METODOS_VERIFICACION)[number];

/**
 * Decisiones administrativas que expone la Edge Function
 * `decision-verificacion`. Cada decisión apunta a un estado destino; el par
 * (estado actual -> destino) debe estar entre los pares administrativos
 * permitidos y el trigger de base de datos vuelve a validarlo todo.
 */
export const DECISIONES_EXPEDIENTE = {
  iniciar_revision: { estado: "under_review", requiereMotivo: false, requiereMetodo: false },
  pedir_informacion: { estado: "needs_information", requiereMotivo: true, requiereMetodo: false },
  programar_verificacion: {
    estado: "verification_scheduled",
    requiereMotivo: false,
    requiereMetodo: true,
  },
  aprobar: { estado: "approved", requiereMotivo: true, requiereMetodo: true },
  rechazar: { estado: "rejected", requiereMotivo: true, requiereMetodo: false },
  suspender: { estado: "suspended", requiereMotivo: true, requiereMetodo: false },
  solicitar_reverificacion: {
    estado: "reverification_required",
    requiereMotivo: true,
    requiereMetodo: false,
  },
  expirar: { estado: "expired", requiereMotivo: true, requiereMetodo: false },
} as const;

export type DecisionExpediente = keyof typeof DECISIONES_EXPEDIENTE | "revision_documento";

export function esDecisionExpediente(valor: unknown): valor is DecisionExpediente {
  return typeof valor === "string" &&
    (Object.keys(DECISIONES_EXPEDIENTE).includes(valor) || valor === "revision_documento");
}

/** Pares administrativos, idénticos al listado del trigger (migración 0002). */
const PARES_ADMIN_EXPEDIENTE: readonly string[] = [
  "submitted->under_review",
  "under_review->needs_information",
  "needs_information->under_review",
  "under_review->verification_scheduled",
  "verification_scheduled->under_review",
  "under_review->approved",
  "under_review->rejected",
  "approved->suspended",
  "approved->reverification_required",
  "approved->expired",
  "suspended->under_review",
  "expired->under_review",
];

export function parAdminExpedientePermitido(de: string, a: string): boolean {
  return PARES_ADMIN_EXPEDIENTE.includes(`${de}->${a}`);
}
