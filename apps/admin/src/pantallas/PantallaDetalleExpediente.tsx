/**
 * Detalle del expediente de verificación: documentos del bucket privado
 * (URLs firmadas por `documento-firmado`), revisión documento a documento y
 * decisiones del caso por la Edge Function `decision-verificacion` con el
 * motivo y el método que exige la matriz (trigger SQL los vuelve a imponer).
 */
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetodoVerificacion } from "@kourigo/domain";
import type { ConfiguracionPublica } from "../configuracion";
import type { SesionActiva } from "../auth";
import {
  decidirExpediente,
  listarDocumentos,
  listarEventosCaso,
  metodosVerificacion,
  obtenerCaso,
  pedirUrlFirmada,
  decisionesAdminDisponibles,
  revisarDocumento,
  type DecesionOpcion,
  type FilaCaso,
  type FilaDocumento,
  type FilaEventoExpediente,
} from "../api/expediente";
import { listarPerfiles, type FilaPerfil } from "../api/perfiles";
import {
  Cargando,
  InsigniaExpediente,
  MensajeError,
  MensajeOk,
  SinDatos,
  Tarjeta,
} from "../componentes";
import { formatearFecha } from "../formato";

interface Props {
  readonly cliente: SupabaseClient;
  readonly configuracion: ConfiguracionPublica;
  readonly sesion: SesionActiva;
  readonly casoId: string;
  readonly alVolver: () => void;
}

const NOMBRES_DOCUMENTO: Record<string, string> = {
  national_id_front: "cédula (anverso)",
  national_id_back: "cédula (reverso)",
  passport: "pasaporte",
  selfie: "selfie",
  certificate_good_conduct: "certificat de bonnes vie et mœurs",
  driver_license: "permis de conduire",
};

export function PantallaDetalleExpediente({
  cliente,
  configuracion,
  sesion,
  casoId,
  alVolver,
}: Props) {
  const [caso, setCaso] = useState<FilaCaso | null>(null);
  const [documentos, setDocumentos] = useState<FilaDocumento[]>([]);
  const [eventos, setEventos] = useState<FilaEventoExpediente[]>([]);
  const [perfiles, setPerfiles] = useState<FilaPerfil[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [opcionElegida, setOpcionElegida] = useState<DecesionOpcion | null>(null);
  const [motivo, setMotivo] = useState("");
  const [metodo, setMetodo] = useState<MetodoVerificacion | "">("");
  const [urlFirmada, setUrlFirmada] = useState<{ doc: string; url: string } | null>(null);
  const [notasDocumento, setNotasDocumento] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const resCaso = await obtenerCaso(cliente, casoId);
    if (resCaso.error !== null || resCaso.caso === null) {
      setError(resCaso.error ?? "El caso no existe o no es visible para tu sesión.");
      setCaso(null);
      setCargando(false);
      return;
    }
    const [resDocs, resEventos, resPerfiles] = await Promise.all([
      listarDocumentos(cliente, casoId),
      listarEventosCaso(cliente, casoId),
      listarPerfiles(cliente),
    ]);
    setCaso(resCaso.caso);
    setDocumentos(resDocs.filas);
    setEventos(resEventos.filas);
    setPerfiles(resPerfiles.filas);
    if (resDocs.error !== null) {
      setError(resDocs.error);
    }
    setCargando(false);
  }, [cliente, casoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function nombreDe(usuarioId: string | null): string {
    if (usuarioId === null) {
      return "sistema";
    }
    const perfil = perfiles.find((p) => p.id === usuarioId);
    if (perfil !== undefined && perfil.full_name !== null) {
      return perfil.full_name;
    }
    return `${usuarioId.slice(0, 8)}…`;
  }

  const opciones: DecesionOpcion[] =
    caso === null ? [] : decisionesAdminDisponibles(caso.status);

  async function aplicarDecision() {
    if (caso === null || opcionElegida === null) {
      return;
    }
    if (opcionElegida.requiereMotivo && motivo.trim().length === 0) {
      setError("La decisión exige un motivo registrado.");
      return;
    }
    if (opcionElegida.requiereMetodo && metodo === "") {
      setError("La decisión exige registrar el método de verificación.");
      return;
    }
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      const resultado = await decidirExpediente(configuracion, sesion.accessToken, {
        casoId: caso.id,
        decision: opcionElegida.decision,
        motivo: opcionElegida.requiereMotivo ? motivo : null,
        metodo: opcionElegida.requiereMetodo ? metodo : null,
      });
      if (!resultado.ok) {
        setError(resultado.mensajeError ?? `La función respondió ${resultado.estado}.`);
        return;
      }
      setAviso(`Decisión aplicada: ${resultado.datos?.decision ?? "?"}.`);
      setOpcionElegida(null);
      setMotivo("");
      setMetodo("");
      await cargar();
    } finally {
      setOcupado(false);
    }
  }

  async function verDocumento(documentoId: string) {
    setError(null);
    setAviso(null);
    setUrlFirmada(null);
    setOcupado(true);
    try {
      const resultado = await pedirUrlFirmada(configuracion, sesion.accessToken, documentoId);
      if (!resultado.ok || resultado.datos === null) {
        setError(resultado.mensajeError ?? `La función respondió ${resultado.estado}.`);
        return;
      }
      setUrlFirmada({ doc: documentoId, url: resultado.datos.url_firmada });
      setAviso(
        `URL firmada emitida (${resultado.datos.expira_en_segundos} s de vigencia).`,
      );
    } finally {
      setOcupado(false);
    }
  }

  async function revisarDoc(documentoId: string, estadoRevision: "accepted" | "rejected") {
    if (caso === null) {
      return;
    }
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      const resultado = await revisarDocumento(configuracion, sesion.accessToken, {
        casoId: caso.id,
        documentoId,
        estadoRevision,
        notas: notasDocumento.trim().length > 0 ? notasDocumento.trim() : null,
      });
      if (!resultado.ok) {
        setError(resultado.mensajeError ?? `La función respondió ${resultado.estado}.`);
        return;
      }
      setAviso(
        `Documento marcado como ${estadoRevision === "accepted" ? "aceptado" : "rechazado"}.`,
      );
      setNotasDocumento("");
      await cargar();
    } finally {
      setOcupado(false);
    }
  }

  if (cargando) {
    return <Cargando texto="Leyendo el expediente real…" />;
  }

  if (caso === null) {
    return (
      <>
        <MensajeError mensaje={error} />
        <button className="secundario" onClick={alVolver}>
          Volver a la lista
        </button>
      </>
    );
  }

  return (
    <>
      <button className="secundario" onClick={alVolver}>
        ← Volver a la lista
      </button>
      <MensajeError mensaje={error} />
      <MensajeOk mensaje={aviso} />
      <Tarjeta titulo={`Expediente ${caso.id.slice(0, 8)}…`}>
        <dl className="ficha">
          <dt>Estado</dt>
          <dd>
            <InsigniaExpediente estado={caso.status} />
          </dd>
          <dt>Repartidor</dt>
          <dd>{nombreDe(caso.courier_user_id)}</dd>
          <dt>Presentado</dt>
          <dd>{formatearFecha(caso.submitted_at)}</dd>
          <dt>Revisión iniciada</dt>
          <dd>{formatearFecha(caso.review_started_at)}</dd>
          <dt>Decisión</dt>
          <dd>{formatearFecha(caso.decision_at)}</dd>
          <dt>Motivo de la decisión</dt>
          <dd>{caso.decision_reason ?? "—"}</dd>
          <dt>Método de verificación</dt>
          <dd>{caso.verification_method ?? "—"}</dd>
        </dl>
      </Tarjeta>
      {opciones.length > 0 ? (
        <Tarjeta titulo="Decisiones disponibles">
          <div className="acciones">
            <div>
              <label>
                Decisión
                <select
                  value={opcionElegida?.decision ?? ""}
                  onChange={(e) => {
                    const elegida =
                      opciones.find((o) => o.decision === e.target.value) ?? null;
                    setOpcionElegida(elegida);
                  }}
                >
                  <option value="">— elegir decisión —</option>
                  {opciones.map((opcion) => (
                    <option key={opcion.decision} value={opcion.decision}>
                      {opcion.decision} → {opcion.destino}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {opcionElegida !== null && opcionElegida.requiereMetodo ? (
              <div>
                <label>
                  Método de comprobación
                  <select
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value as MetodoVerificacion)}
                  >
                    <option value="">— elegir método —</option>
                    {metodosVerificacion().map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            {opcionElegida !== null && opcionElegida.requiereMotivo ? (
              <div>
                <label>
                  Motivo (obligatorio)
                  <textarea
                    value={motivo}
                    maxLength={1000}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Justificación de la decisión"
                  />
                </label>
              </div>
            ) : null}
            <button
              className="accion"
              disabled={ocupado || opcionElegida === null}
              onClick={() => void aplicarDecision()}
            >
              Aplicar decisión
            </button>
          </div>
          <p className="nota">
            Las decisiones pasan SIEMPRE por la función `decision-verificacion`: los
            pares, el motivo fresco y el método los impone también el trigger SQL; los
            eventos del expediente quedan con el actor real.
          </p>
        </Tarjeta>
      ) : (
        <SinDatos
          texto="Este caso no admite más decisiones administrativas en su estado actual."
        />
      )}
      <Tarjeta titulo="Documentos del expediente (bucket privado)">
        {documentos.length === 0 ? (
          <SinDatos texto="El expediente no tiene documentos cargados." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Revisión</th>
                <th>Notas</th>
                <th>Cargado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((documento) => (
                <tr key={documento.id}>
                  <td>{NOMBRES_DOCUMENTO[documento.document_type] ?? documento.document_type}</td>
                  <td>{documento.review_status}</td>
                  <td>{documento.review_notes ?? "—"}</td>
                  <td>{formatearFecha(documento.uploaded_at)}</td>
                  <td>
                    <div className="acciones">
                      <button
                        className="secundario"
                        disabled={ocupado}
                        onClick={() => void verDocumento(documento.id)}
                      >
                        Ver (URL firmada)
                      </button>
                      <button
                        className="secundario"
                        disabled={ocupado}
                        onClick={() => void revisarDoc(documento.id, "accepted")}
                      >
                        Aceptar
                      </button>
                      <button
                        className="peligro"
                        disabled={ocupado}
                        onClick={() => void revisarDoc(documento.id, "rejected")}
                      >
                        Rechazar
                      </button>
                      {urlFirmada !== null && urlFirmada.doc === documento.id ? (
                        <a href={urlFirmada.url} target="_blank" rel="noreferrer">
                          abrir documento
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="nota">
          Las notas escritas arriba se aplican a la siguiente revisión de documento
          (aceptar o rechazar). La emisión de cada URL firmada queda registrada en la
          auditoría; los enlaces caducan en 5 minutos.
        </p>
      </Tarjeta>
      <Tarjeta titulo="Historial del expediente">
        {eventos.length === 0 ? (
          <SinDatos texto="Sin eventos registrados." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Cuando</th>
                <th>Evento</th>
                <th>Transición</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((evento) => (
                <tr key={evento.id}>
                  <td>{formatearFecha(evento.occurred_at)}</td>
                  <td>{evento.event_type}</td>
                  <td>
                    {evento.from_status ?? "—"} → {evento.to_status ?? "—"}
                  </td>
                  <td>{nombreDe(evento.actor_user_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tarjeta>
    </>
  );
}
