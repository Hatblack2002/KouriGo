/**
 * Auditoría de las operaciones privilegiadas de la Etapa 3.
 *
 * audit_logs no tiene política de INSERT: solo el service_role y el
 * propietario pueden registrar entradas, de modo que toda operación
 * privilegiada dejará constancia. Los metadatos no deben contener datos
 * personales ni el contenido de documentos (misma regla que los
 * safe_metadata del expediente).
 */
import type { Entorno } from "./config.ts";
import { rest } from "./rest.ts";

export interface RegistroAuditoria {
  readonly actorId: string;
  readonly accion: string;
  readonly tipoRecurso: string;
  readonly idRecurso: string;
  readonly metadatos?: Record<string, unknown>;
}

export async function registrarAuditoria(
  entorno: Entorno,
  registro: RegistroAuditoria,
): Promise<void> {
  await rest(
    entorno,
    "POST",
    "/rest/v1/audit_logs",
    {
      actor_id: registro.actorId,
      action: registro.accion,
      resource_type: registro.tipoRecurso,
      resource_id: registro.idRecurso,
      metadata: registro.metadatos ?? {},
    },
    { servicio: true },
  );
}
