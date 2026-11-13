/**
 * Lista de pedidos reales con filtro por estado (README sección 14.2). Al
 * pulsar una fila se abre el detalle operativo.
 */
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESTADOS_PEDIDO } from "@kourigo/domain";
import { listarPedidos, type FilaPedido, type FiltroEstado } from "../api/pedidos";
import {
  Cargando,
  InsigniaEstado,
  MensajeError,
  nombreEstadoPedido,
  SinDatos,
} from "../componentes";
import { formatearFecha } from "../formato";

export function PantallaPedidos({
  cliente,
  alAbrirPedido,
}: {
  readonly cliente: SupabaseClient;
  readonly alAbrirPedido: (id: string) => void;
}) {
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [filas, setFilas] = useState<FilaPedido[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let montado = true;
    async function cargar() {
      setCargando(true);
      setError(null);
      const resultado = await listarPedidos(cliente, filtro);
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
        <h2>Pedidos</h2>
        <div className="filtros">
          <label>
            Estado
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as FiltroEstado)}>
              <option value="todos">todos</option>
              {ESTADOS_PEDIDO.map((estado) => (
                <option key={estado} value={estado}>
                  {nombreEstadoPedido(estado)}
                </option>
              ))}
            </select>
          </label>
          <span className="nota">{filas.length} pedidos visibles (últimos 100)</span>
        </div>
      </section>
      <MensajeError mensaje={error} />
      {cargando ? (
        <Cargando texto="Leyendo pedidos reales…" />
      ) : filas.length === 0 ? (
        <SinDatos texto="No hay pedidos con ese filtro." />
      ) : (
        <section className="tarjeta">
          <table>
            <thead>
              <tr>
                <th>Creado</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Recogida</th>
                <th>Destino</th>
                <th>Tarifa</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((pedido) => (
                <tr key={pedido.id} className="fila-clic" onClick={() => alAbrirPedido(pedido.id)}>
                  <td>{formatearFecha(pedido.created_at)}</td>
                  <td>
                    {pedido.order_type === "assisted_purchase" ? "compra asistida" : "entrega"}
                  </td>
                  <td>
                    <InsigniaEstado estado={pedido.status} />
                  </td>
                  <td>{pedido.pickup_address_text}</td>
                  <td>{pedido.dropoff_address_text}</td>
                  <td>
                    {(pedido.service_fee_amount / 100).toFixed(2)} {pedido.currency}
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
