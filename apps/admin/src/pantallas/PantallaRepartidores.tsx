/**
 * Verificación de repartidores (maqueta aprobada): tres KPIs reales en la
 * parte superior («En attente», «En cours», «Approuvés»), lista buscable a la
 * izquierda y panel de revisión documental / decisiones a la derecha.
 * Si no hay solicitudes en la base de datos, todas las cifras muestran 0 real.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESTADOS_EXPEDIENTE, type EstadoExpediente } from "@kourigo/domain";
import type { SesionActiva } from "../auth";
import type { ConfiguracionPublica } from "../configuracion";
import { listarCasos, type FilaCaso } from "../api/expediente";
import { listarPerfiles, type FilaPerfil } from "../api/perfiles";
import { Cargando, InsigniaExpediente, MensajeError } from "../componentes";
import { formatearFecha } from "../formato";
import {
  IconoAprobado,
  IconoBuscar,
  IconoCalendario,
  IconoChevronDerecha,
  IconoEnCurso,
  IconoReloj,
  IconoUsuario,
  IconoVerificacion,
} from "../iconos";
import { etiquetaEstadoExpediente, useIdioma } from "../idiomas";
import { PanelDetalleExpediente } from "./PantallaDetalleExpediente";

type FiltroCaso = "todos" | EstadoExpediente;

interface PropsRepartidores {
  readonly cliente: SupabaseClient;
  readonly configuracion: ConfiguracionPublica;
  readonly sesion: SesionActiva;
  readonly nombreAdministrador: string | null;
  readonly alAbrirCaso?: (id: string) => void;
}

export function PantallaRepartidores({
  cliente,
  configuracion,
  sesion,
  nombreAdministrador,
}: PropsRepartidores) {
  const { t, idioma } = useIdioma();
  const [filtro, setFiltro] = useState<FiltroCaso>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [todosCasos, setTodosCasos] = useState<FilaCaso[]>([]);
  const [perfiles, setPerfiles] = useState<FilaPerfil[]>([]);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const [resCasos, resPerfiles] = await Promise.all([
      listarCasos(cliente, "todos", 200),
      listarPerfiles(cliente),
    ]);
    if (resCasos.error !== null) {
      setError(resCasos.error);
      setTodosCasos([]);
    } else {
      setTodosCasos(resCasos.filas);
      setError(resPerfiles.error);
      setPerfiles(resPerfiles.filas);
      setSeleccionadoId((prev) => {
        if (prev !== null && resCasos.filas.some((c) => c.id === prev)) {
          return prev;
        }
        return resCasos.filas[0]?.id ?? null;
      });
    }
    setCargando(false);
  }, [cliente]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function nombreDe(usuarioId: string): string {
    const perfil = perfiles.find((p) => p.id === usuarioId);
    if (perfil !== undefined && perfil.full_name !== null && perfil.full_name.trim().length > 0) {
      return perfil.full_name;
    }
    return `${usuarioId.slice(0, 8)}…`;
  }

  const kpis = useMemo(() => {
    let enAttente = 0;
    let enCours = 0;
    let approuves = 0;
    for (const c of todosCasos) {
      if (c.status === "submitted" || c.status === "needs_information" || c.status === "draft") {
        enAttente += 1;
      } else if (
        c.status === "under_review" ||
        c.status === "verification_scheduled" ||
        c.status === "reverification_required"
      ) {
        enCours += 1;
      } else if (c.status === "approved") {
        approuves += 1;
      }
    }
    return { enAttente, enCours, approuves };
  }, [todosCasos]);

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return todosCasos.filter((caso) => {
      if (filtro !== "todos" && caso.status !== filtro) {
        return false;
      }
      if (termino.length === 0) {
        return true;
      }
      const perfil = perfiles.find((p) => p.id === caso.courier_user_id);
      const nombre = (perfil?.full_name ?? "").toLowerCase();
      const codigo = `kg-${caso.id.slice(0, 6)}`.toLowerCase();
      return (
        nombre.includes(termino) ||
        codigo.includes(termino) ||
        caso.id.toLowerCase().includes(termino)
      );
    });
  }, [todosCasos, filtro, busqueda, perfiles]);

  return (
    <div className="verificacion-vista">
      {/* 3 KPIs reales (0 cuando no hay casos registrados) */}
      <div className="kpi-fila-3">
        <article className="kpi-tarjeta acento-verde">
          <div className="kpi-icono fondo-menta">
            <IconoReloj />
          </div>
          <div className="kpi-datos">
            <span className="kpi-etiqueta">{t("kpi_en_atant")}</span>
            <strong className="kpi-valor">{kpis.enAttente}</strong>
          </div>
        </article>

        <article className="kpi-tarjeta acento-azul">
          <div className="kpi-icono fondo-azul">
            <IconoEnCurso />
          </div>
          <div className="kpi-datos">
            <span className="kpi-etiqueta">{t("kpi_en_cours")}</span>
            <strong className="kpi-valor">{kpis.enCours}</strong>
          </div>
        </article>

        <article className="kpi-tarjeta acento-verde-fuerte">
          <div className="kpi-icono fondo-menta">
            <IconoAprobado />
          </div>
          <div className="kpi-datos">
            <span className="kpi-etiqueta">{t("kpi_apwouve")}</span>
            <strong className="kpi-valor">{kpis.approuves}</strong>
          </div>
        </article>
      </div>

      <MensajeError mensaje={error} />

      {/* Maestro-detalle: Lista des demandes | Detalle del caso */}
      <div className="verificacion-split">
        <section className="tarjeta lista-demandas-tarjeta">
          <div className="lista-demandas-cabecera">
            <h2>{t("lista_demandas")}</h2>
            <span className="contador-pill">{filasFiltradas.length}</span>
          </div>

          <div className="lista-filtros-fila">
            <div className="campo-busqueda-admin">
              <IconoBuscar />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={t("buscar_livreur")}
                aria-label={t("buscar_livreur")}
              />
            </div>

            <select
              className="filtro-select-admin"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as FiltroCaso)}
              aria-label={t("filtro_estado")}
            >
              <option value="todos">{t("filtro_todos")}</option>
              {ESTADOS_EXPEDIENTE.map((estado) => (
                <option key={estado} value={estado}>
                  {etiquetaEstadoExpediente(idioma, estado)}
                </option>
              ))}
            </select>
          </div>

          {cargando ? (
            <Cargando texto={t("leyendo_expedientes")} />
          ) : filasFiltradas.length === 0 ? (
            <div className="estado-vacio-panel">
              <div className="estado-vacio-icono">
                <IconoVerificacion width={24} height={24} />
              </div>
              <p className="estado-vacio-titulo">{t("sin_solicitudes_titulo")}</p>
              <p className="estado-vacio-sub">{t("no_expedientes_filtro")}</p>
            </div>
          ) : (
            <div className="lista-solicitudes">
              {filasFiltradas.map((caso) => {
                const activo = caso.id === seleccionadoId;
                return (
                  <button
                    key={caso.id}
                    type="button"
                    className={activo ? "solicitud-item activo" : "solicitud-item"}
                    onClick={() => setSeleccionadoId(caso.id)}
                  >
                    <span className="avatar-lista">
                      <IconoUsuario width={18} height={18} />
                    </span>
                    <div className="solicitud-info">
                      <div className="solicitud-top">
                        <strong className="solicitud-nombre">
                          {nombreDe(caso.courier_user_id)}
                        </strong>
                        <span className="solicitud-fecha">
                          <IconoCalendario />
                          {formatearFecha(caso.submitted_at ?? caso.created_at, idioma)}
                        </span>
                      </div>
                      <div className="solicitud-bottom">
                        <span className="solicitud-codigo">
                          KG-{caso.id.slice(0, 6).toUpperCase()}
                        </span>
                        <InsigniaExpediente estado={caso.status} />
                      </div>
                    </div>
                    <IconoChevronDerecha className="solicitud-chevron" />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="verificacion-detalle-columna">
          {seleccionadoId !== null ? (
            <PanelDetalleExpediente
              cliente={cliente}
              configuracion={configuracion}
              sesion={sesion}
              casoId={seleccionadoId}
              nombreAdministrador={nombreAdministrador}
              alActualizarLista={() => void cargar()}
            />
          ) : (
            <section className="tarjeta detalle-vacio-tarjeta">
              <div className="estado-vacio-panel grande">
                <div className="estado-vacio-icono">
                  <IconoVerificacion width={28} height={28} />
                </div>
                <p className="estado-vacio-titulo">{t("sin_solicitudes_titulo")}</p>
                <p className="estado-vacio-sub">{t("seleccionar_caso_vacio")}</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
