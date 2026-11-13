/**
 * Resumen operativo con métricas REALES de la tabla `orders` bajo RLS
 * (README sección 14.1: pedidos activos, pendientes, completados,
 * incidencias y volumen de operación). Sin datos de ejemplo.
 */
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESTADOS_PEDIDO } from "@kourigo/domain";
import { contarPedidosPorEstado, listarPedidos, type FilaPedido } from "../api/pedidos";
import {
  Cargando,
  InsigniaEstado,
  MensajeError,
  nombreEstadoPedido,
  SinDatos,
} from "../componentes";
import { formatearFecha } from "../formato";

const ETIQUETAS_RESUMEN: readonly { clave: string; etiqueta: string }[] = [
  { clave: "pending", etiqueta: "Pendientes" },
  { clave: "offered", etiqueta: "Ofrecidos" },
  { clave: "accepted", etiqueta: "Aceptados" },
  { clave: "in_transit", etiqueta: "En tránsito" },
  { clave: "delivered", etiqueta: "Entregados" },
  { clave: "issue", etiqueta: "Incidencias" },
  { clave: "cancelled", etiqueta: "Cancelados" },
];

export function PantallaResumen({ cliente }: { readonly cliente: SupabaseClient }) {
  const [conteos, setConteos] = useState<Record<string, number> | null>(null);
  const [recientes, setRecientes] = useState<FilaPedido[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let montado = true;
    async function cargar() {
      setCargando(true);
      setError(null);
      const porEstado = await contarPedidosPorEstado(cliente);
      if (!montado) {
        return;
      }
      if (porEstado.error !== null) {
        setError(porEstado.error);
        setCargando(false);
        return;
      }
      const ultimos = await listarPedidos(cliente, "todos", 10);
      if (!montado) {
        return;
      }
      if (ultimos.error !== null) {
        setError(ultimos.error);
        setCargando(false);
        return;
      }
      setConteos(porEstado.conteos);
      setRecientes(ultimos.filas);
      setCargando(false);
    }
    void cargar();
    return () => {
      montado = false;
    };
  }, [cliente]);

  if (cargando) {
    return <Cargando texto="Leyendo las métricas reales de la operación…" />;
  }

  const total = conteos?.__total ?? 0;
  const activos =
    (conteos?.["pending"] ?? 0) +
    (conteos?.["offered"] ?? 0) +
    (conteos?.["accepted"] ?? 0) +
    (conteos?.["at_pickup"] ?? 0) +
    (conteos?.["picked_up"] ?? 0) +
    (conteos?.["in_transit"] ?? 0);

  return (
    <>
      <MensajeError mensaje={error} />
      <div className="metricas">
        <div className="metrica">
          <span className="cifra">{total}</span>
          <span className="etiqueta">Pedidos totales</span>
        </div>
        <div className="metrica">
          <span className="cifra">{activos}</span>
          <span className="etiqueta">En curso</span>
        </div>
        {ETIQUETAS_RESUMEN.map((item) => (
          <div className="metrica" key={item.clave}>
            <span className="cifra">{conteos?.[item.clave] ?? 0}</span>
            <span className="etiqueta">{item.etiqueta}</span>
          </div>
        ))}
      </div>
      <section className="tarjeta">
        <h2>Últimos pedidos</h2>
        {recientes.length === 0 ? (
          <SinDatos texto="Todavía no hay pedidos en el proyecto real." />
        ) : (
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
              {recientes.map((pedido) => (
                <tr key={pedido.id}>
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
        )}
      </section>
      <section className="tarjeta">
        <h2>Estados del modelo (referencia)</h2>
        <p className="nota">
          Los diez estados del ciclo de vida: {ESTADOS_PEDIDO.map(nombreEstadoPedido).join(" · ")}.{" "}
          Las métricas de arriba solo muestran estados con pedidos reales.
        </p>
      </section>
    </>
  );
}
