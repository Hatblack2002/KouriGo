/**
 * Lista de expedientes de verificación de repartidores (README sección 14.5).
 * Al pulsar una fila se abre el detalle con documentos y decisiones.
 * Etiquetas del diccionario de idiomas (README sección 9).
 */
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESTADOS_EXPEDIENTE, type EstadoExpediente } from "@kourigo/domain";
import { listarCasos, type FilaCaso } from "../api/expediente";
import { listarPerfiles, type FilaPerfil } from "../api/perfiles";
import { Cargando, InsigniaExpediente, MensajeError, SinDatos } from "../componentes";
import { etiquetaEstadoExpediente, useIdioma } from "../idiomas";
import { formatearFecha } from "../formato";

type FiltroCaso = "todos" | EstadoExpediente;

export function PantallaRepartidores({
  cliente,
  alAbrirCaso,
}: {
  readonly cliente: SupabaseClient;
  readonly alAbrirCaso: (id: string) => void;
}) {
  const { t, idioma } = useIdioma();
  const [filtro, setFiltro] = useState<FiltroCaso>("todos");
  const [filas, setFilas] = useState<FilaCaso[]>([]);
  const [perfiles, setPerfiles] = useState<FilaPerfil[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let montado = true;
    async function cargar() {
      setCargando(true);
      setError(null);
      const resCasos = await listarCasos(cliente, filtro);
      const resPerfiles = await listarPerfiles(cliente);
      if (!montado) {
        return;
      }
      if (resCasos.error !== null) {
        setError(resCasos.error);
        setFilas([]);
      } else {
        setFilas(resCasos.filas);
        setError(resPerfiles.error);
        setPerfiles(resPerfiles.filas);
      }
      setCargando(false);
    }
    void cargar();
    return () => {
      montado = false;
    };
  }, [cliente, filtro]);

  function nombreDe(usuarioId: string): string {
    const perfil = perfiles.find((p) => p.id === usuarioId);
    return perfil !== undefined && perfil.full_name !== null
      ? perfil.full_name
      : `${usuarioId.slice(0, 8)}…`;
  }

  return (
    <>
      <section className="tarjeta">
        <h2>{t("expedientes_titulo")}</h2>
        <div className="filtros">
          <label>
            {t("filtro_estado")}
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as FiltroCaso)}>
              <option value="todos">{t("filtro_todos")}</option>
              {ESTADOS_EXPEDIENTE.map((estado) => (
                <option key={estado} value={estado}>
                  {etiquetaEstadoExpediente(idioma, estado)}
                </option>
              ))}
            </select>
          </label>
          <span className="nota">
            {filas.length} {t("expedientes_visibles")}
          </span>
        </div>
      </section>
      <MensajeError mensaje={error} />
      {cargando ? (
        <Cargando texto={t("leyendo_expedientes")} />
      ) : filas.length === 0 ? (
        <SinDatos texto={t("no_expedientes_filtro")} />
      ) : (
        <section className="tarjeta">
          <table>
            <thead>
              <tr>
                <th>{t("th_repartidor")}</th>
                <th>{t("th_estado")}</th>
                <th>{t("th_presentado")}</th>
                <th>{t("th_decision")}</th>
                <th>{t("th_metodo")}</th>
                <th>{t("th_actualizado")}</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((caso) => (
                <tr key={caso.id} className="fila-clic" onClick={() => alAbrirCaso(caso.id)}>
                  <td>{nombreDe(caso.courier_user_id)}</td>
                  <td>
                    <InsigniaExpediente estado={caso.status} />
                  </td>
                  <td>{formatearFecha(caso.submitted_at, idioma)}</td>
                  <td>{formatearFecha(caso.decision_at, idioma)}</td>
                  <td>{caso.verification_method ?? "—"}</td>
                  <td>{formatearFecha(caso.updated_at, idioma)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
