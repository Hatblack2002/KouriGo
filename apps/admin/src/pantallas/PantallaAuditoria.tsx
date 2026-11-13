/**
 * Auditoría de operaciones sensibles (README secciones 12 y 14.10): últimas
 * entradas REALES de `audit_logs`, que solo el administrador puede leer por
 * RLS. Las acciones privilegiosas de la Etapa 3 y las correcciones de la
 * consola dejan aquí su constancia. Etiquetas del diccionario de idiomas
 * (README sección 9).
 */
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  accionesConocidas,
  listarAuditoria,
  type FilaAuditoria,
  type FiltroAccion,
} from "../api/auditoria";
import { Cargando, MensajeError, SinDatos } from "../componentes";
import { useIdioma } from "../idiomas";
import { formatearFecha } from "../formato";

export function PantallaAuditoria({ cliente }: { readonly cliente: SupabaseClient }) {
  const { t, idioma } = useIdioma();
  const [filtro, setFiltro] = useState<FiltroAccion>("todas");
  const [filas, setFilas] = useState<FilaAuditoria[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let montado = true;
    async function cargar() {
      setCargando(true);
      setError(null);
      const resultado = await listarAuditoria(cliente, filtro);
      if (!montado) {
        return;
      }
      if (resultado.error !== null) {
        setError(resultado.error);
        setFilas([]);
      } else {
        setFilas(resultado.filas);
      }
      setCargando(false);
    }
    void cargar();
    return () => {
      montado = false;
    };
  }, [cliente, filtro]);

  return (
    <>
      <section className="tarjeta">
        <h2>{t("auditoria_titulo")}</h2>
        <div className="filtros">
          <label>
            {t("filtro_accion")}
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="todas">{t("filtro_todas")}</option>
              {accionesConocidas().map((accion) => (
                <option key={accion} value={accion}>
                  {accion}
                </option>
              ))}
            </select>
          </label>
          <span className="nota">
            {filas.length} {t("entradas_visibles")}
          </span>
        </div>
        <p className="nota">{t("auditoria_nota")}</p>
      </section>
      <MensajeError mensaje={error} />
      {cargando ? (
        <Cargando texto={t("leyendo_auditoria")} />
      ) : filas.length === 0 ? (
        <SinDatos texto={t("no_auditoria_filtro")} />
      ) : (
        <section className="tarjeta">
          <table>
            <thead>
              <tr>
                <th>{t("th_cuando")}</th>
                <th>{t("th_accion")}</th>
                <th>{t("th_recurso")}</th>
                <th>{t("th_identificador")}</th>
                <th>{t("th_metadatos")}</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.id}>
                  <td>{formatearFecha(fila.created_at, idioma)}</td>
                  <td>{fila.action}</td>
                  <td>
                    {fila.resource_type}
                    {fila.resource_id !== null ? <> ({fila.resource_id.slice(0, 8)}…)</> : null}
                  </td>
                  <td>{fila.actor_id !== null ? `${fila.actor_id.slice(0, 8)}…` : "—"}</td>
                  <td>
                    <code>
                      {Object.keys(fila.metadata).length > 0 ? JSON.stringify(fila.metadata) : "{}"}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
