/**
 * Panel y pantalla de detalle del expediente de verificación: documentos del
 * bucket privado (URLs firmadas por `documento-firmado`), revisión documento a
 * documento y decisiones del caso por la Edge Function `decision-verificacion`
 * con el motivo y el método que exige la matriz (trigger SQL los vuelve a
 * imponer). Sin datos simulados.
 */
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetodoVerificacion } from "@kourigo/domain";
import type { ConfiguracionPublica } from "../configuracion";
import type { SesionActiva } from "../auth";
import {
  decidirExpediente,
  decisionesAdminDisponibles,
  listarDocumentos,
  listarEventosCaso,
  metodosVerificacion,
  obtenerCaso,
  pedirUrlFirmada,
  revisarDocumento,
  type DecesionOpcion,
  type FilaCaso,
  type FilaDocumento,
  type FilaEventoExpediente,
} from "../api/expediente";
import { listarPerfiles, type FilaPerfil } from "../api/perfiles";
import { Cargando, InsigniaExpediente, MensajeError, MensajeOk, SinDatos } from "../componentes";
import { formatearFecha } from "../formato";
import {
  IconoAlerta,
  IconoAprobado,
  IconoCalendario,
  IconoCandado,
  IconoCerrar,
  IconoCheckCirculo,
  IconoCorreo,
  IconoDocumento,
  IconoHistorial,
  IconoPresencial,
  IconoTelefono,
  IconoUsuario,
  IconoVideo,
} from "../iconos";
import { etiquetaDocumento, useIdioma } from "../idiomas";

interface PropsPanel {
  readonly cliente: SupabaseClient;
  readonly configuracion: ConfiguracionPublica;
  readonly sesion: SesionActiva;
  readonly casoId: string;
  readonly nombreAdministrador?: string | null;
  readonly alActualizarLista?: () => void;
}

export function PanelDetalleExpediente({
  cliente,
  configuracion,
  sesion,
  casoId,
  nombreAdministrador,
  alActualizarLista,
}: PropsPanel) {
  const { t, idioma } = useIdioma();
  const [caso, setCaso] = useState<FilaCaso | null>(null);
  const [documentos, setDocumentos] = useState<FilaDocumento[]>([]);
  const [eventos, setEventos] = useState<FilaEventoExpediente[]>([]);
  const [perfiles, setPerfiles] = useState<FilaPerfil[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
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
    if (
      resCaso.caso.verification_method === "documental" ||
      resCaso.caso.verification_method === "videoconferencia" ||
      resCaso.caso.verification_method === "presencial"
    ) {
      setMetodo(resCaso.caso.verification_method);
    } else {
      setMetodo("");
    }
    if (resDocs.error !== null) {
      setError(resDocs.error);
    }
    setCargando(false);
  }, [cliente, casoId, t]);

  useEffect(() => {
    setUrlFirmada(null);
    setMotivo("");
    setNotasDocumento("");
    setAviso(null);
    void cargar();
  }, [cargar]);

  function perfilDe(usuarioId: string): FilaPerfil | undefined {
    return perfiles.find((p) => p.id === usuarioId);
  }

  function nombreDe(usuarioId: string | null): string {
    if (usuarioId === null) {
      return t("sistema");
    }
    const perfil = perfilDe(usuarioId);
    if (perfil !== undefined && perfil.full_name !== null && perfil.full_name.trim().length > 0) {
      return perfil.full_name;
    }
    return `${usuarioId.slice(0, 8)}…`;
  }

  const opciones: DecesionOpcion[] = caso === null ? [] : decisionesAdminDisponibles(caso.status);
  const requiereAlgunMotivo = opciones.some((o) => o.requiereMotivo);
  const requiereAlgunMetodo = opciones.some((o) => o.requiereMetodo);

  async function aplicarDecision(opcion: DecesionOpcion) {
    if (caso === null) {
      return;
    }
    if (opcion.requiereMotivo && motivo.trim().length === 0) {
      setError(t("err_motivo_decision"));
      return;
    }
    if (opcion.requiereMetodo && metodo === "") {
      setError(t("err_metodo"));
      return;
    }
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      const resultado = await decidirExpediente(configuracion, sesion.accessToken, {
        casoId: caso.id,
        decision: opcion.decision,
        motivo: opcion.requiereMotivo ? motivo : null,
        metodo: opcion.requiereMetodo && metodo !== "" ? metodo : null,
      });
      if (!resultado.ok) {
        setError(resultado.mensajeError ?? `${t("err_funcion_estado")} ${resultado.estado}.`);
        return;
      }
      setAviso(`${t("ok_decision")} ${resultado.datos?.decision ?? "?"}.`);
      setMotivo("");
      await cargar();
      alActualizarLista?.();
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
      alActualizarLista?.();
    } finally {
      setOcupado(false);
    }
  }

  function etiquetaMetodo(m: MetodoVerificacion): string {
    if (m === "documental") {
      return t("metodo_documental");
    }
    if (m === "videoconferencia") {
      return t("metodo_videoconferencia");
    }
    return t("metodo_presencial");
  }

  function etiquetaDecisionBoton(decision: DecesionOpcion["decision"]): string {
    switch (decision) {
      case "iniciar_revision":
        return t("accion_iniciar_revision");
      case "pedir_informacion":
        return t("accion_pedir_info");
      case "programar_verificacion":
        return t("accion_programar_verif");
      case "aprobar":
        return t("accion_aprobar_livreur");
      case "rechazar":
        return t("accion_rechazar_dossier");
      case "suspender":
        return t("accion_suspender");
      case "solicitar_reverificacion":
        return t("accion_reverificacion");
      case "expirar":
        return t("accion_expirar");
      default:
        return decision;
    }
  }

  if (cargando) {
    return (
      <section className="tarjeta detalle-expediente-panel">
        <Cargando texto={t("leyendo_expediente")} />
      </section>
    );
  }

  if (caso === null) {
    return (
      <section className="tarjeta detalle-expediente-panel">
        <MensajeError mensaje={error} />
      </section>
    );
  }

  const perfilCourier = perfilDe(caso.courier_user_id);
  const nombreCourier = nombreDe(caso.courier_user_id);

  return (
    <section className="tarjeta detalle-expediente-panel">
      <MensajeError mensaje={error} />
      <MensajeOk mensaje={aviso} />

      {/* Cabecera del expediente */}
      <div className="expediente-cabecera">
        <div className="expediente-persona">
          <div className="avatar-grande">
            <IconoUsuario width={24} height={24} />
          </div>
          <div className="expediente-persona-meta">
            <div className="expediente-nombre-fila">
              <h2>{nombreCourier}</h2>
              <InsigniaExpediente estado={caso.status} />
            </div>
            <span className="expediente-id">KG-{caso.id.slice(0, 6).toUpperCase()}</span>
            <div className="expediente-contacto">
              {perfilCourier?.phone !== null &&
              perfilCourier?.phone !== undefined &&
              perfilCourier.phone.trim().length > 0 ? (
                <span className="meta-dato">
                  <IconoTelefono />
                  <span>{perfilCourier.phone}</span>
                </span>
              ) : null}
              <span className="meta-dato">
                <IconoCalendario />
                <span>
                  {t("f_presentado")}:{" "}
                  {formatearFecha(caso.submitted_at ?? caso.created_at, idioma)}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Documentos sometidos */}
      <div className="expediente-bloque">
        <div className="bloque-titulo-fila">
          <IconoDocumento />
          <h3>{t("documentos_titulo")}</h3>
        </div>

        {documentos.length === 0 ? (
          <SinDatos texto={t("sin_documentos")} />
        ) : (
          <div className="documentos-rejilla">
            {documentos.map((documento) => {
              const aceptado = documento.review_status === "accepted";
              const rechazado = documento.review_status === "rejected";
              const firmadoActivo = urlFirmada !== null && urlFirmada.doc === documento.id;
              return (
                <article key={documento.id} className="documento-tarjeta">
                  <div className="documento-cabecera">
                    <span className="documento-tipo">
                      {etiquetaDocumento(idioma, documento.document_type)}
                    </span>
                    <span className="documento-fecha">
                      {formatearFecha(documento.uploaded_at, idioma)}
                    </span>
                  </div>

                  <div className="documento-visor">
                    {firmadoActivo ? (
                      <a
                        href={urlFirmada.url}
                        target="_blank"
                        rel="noreferrer"
                        className="documento-enlace-firmado"
                      >
                        <IconoDocumento />
                        <span>{t("abrir_documento")}</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="documento-pedir-url"
                        disabled={ocupado}
                        onClick={() => void verDocumento(documento.id)}
                      >
                        <IconoCandado />
                        <span>{t("ver_url_firmada")}</span>
                      </button>
                    )}
                  </div>

                  <div
                    className={`documento-estado-fila ${
                      aceptado ? "doc-ok" : rechazado ? "doc-bad" : "doc-warn"
                    }`}
                  >
                    {aceptado ? (
                      <IconoCheckCirculo />
                    ) : rechazado ? (
                      <IconoCerrar />
                    ) : (
                      <IconoAlerta />
                    )}
                    <span>
                      {aceptado
                        ? t("doc_estado_accepted")
                        : rechazado
                          ? t("doc_estado_rejected")
                          : t("doc_estado_pending")}
                    </span>
                  </div>

                  {documento.review_notes !== null && documento.review_notes.trim().length > 0 ? (
                    <p className="documento-nota">{documento.review_notes}</p>
                  ) : null}

                  <div className="documento-acciones">
                    <button
                      type="button"
                      className="btn-mini-ok"
                      disabled={ocupado}
                      onClick={() => void revisarDoc(documento.id, "accepted")}
                    >
                      {t("aceptar")}
                    </button>
                    <button
                      type="button"
                      className="btn-mini-bad"
                      disabled={ocupado}
                      onClick={() => void revisarDoc(documento.id, "rejected")}
                    >
                      {t("rechazar")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {documentos.length > 0 ? (
          <div className="documento-notas-campo">
            <label>
              <span>{t("th_notas")}</span>
              <input
                type="text"
                value={notasDocumento}
                onChange={(e) => setNotasDocumento(e.target.value)}
                placeholder={t("documentos_nota")}
              />
            </label>
          </div>
        ) : null}
      </div>

      {/* Método de verificación */}
      <div className="expediente-bloque">
        <div className="bloque-titulo-fila">
          <IconoCheckCirculo />
          <h3>{t("metodo_comprobacion")}</h3>
        </div>
        <div className="metodos-fila">
          {metodosVerificacion().map((m) => {
            const seleccionado = metodo === m;
            return (
              <button
                key={m}
                type="button"
                className={seleccionado ? "metodo-boton activo" : "metodo-boton"}
                onClick={() => setMetodo(m)}
                disabled={ocupado || (!requiereAlgunMetodo && opciones.length === 0)}
              >
                {m === "documental" ? (
                  <IconoDocumento />
                ) : m === "videoconferencia" ? (
                  <IconoVideo />
                ) : (
                  <IconoPresencial />
                )}
                <span>{etiquetaMetodo(m)}</span>
                {seleccionado ? (
                  <span className="metodo-check">
                    <IconoCheckCirculo />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Revisor asignado + Historial de acciones */}
      <div className="expediente-grid-inferior">
        <div className="expediente-revisor-columna">
          <div className="revisor-tarjeta">
            <span className="avatar-revisor">
              <IconoUsuario width={16} height={16} />
            </span>
            <div>
              <span className="revisor-etiqueta">{t("revisor_asignado")}</span>
              <strong className="revisor-nombre">
                {nombreAdministrador ?? sesion.correo ?? t("administrador_rol")}
              </strong>
            </div>
          </div>

          {requiereAlgunMotivo ? (
            <label className="motivo-campo">
              <span>{t("motivo_label_expediente")}</span>
              <textarea
                value={motivo}
                maxLength={1000}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder={t("motivo_placeholder_decision")}
              />
            </label>
          ) : null}
        </div>

        <div className="expediente-historial-columna">
          <div className="bloque-titulo-fila">
            <IconoHistorial />
            <h3>{t("historial_expediente_titulo")}</h3>
          </div>
          {eventos.length === 0 ? (
            <SinDatos texto={t("sin_eventos")} />
          ) : (
            <ul className="timeline-admin">
              {eventos.map((evento) => (
                <li key={evento.id} className="timeline-admin-item">
                  <span className="timeline-punto" aria-hidden="true" />
                  <div className="timeline-contenido">
                    <span className="timeline-fecha">
                      {formatearFecha(evento.occurred_at, idioma)}
                    </span>
                    <span className="timeline-evento">
                      {evento.event_type}
                      {evento.to_status !== null ? ` (${evento.to_status})` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Seguridad y botones de decisión */}
      <div className="expediente-pie">
        <div className="pill-privacidad">
          <IconoCandado />
          <span>{t("docs_privados_nota")}</span>
        </div>

        {opciones.length > 0 ? (
          <div className="decisiones-barra">
            {opciones.map((opcion) => {
              const esAprobar = opcion.decision === "aprobar";
              const esPeligro = opcion.decision === "rechazar" || opcion.decision === "suspender";
              const clase = esAprobar
                ? "btn-decision-aprobar"
                : esPeligro
                  ? "btn-decision-rechazar"
                  : "btn-decision-secundaria";
              return (
                <button
                  key={opcion.decision}
                  type="button"
                  className={clase}
                  disabled={ocupado}
                  onClick={() => void aplicarDecision(opcion)}
                >
                  {esAprobar ? (
                    <IconoAprobado width={15} height={15} />
                  ) : esPeligro ? (
                    <IconoCerrar />
                  ) : opcion.decision === "pedir_informacion" ? (
                    <IconoCorreo />
                  ) : null}
                  <span>{etiquetaDecisionBoton(opcion.decision)}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <SinDatos texto={t("sin_decisiones")} />
        )}
      </div>
    </section>
  );
}

interface PropsPantalla {
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
}: PropsPantalla) {
  const { t } = useIdioma();
  return (
    <div className="detalle-standalone">
      <button type="button" className="secundario" onClick={alVolver}>
        ← {t("volver_lista")}
      </button>
      <PanelDetalleExpediente
        cliente={cliente}
        configuracion={configuracion}
        sesion={sesion}
        casoId={casoId}
      />
    </div>
  );
}
