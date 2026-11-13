/**
 * Lista de expedientes de verificación de repartidores (README sección 14.5).
 * Al pulsar una fila se abre el detalle con documentos y decisiones.
 */
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESTADOS_EXPEDIENTE, type EstadoExpediente } from "@kourigo/domain";
import { listarCasos, type FilaCaso } from "../api/expediente";
import { listarPerfiles, type FilaPerfil } from "../api/perfiles";
import {
  Cargando,
  InsigniaExpediente,
  MensajeError,
  nombreEstadoExpediente,
  SinDatos,
} from "../componentes";
import { formatearFecha } from "../formato";

type FiltroCaso = "todos" | EstadoExpediente;

export function PantallaRepartidores({
  cliente,
  alAbrirCaso,
}: {
  readonly cliente: SupabaseClient;
  readonly alAbrirCaso: (id: string) => void;
}) {
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
        <h2>Expedientes de verificación de repartidores</h2>
        <div className="filtros">
          <label>
            Estado
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as FiltroCaso)}>
              <option value="todos">todos</option>
              {ESTADOS_EXPEDIENTE.map((estado) => (
                <option key={estado} value={estado}>
                  {nombreEstadoExpediente(estado)}
                </option>
              ))}
            </select>
          </label>
          <span className="nota">{filas.length} expedientes visibles (últimos 100)</span>
        </div>
      </section>
      <MensajeError mensaje={error} />
      {cargando ? (
        <Cargando texto="Leyendo expedientes reales…" />
      ) : filas.length === 0 ? (
        <SinDatos texto="No hay expedientes con ese filtro." />
      ) : (
        <section className="tarjeta">
          <table>
            <thead>
              <tr>
                <th>Repartidor</th>
                <th>Estado</th>
                <th>Presentado</th>
                <th>Decisión</th>
                <th>Método</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((caso) => (
                <tr key={caso.id} className="fila-clic" onClick={() => alAbrirCaso(caso.id)}>
                  <td>{nombreDe(caso.courier_user_id)}</td>
                  <td>
                    <InsigniaExpediente estado={caso.status} />
                  </td>
                  <td>{formatearFecha(caso.submitted_at)}</td>
                  <td>{formatearFecha(caso.decision_at)}</td>
                  <td>{caso.verification_method ?? "—"}</td>
                  <td>{formatearFecha(caso.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
