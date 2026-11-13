/**
 * Detalle del expediente de verificación: documentos del bucket privado
 * (URLs firmadas por `documento-firmado`), revisión documento a documento y
 * decisiones del caso por la Edge Function `decision-verificacion` con el
 * motivo y el método que exige la matriz (trigger SQL los vuelve a imponer).
 * Etiquetas del diccionario de idiomas (README sección 9).
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
import { etiquetaDocumento, useIdioma } from "../idiomas";
import { formatearFecha } from "../formato";

interface Props {
  readonly cliente: SupabaseClient;
  readonly configuracion: ConfiguracionPublica;
  readonly sesion: SesionActiva;
  readonly casoId: string;
  readonly alVolver: () => void;
}

export function PantallaDetalleExpediente({
  cliente,
  configuracion,
  sesion,
  casoId,
  alVolver,
}: Props) {
  const { t, idioma } = useIdioma();
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
      setError(resCaso.error ?? t("no_caso_visible"));
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
  }, [cliente, casoId, t]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function nombreDe(usuarioId: string | null): string {
    if (usuarioId === null) {
      return t("sistema");
    }
    const perfil = perfiles.find((p) => p.id === usuarioId);
    if (perfil !== undefined && perfil.full_name !== null) {
      return perfil.full_name;
    }
    return `${usuarioId.slice(0, 8)}…`;
  }

  const opciones: DecesionOpcion[] = caso === null ? [] : decisionesAdminDisponibles(caso.status);

  async function aplicarDecision() {
    if (caso === null || opcionElegida === null) {
      return;
    }
    if (opcionElegida.requiereMotivo && motivo.trim().length === 0) {
      setError(t("err_motivo_decision"));
      return;
    }
    if (opcionElegida.requiereMetodo && metodo === "") {
      setError(t("err_metodo"));
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
        metodo: opcionElegida.requiereMetodo && metodo !== "" ? metodo : null,
      });
      if (!resultado.ok) {
        setError(resultado.mensajeError ?? `${t("err_funcion_estado")} ${resultado.estado}.`);
        return;
      }
      setAviso(`${t("ok_decision")} ${resultado.datos?.decision ?? "?"}.`);
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
        setError(resultado.mensajeError ?? `${t("err_funcion_estado")} ${resultado.estado}.`);
        return;
      }
      setUrlFirmada({ doc: documentoId, url: resultado.datos.url_firmada });
      setAviso(`${t("ok_url_firmada")} (${resultado.datos.expira_en_segundos} s).`);
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
        setError(resultado.mensajeError ?? `${t("err_funcion_estado")} ${resultado.estado}.`);
        return;
      }
      setAviso(estadoRevision === "accepted" ? t("ok_doc_aceptado") : t("ok_doc_rechazado"));
      setNotasDocumento("");
      await cargar();
    } finally {
      setOcupado(false);
    }
  }

  if (cargando) {
    return <Cargando texto={t("leyendo_expediente")} />;
  }

  if (caso === null) {
    return (
      <>
        <MensajeError mensaje={error} />
        <button className="secundario" onClick={alVolver}>
          {t("volver_lista")}
        </button>
      </>
    );
  }

  return (
    <>
      <button className="secundario" onClick={alVolver}>
        ← {t("volver_lista")}
      </button>
      <MensajeError mensaje={error} />
      <MensajeOk mensaje={aviso} />
      <Tarjeta titulo={`${t("expediente_titulo")} ${caso.id.slice(0, 8)}…`}>
        <dl className="ficha">
          <dt>{t("f_estado")}</dt>
          <dd>
            <InsigniaExpediente estado={caso.status} />
          </dd>
          <dt>{t("f_repartidor")}</dt>
          <dd>{nombreDe(caso.courier_user_id)}</dd>
          <dt>{t("f_presentado")}</dt>
          <dd>{formatearFecha(caso.submitted_at, idioma)}</dd>
          <dt>{t("f_revision_iniciada")}</dt>
          <dd>{formatearFecha(caso.review_started_at, idioma)}</dd>
          <dt>{t("f_decision")}</dt>
          <dd>{formatearFecha(caso.decision_at, idioma)}</dd>
          <dt>{t("f_motivo_decision")}</dt>
          <dd>{caso.decision_reason ?? "—"}</dd>
          <dt>{t("f_metodo_verificacion")}</dt>
          <dd>{caso.verification_method ?? "—"}</dd>
        </dl>
      </Tarjeta>
      {opciones.length > 0 ? (
        <Tarjeta titulo={t("decisiones_titulo")}>
          <div className="acciones">
            <div>
              <label>
                {t("f_decision")}
                <select
                  value={opcionElegida?.decision ?? ""}
                  onChange={(e) => {
                    const elegida = opciones.find((o) => o.decision === e.target.value) ?? null;
                    setOpcionElegida(elegida);
                  }}
                >
                  <option value="">{t("elegir_decision")}</option>
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
                  {t("metodo_comprobacion")}
                  <select
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value as MetodoVerificacion)}
                  >
                    <option value="">{t("elegir_metodo")}</option>
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
                  {t("motivo_label_expediente")}
                  <textarea
                    value={motivo}
                    maxLength={1000}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder={t("motivo_placeholder_decision")}
                  />
                </label>
              </div>
            ) : null}
            <button
              className="accion"
              disabled={ocupado || opcionElegida === null}
              onClick={() => void aplicarDecision()}
            >
              {t("aplicar_decision")}
            </button>
          </div>
          <p className="nota">{t("decisiones_nota")}</p>
        </Tarjeta>
      ) : (
        <SinDatos texto={t("sin_decisiones")} />
      )}
      <Tarjeta titulo={t("documentos_titulo")}>
        {documentos.length === 0 ? (
          <SinDatos texto={t("sin_documentos")} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("th_tipo")}</th>
                <th>{t("th_revision")}</th>
                <th>{t("th_notas")}</th>
                <th>{t("th_cargado")}</th>
                <th>{t("th_acciones")}</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((documento) => (
                <tr key={documento.id}>
                  <td>{etiquetaDocumento(idioma, documento.document_type)}</td>
                  <td>{documento.review_status}</td>
                  <td>{documento.review_notes ?? "—"}</td>
                  <td>{formatearFecha(documento.uploaded_at, idioma)}</td>
                  <td>
                    <div className="acciones">
                      <button
                        className="secundario"
                        disabled={ocupado}
                        onClick={() => void verDocumento(documento.id)}
                      >
                        {t("ver_url_firmada")}
                      </button>
                      <button
                        className="secundario"
                        disabled={ocupado}
                        onClick={() => void revisarDoc(documento.id, "accepted")}
                      >
                        {t("aceptar")}
                      </button>
                      <button
                        className="peligro"
                        disabled={ocupado}
                        onClick={() => void revisarDoc(documento.id, "rejected")}
                      >
                        {t("rechazar")}
                      </button>
                      {urlFirmada !== null && urlFirmada.doc === documento.id ? (
                        <a href={urlFirmada.url} target="_blank" rel="noreferrer">
                          {t("abrir_documento")}
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="nota">{t("documentos_nota")}</p>
      </Tarjeta>
      <Tarjeta titulo={t("historial_expediente_titulo")}>
        {eventos.length === 0 ? (
          <SinDatos texto={t("sin_eventos")} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("th_cuando")}</th>
                <th>{t("th_evento")}</th>
                <th>{t("th_transicion")}</th>
                <th>{t("th_actor")}</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((evento) => (
                <tr key={evento.id}>
                  <td>{formatearFecha(evento.occurred_at, idioma)}</td>
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
