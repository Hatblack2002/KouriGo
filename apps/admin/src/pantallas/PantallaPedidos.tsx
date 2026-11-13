/**
 * Lista de pedidos reales con filtro por estado (README sección 14.2). Al
 * pulsar una fila se abre el detalle operativo. Etiquetas del diccionario
 * de idiomas (README sección 9).
 */
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESTADOS_PEDIDO } from "@kourigo/domain";
import { listarPedidos, type FilaPedido, type FiltroEstado } from "../api/pedidos";
import { Cargando, InsigniaEstado, MensajeError, SinDatos } from "../componentes";
import { etiquetaEstadoPedido, useIdioma } from "../idiomas";
import { formatearFecha } from "../formato";

export function PantallaPedidos({
  cliente,
  alAbrirPedido,
}: {
  readonly cliente: SupabaseClient;
  readonly alAbrirPedido: (id: string) => void;
}) {
  const { t, idioma } = useIdioma();
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
        <h2>{t("nav_pedidos")}</h2>
        <div className="filtros">
          <label>
            {t("filtro_estado")}
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as FiltroEstado)}>
              <option value="todos">{t("filtro_todos")}</option>
              {ESTADOS_PEDIDO.map((estado) => (
                <option key={estado} value={estado}>
                  {etiquetaEstadoPedido(idioma, estado)}
                </option>
              ))}
            </select>
          </label>
          <span className="nota">
            {filas.length} {t("pedidos_visibles")}
          </span>
        </div>
      </section>
      <MensajeError mensaje={error} />
      {cargando ? (
        <Cargando texto={t("leyendo_pedidos")} />
      ) : filas.length === 0 ? (
        <SinDatos texto={t("no_pedidos_filtro")} />
      ) : (
        <section className="tarjeta">
          <table>
            <thead>
              <tr>
                <th>{t("th_creado")}</th>
                <th>{t("th_tipo")}</th>
                <th>{t("th_estado")}</th>
                <th>{t("th_recogida")}</th>
                <th>{t("th_destino")}</th>
                <th>{t("th_tarifa")}</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((pedido) => (
                <tr key={pedido.id} className="fila-clic" onClick={() => alAbrirPedido(pedido.id)}>
                  <td>{formatearFecha(pedido.created_at, idioma)}</td>
                  <td>
                    {pedido.order_type === "assisted_purchase"
                      ? t("tipo_compra_asistida")
                      : t("tipo_entrega")}
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
