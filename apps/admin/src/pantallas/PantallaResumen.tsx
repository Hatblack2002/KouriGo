/**
 * Resumen operativo con métricas REALES de la tabla `orders` bajo RLS
 * (README sección 14.1: pedidos activos, pendientes, completados,
 * incidencias y volumen de operación). Sin datos de ejemplo. Etiquetas del
 * diccionario de idiomas (README sección 9).
 */
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESTADOS_PEDIDO } from "@kourigo/domain";
import { contarPedidosPorEstado, listarPedidos, type FilaPedido } from "../api/pedidos";
import { Cargando, InsigniaEstado, MensajeError, SinDatos } from "../componentes";
import { etiquetaEstadoPedido, useIdioma, type ClaveTexto } from "../idiomas";
import { formatearFecha } from "../formato";

const METRICAS_RESUMEN: readonly { readonly clave: ClaveTexto; readonly estado: string }[] = [
  { clave: "resumen_pendientes", estado: "pending" },
  { clave: "resumen_ofrecidos", estado: "offered" },
  { clave: "resumen_aceptados", estado: "accepted" },
  { clave: "resumen_transito", estado: "in_transit" },
  { clave: "resumen_entregados", estado: "delivered" },
  { clave: "resumen_incidencias", estado: "issue" },
  { clave: "resumen_cancelados", estado: "cancelled" },
];

export function PantallaResumen({ cliente }: { readonly cliente: SupabaseClient }) {
  const { t, idioma } = useIdioma();
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
    return <Cargando texto={t("leyendo_metricas")} />;
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
          <span className="etiqueta">{t("metrica_total")}</span>
        </div>
        <div className="metrica">
          <span className="cifra">{activos}</span>
          <span className="etiqueta">{t("metrica_curso")}</span>
        </div>
        {METRICAS_RESUMEN.map((metrica) => (
          <div className="metrica" key={metrica.clave}>
            <span className="cifra">{conteos?.[metrica.estado] ?? 0}</span>
            <span className="etiqueta">{t(metrica.clave)}</span>
          </div>
        ))}
      </div>
      <section className="tarjeta">
        <h2>{t("ultimos_pedidos")}</h2>
        {recientes.length === 0 ? (
          <SinDatos texto={t("sin_pedidos_proyecto")} />
        ) : (
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
              {recientes.map((pedido) => (
                <tr key={pedido.id}>
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
        )}
      </section>
      <section className="tarjeta">
        <h2>{t("resumen_estados_titulo")}</h2>
        <p className="nota">
          {t("estados_ciclo")}{" "}
          {ESTADOS_PEDIDO.map((estado) => etiquetaEstadoPedido(idioma, estado)).join(" · ")}{" "}
          {t("metricas_reales_nota")}
        </p>
      </section>
    </>
  );
}
