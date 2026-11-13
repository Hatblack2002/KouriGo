/**
 * Expediente de verificación de repartidores para la consola (ADR-0004).
 *
 * Lecturas por PostgREST bajo RLS (el administrador ve todos los casos);
 * las decisiones pasan SIEMPRE por la Edge Function real
 * `decision-verificacion` (el trigger SQL y la función imponen los pares,
 * el motivo fresco y el método; ADR-0005) y la vista de documentos usa
 * `documento-firmado` para obtener URLs firmadas de corta duración del
 * bucket privado `courier-identity-private`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  METODOS_VERIFICACION,
  TRANSICIONES_EXPEDIENTE_POR_ACTOR,
  type EstadoExpediente,
  type MetodoVerificacion,
} from "@kourigo/domain";
import type { ConfiguracionPublica } from "../configuracion";
import {
  invocarFuncion,
  type RespuestaDecision,
  type RespuestaUrlFirmada,
  type ResultadoFuncion,
} from "../funciones";

export interface FilaCaso {
  readonly id: string;
  readonly courier_user_id: string;
  readonly status: string;
  readonly submitted_at: string | null;
  readonly review_started_at: string | null;
  readonly decision_at: string | null;
  readonly decision_reason: string | null;
  readonly verification_method: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface FilaDocumento {
  readonly id: string;
  readonly case_id: string;
  readonly document_type: string;
  readonly storage_bucket: string;
  readonly storage_path: string;
  readonly review_status: string;
  readonly review_notes: string | null;
  readonly uploaded_at: string;
}

export interface FilaEventoExpediente {
  readonly id: string;
  readonly case_id: string;
  readonly actor_user_id: string | null;
  readonly event_type: string;
  readonly from_status: string | null;
  readonly to_status: string | null;
  readonly safe_metadata: Record<string, unknown>;
  readonly occurred_at: string;
}

export interface DecesionOpcion {
  readonly decision: DecisionExpediente;
  readonly destino: EstadoExpediente;
  readonly requiereMotivo: boolean;
  readonly requiereMetodo: boolean;
}

export type DecisionExpediente =
  | "iniciar_revision"
  | "pedir_informacion"
  | "programar_verificacion"
  | "aprobar"
  | "rechazar"
  | "suspender"
  | "solicitar_reverificacion"
  | "expirar"
  | "revision_documento";

/** Lista los casos de verificación reales, con filtro opcional de estado. */
export async function listarCasos(
  cliente: SupabaseClient,
  filtroEstado: "todos" | EstadoExpediente,
  limite = 100,
): Promise<{ filas: FilaCaso[]; error: string | null }> {
  let consulta = cliente
    .from("courier_verification_cases")
    .select(
      "id,courier_user_id,status,submitted_at,review_started_at,decision_at," +
        "decision_reason,verification_method,created_at,updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(limite);
  if (filtroEstado !== "todos") {
    consulta = consulta.eq("status", filtroEstado);
  }
  const { data, error } = await consulta;
  if (error !== null) {
    return { filas: [], error: error.message };
  }
  return { filas: (data ?? []) as unknown as FilaCaso[], error: null };
}

export async function obtenerCaso(
  cliente: SupabaseClient,
  casoId: string,
): Promise<{ caso: FilaCaso | null; error: string | null }> {
  const { data, error } = await cliente
    .from("courier_verification_cases")
    .select(
      "id,courier_user_id,status,submitted_at,review_started_at,decision_at," +
        "decision_reason,verification_method,created_at,updated_at",
    )
    .eq("id", casoId)
    .maybeSingle();
  if (error !== null) {
    return { caso: null, error: error.message };
  }
  return { caso: (data as unknown as FilaCaso | null) ?? null, error: null };
}

export async function listarDocumentos(
  cliente: SupabaseClient,
  casoId: string,
): Promise<{ filas: FilaDocumento[]; error: string | null }> {
  const { data, error } = await cliente
    .from("courier_verification_documents")
    .select(
      "id,case_id,document_type,storage_bucket,storage_path,review_status," +
        "review_notes,uploaded_at",
    )
    .eq("case_id", casoId)
    .order("uploaded_at", { ascending: true });
  if (error !== null) {
    return { filas: [], error: error.message };
  }
  return { filas: (data ?? []) as unknown as FilaDocumento[], error: null };
}

export async function listarEventosCaso(
  cliente: SupabaseClient,
  casoId: string,
): Promise<{ filas: FilaEventoExpediente[]; error: string | null }> {
  const { data, error } = await cliente
    .from("courier_verification_events")
    .select("id,case_id,actor_user_id,event_type,from_status,to_status,safe_metadata,occurred_at")
    .eq("case_id", casoId)
    .order("occurred_at", { ascending: true });
  if (error !== null) {
    return { filas: [], error: error.message };
  }
  return { filas: (data ?? []) as unknown as FilaEventoExpediente[], error: null };
}

/**
 * Decisiones que el ADMINISTRADOR puede aplicar sobre el estado actual del
 * caso, según la matriz compartida de @kourigo/domain (la misma del trigger
 * y de la función). Las claves de DECISIONES_EXPEDIENTE de la Edge Function
 * corresponden al destino: iniciar_revision→under_review,
 * pedir_informacion→needs_information, programar_verificacion→
 * verification_scheduled, aprobar→approved, rechazar→rejected,
 * suspender→suspended, solicitar_reverificacion→reverification_required,
 * expirar→expired. Función pura, probada sin red.
 */
const DECISION_POR_DESTINO: Partial<Record<EstadoExpediente, DecisionExpediente>> = {
  under_review: "iniciar_revision",
  needs_information: "pedir_informacion",
  verification_scheduled: "programar_verificacion",
  approved: "aprobar",
  rejected: "rechazar",
  suspended: "suspender",
  reverification_required: "solicitar_reverificacion",
  expired: "expirar",
};

export function decisionesAdminDisponibles(estadoActual: string): DecesionOpcion[] {
  const opciones: DecesionOpcion[] = [];
  // La matriz administrativa contiene pares repetidos (el espejo del
  // sistema duplica approved -> expired): una decisión por destino.
  const vistas = new Set<string>();
  for (const transicion of TRANSICIONES_EXPEDIENTE_POR_ACTOR.administrador) {
    if (transicion.de !== estadoActual || vistas.has(transicion.a)) {
      continue;
    }
    const decision = DECISION_POR_DESTINO[transicion.a];
    if (decision === undefined) {
      continue;
    }
    vistas.add(transicion.a);
    opciones.push({
      decision,
      destino: transicion.a,
      requiereMotivo: transicion.requiereMotivo === true,
      requiereMetodo: transicion.requiereMetodo === true,
    });
  }
  return opciones;
}

export interface CuerpoDecision {
  readonly casoId: string;
  readonly decision: DecisionExpediente;
  readonly motivo: string | null;
  readonly metodo: MetodoVerificacion | null;
}

/**
 * Aplica una decisión del expediente vía la Edge Function real
 * `decision-verificacion` con el JWT del administrador.
 */
export async function decidirExpediente(
  configuracion: ConfiguracionPublica,
  accessToken: string,
  cuerpo: CuerpoDecision,
): Promise<ResultadoFuncion<RespuestaDecision>> {
  const datos: Record<string, unknown> = {
    caso_id: cuerpo.casoId,
    decision: cuerpo.decision,
  };
  if (cuerpo.motivo !== null && cuerpo.motivo.trim().length > 0) {
    datos["motivo"] = cuerpo.motivo.trim();
  }
  if (cuerpo.metodo !== null) {
    datos["metodo"] = cuerpo.metodo;
  }
  return invocarFuncion<RespuestaDecision>(
    configuracion,
    accessToken,
    "decision-verificacion",
    datos,
  );
}

export interface CuerpoRevisionDocumento {
  readonly casoId: string;
  readonly documentoId: string;
  readonly estadoRevision: "accepted" | "rejected";
  readonly notas: string | null;
}

/** Revisión de un documento concreto vía la misma función (ADR-0005). */
export async function revisarDocumento(
  configuracion: ConfiguracionPublica,
  accessToken: string,
  cuerpo: CuerpoRevisionDocumento,
): Promise<ResultadoFuncion<RespuestaDecision>> {
  const datos: Record<string, unknown> = {
    caso_id: cuerpo.casoId,
    decision: "revision_documento",
    documento_id: cuerpo.documentoId,
    estado_revision: cuerpo.estadoRevision,
  };
  if (cuerpo.notas !== null && cuerpo.notas.trim().length > 0) {
    datos["notas"] = cuerpo.notas.trim();
  }
  return invocarFuncion<RespuestaDecision>(
    configuracion,
    accessToken,
    "decision-verificacion",
    datos,
  );
}

/** URL firmada de corta duración del documento (bucket privado). */
export async function pedirUrlFirmada(
  configuracion: ConfiguracionPublica,
  accessToken: string,
  documentoId: string,
): Promise<ResultadoFuncion<RespuestaUrlFirmada>> {
  return invocarFuncion<RespuestaUrlFirmada>(configuracion, accessToken, "documento-firmado", {
    documento_id: documentoId,
  });
}

/** Métodos de verificación admitidos (para el selector de la UI). */
export function metodosVerificacion(): readonly MetodoVerificacion[] {
  return METODOS_VERIFICACION;
}
