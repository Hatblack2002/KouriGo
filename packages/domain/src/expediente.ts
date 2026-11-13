/**
 * Flujo de revisión del expediente de verificación de repartidores
 * (docs/operations/courier-identity-verification.md, secciones 4, 5 y 8).
 *
 * La fuente de imposición en base de datos es el trigger
 * `validar_transicion_expediente` de database/migrations/
 * 0002_verificacion_repartidores.sql; este módulo es la misma regla
 * expresada en TypeScript para la capa de aplicación (Edge Functions de la
 * Etapa 3) y las pruebas. Mantener ambos listados sincronizados.
 */

/** Estados del expediente, idénticos a la especificación (sección 4). */
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

/** Tipos de documento admitidos (sección 6). */
export const TIPOS_DOCUMENTO_EXPEDIENTE = [
  "national_id_front",
  "national_id_back",
  "passport",
  "selfie",
  "certificate_good_conduct",
  "driver_license",
] as const;

export type TipoDocumentoExpediente = (typeof TIPOS_DOCUMENTO_EXPEDIENTE)[number];

/** Métodos de comprobación (sección 3): documental, videoconferencia, presencial. */
export const METODOS_VERIFICACION = ["documental", "videoconferencia", "presencial"] as const;

export type MetodoVerificacion = (typeof METODOS_VERIFICACION)[number];

/**
 * Actores del expediente. El actor se determina SIEMPRE en el servidor a
 * partir de la sesión autenticada; el candidato nunca envía su rol.
 */
export const ACTORES_EXPEDIENTE = ["candidato", "administrador", "sistema"] as const;

export type ActorExpediente = (typeof ACTORES_EXPEDIENTE)[number];

export interface TransicionExpediente {
  readonly de: EstadoExpediente;
  readonly a: EstadoExpediente;
  /** Toda decisión y solicitud de información exige motivo registrado. */
  readonly requiereMotivo?: boolean;
  /** Habilitación y programación exigen el método de comprobación. */
  readonly requiereMetodo?: boolean;
  /** La presentación exige al menos un documento cargado. */
  readonly requiereDocumento?: boolean;
}

/** El candidato presenta y subsana; no toca estados privilegiados. */
const TRANSICIONES_CANDIDATO: readonly TransicionExpediente[] = [
  { de: "draft", a: "submitted", requiereDocumento: true },
  { de: "needs_information", a: "submitted", requiereDocumento: true },
  { de: "reverification_required", a: "submitted", requiereDocumento: true },
];

/** Revisión administrativa, decisiones y reacciones a la suspensión. */
const TRANSICIONES_ADMINISTRADOR: readonly TransicionExpediente[] = [
  { de: "submitted", a: "under_review" },
  { de: "under_review", a: "needs_information", requiereMotivo: true },
  { de: "needs_information", a: "under_review" },
  { de: "under_review", a: "verification_scheduled", requiereMetodo: true },
  { de: "verification_scheduled", a: "under_review" },
  { de: "under_review", a: "approved", requiereMotivo: true, requiereMetodo: true },
  { de: "under_review", a: "rejected", requiereMotivo: true },
  { de: "approved", a: "suspended", requiereMotivo: true },
  { de: "approved", a: "reverification_required", requiereMotivo: true },
  { de: "approved", a: "expired", requiereMotivo: true },
  { de: "suspended", a: "under_review" },
  { de: "expired", a: "under_review" },
];

/** Sistema: únicamente la expiración por política de vigencia. */
const TRANSICIONES_SISTEMA: readonly TransicionExpediente[] = [
  { de: "approved", a: "expired", requiereMotivo: true },
];

export const TRANSICIONES_EXPEDIENTE_POR_ACTOR: Record<
  ActorExpediente,
  readonly TransicionExpediente[]
> = {
  candidato: TRANSICIONES_CANDIDATO,
  administrador: [...TRANSICIONES_ADMINISTRADOR, ...TRANSICIONES_SISTEMA],
  sistema: TRANSICIONES_SISTEMA,
};

export function esEstadoExpediente(valor: unknown): valor is EstadoExpediente {
  return typeof valor === "string" && (ESTADOS_EXPEDIENTE as readonly string[]).includes(valor);
}

export function esTransicionExpedienteValida(
  de: EstadoExpediente,
  a: EstadoExpediente,
  actor: ActorExpediente,
): boolean {
  if (de === a) {
    return false;
  }
  return TRANSICIONES_EXPEDIENTE_POR_ACTOR[actor].some((t) => t.de === de && t.a === a);
}

export interface DatosTransicionExpediente {
  readonly motivo?: string | null;
  readonly metodo?: string | null;
  readonly tieneDocumentos?: boolean;
}

export interface ResultadoValidacionExpediente {
  readonly valida: boolean;
  readonly razon?: string;
}

export function validarTransicionExpediente(
  de: EstadoExpediente,
  a: EstadoExpediente,
  actor: ActorExpediente,
  datos: DatosTransicionExpediente = {},
): ResultadoValidacionExpediente {
  const transicion = TRANSICIONES_EXPEDIENTE_POR_ACTOR[actor].find((t) => t.de === de && t.a === a);
  if (!transicion) {
    return {
      valida: false,
      razon: `La transición del expediente ${de} -> ${a} no está permitida para el actor ${actor}.`,
    };
  }
  if (transicion.requiereMotivo && !(datos.motivo ?? "").trim()) {
    return {
      valida: false,
      razon: "La decisión del expediente exige un motivo registrado.",
    };
  }
  if (transicion.requiereMetodo && !(datos.metodo ?? "").trim()) {
    return {
      valida: false,
      razon: "La decisión del expediente exige registrar el método de verificación.",
    };
  }
  if (transicion.requiereDocumento && datos.tieneDocumentos !== true) {
    return {
      valida: false,
      razon: "La presentación del expediente exige al menos un documento cargado.",
    };
  }
  return { valida: true };
}

/**
 * Regla de habilitación operativa (sección 8): un expediente aprobado solo
 * habilita si la cuenta sigue activa. La suspensión y la expiración bloquean.
 */
export function repartidorOperativo(
  estadoExpediente: EstadoExpediente,
  cuentaActiva: boolean,
): boolean {
  return estadoExpediente === "approved" && cuentaActiva;
}
