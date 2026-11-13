/**
 * Detalle operativo de un pedido real: ficha, artículos, eventos, asignaciones,
 * transiciones vía la Edge Function `transicion-pedido` y despacho vía
 * `despachar-pedido`. Las correcciones administrativas (pares exclusivos del
 * rol) exigen motivo (README secciones 4 y 12) y el servidor lo vuelve a
 * imponer y registra en la auditoría. Etiquetas del diccionario de idiomas
 * (README sección 9).
 */
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoPedido } from "@kourigo/domain";
import type { ConfiguracionPublica } from "../configuracion";
import type { SesionActiva } from "../auth";
import {
  despacharPedido,
  obtenerAsignaciones,
  obtenerEventos,
  obtenerItems,
  obtenerPedido,
  transicionarPedido,
  transicionesAdminDisponibles,
  type FilaAsignacion,
  type FilaEvento,
  type FilaItem,
  type FilaPedido,
  type OpcionTransicion,
} from "../api/pedidos";
import { listarPerfiles, listarRepartidoresOperativos, type FilaPerfil } from "../api/perfiles";
import {
  Cargando,
  InsigniaEstado,
  MensajeError,
  MensajeOk,
  SinDatos,
  Tarjeta,
} from "../componentes";
import { useIdioma } from "../idiomas";
import { formatearDinero, formatearFecha } from "../formato";

interface Props {
  readonly cliente: SupabaseClient;
  readonly configuracion: ConfiguracionPublica;
  readonly sesion: SesionActiva;
  readonly pedidoId: string;
  readonly alVolver: () => void;
}

export function PantallaDetallePedido({
  cliente,
  configuracion,
  sesion,
  pedidoId,
  alVolver,
}: Props) {
  const { t, idioma } = useIdioma();
  const [pedido, setPedido] = useState<FilaPedido | null>(null);
  const [items, setItems] = useState<FilaItem[]>([]);
  const [eventos, setEventos] = useState<FilaEvento[]>([]);
  const [asignaciones, setAsignaciones] = useState<FilaAsignacion[]>([]);
  const [perfiles, setPerfiles] = useState<FilaPerfil[]>([]);
  const [repartidores, setRepartidores] = useState<FilaPerfil[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [seleccionTransicion, setSeleccionTransicion] = useState<EstadoPedido | "">("");
  const [motivo, setMotivo] = useState("");
  const [repartidorElegido, setRepartidorElegido] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const resPedido = await obtenerPedido(cliente, pedidoId);
    if (resPedido.error !== null || resPedido.pedido === null) {
      setError(resPedido.error ?? t("no_pedido_visible"));
      setPedido(null);
      setCargando(false);
      return;
    }
    const [resItems, resEventos, resAsig, resPerfiles, resCouriers] = await Promise.all([
      obtenerItems(cliente, pedidoId),
      obtenerEventos(cliente, pedidoId),
      obtenerAsignaciones(cliente, pedidoId),
      listarPerfiles(cliente),
      listarRepartidoresOperativos(cliente),
    ]);
    setPedido(resPedido.pedido);
    setItems(resItems.filas);
    setEventos(resEventos.filas);
    setAsignaciones(resAsig.filas);
    setPerfiles(resPerfiles.filas);
    const nombresCouriers = new Map(resPerfiles.filas.map((p) => [p.id, p.full_name]));
    setRepartidores(
      resCouriers.filas.map((c) => ({
        id: c.user_id,
        full_name: nombresCouriers.get(c.user_id) ?? null,
        phone: null,
        created_at: c.updated_at,
      })),
    );
    setCargando(false);
  }, [cliente, pedidoId, t]);

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

  const opciones: OpcionTransicion[] =
    pedido === null ? [] : transicionesAdminDisponibles(pedido.status);
  const elegida = opciones.find((o) => o.destino === seleccionTransicion) ?? null;

  async function aplicarTransicion() {
    if (pedido === null || seleccionTransicion === "") {
      return;
    }
    if (elegida !== null && elegida.correccion && motivo.trim().length === 0) {
      setError(t("err_motivo_correccion"));
      return;
    }
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      const resultado = await transicionarPedido(
        configuracion,
        sesion.accessToken,
        pedido.id,
        seleccionTransicion,
        elegida !== null && elegida.correccion ? motivo : null,
      );
      if (!resultado.ok) {
        setError(resultado.mensajeError ?? `${t("err_funcion_estado")} ${resultado.estado}.`);
        return;
      }
      setAviso(
        `${t("ok_transicion")} ${resultado.datos?.de ?? "?"} → ${resultado.datos?.a ?? "?"}.`,
      );
      setSeleccionTransicion("");
      setMotivo("");
      await cargar();
    } finally {
      setOcupado(false);
    }
  }

  async function despachar() {
    if (pedido === null || repartidorElegido.length === 0) {
      setError(t("err_elegir_repartidor"));
      return;
    }
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      const resultado = await despacharPedido(
        configuracion,
        sesion.accessToken,
        pedido.id,
        repartidorElegido,
      );
      if (!resultado.ok) {
        setError(resultado.mensajeError ?? `${t("err_funcion_estado")} ${resultado.estado}.`);
        return;
      }
      setAviso(t("ok_oferta"));
      setRepartidorElegido("");
      await cargar();
    } finally {
      setOcupado(false);
    }
  }

  if (cargando) {
    return <Cargando texto={t("leyendo_pedido")} />;
  }

  if (pedido === null) {
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
      <Tarjeta titulo={`${t("pedido_titulo")} ${pedido.id.slice(0, 8)}…`}>
        <dl className="ficha">
          <dt>{t("f_estado")}</dt>
          <dd>
            <InsigniaEstado estado={pedido.status} />
          </dd>
          <dt>{t("f_tipo")}</dt>
          <dd>
            {pedido.order_type === "assisted_purchase" ? t("tipo_compra_asistida") : t("tipo_entrega")}
          </dd>
          <dt>{t("f_recogida")}</dt>
          <dd>{pedido.pickup_address_text}</dd>
          <dt>{t("f_tienda")}</dt>
          <dd>{pedido.store_address_text ?? "—"}</dd>
          <dt>{t("f_destino")}</dt>
          <dd>{pedido.dropoff_address_text}</dd>
          <dt>{t("f_cliente")}</dt>
          <dd>{nombreDe(pedido.client_id)}</dd>
          <dt>{t("f_tarifa_servicio")}</dt>
          <dd>{formatearDinero(pedido.service_fee_amount, pedido.currency)}</dd>
          <dt>{t("f_notas")}</dt>
          <dd>{pedido.notes ?? "—"}</dd>
          <dt>{t("f_creado")}</dt>
          <dd>{formatearFecha(pedido.created_at, idioma)}</dd>
          <dt>{t("f_actualizado")}</dt>
          <dd>{formatearFecha(pedido.updated_at, idioma)}</dd>
        </dl>
      </Tarjeta>
      <Tarjeta titulo={t("transiciones_titulo")}>
        {opciones.length === 0 ? (
          <SinDatos texto={t("estado_final_nota")} />
        ) : (
          <div className="acciones">
            <div>
              <label>
                {t("mover_a")}
                <select
                  value={seleccionTransicion}
                  onChange={(e) => setSeleccionTransicion(e.target.value as EstadoPedido)}
                >
                  <option value="">{t("elegir_estado")}</option>
                  {opciones.map((opcion) => (
                    <option key={opcion.destino} value={opcion.destino}>
                      {opcion.destino}
                      {opcion.correccion ? t("correccion_etiqueta") : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {elegida !== null && elegida.correccion ? (
              <div>
                <label>
                  {t("motivo_label")}
                  <textarea
                    value={motivo}
                    maxLength={500}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder={t("motivo_placeholder")}
                  />
                </label>
              </div>
            ) : null}
            <button
              className="accion"
              disabled={ocupado || seleccionTransicion === ""}
              onClick={() => void aplicarTransicion()}
            >
              {t("aplicar_transicion")}
            </button>
          </div>
        )}
        <p className="nota">{t("transicion_nota")}</p>
      </Tarjeta>
      {pedido.status === "pending" ? (
        <Tarjeta titulo={t("despacho_titulo")}>
          {repartidores.length === 0 ? (
            <SinDatos texto={t("sin_repartidores")} />
          ) : (
            <div className="acciones">
              <div>
                <label>
                  {t("th_repartidor")}
                  <select
                    value={repartidorElegido}
                    onChange={(e) => setRepartidorElegido(e.target.value)}
                  >
                    <option value="">{t("elegir_repartidor")}</option>
                    {repartidores.map((repartidor) => (
                      <option key={repartidor.id} value={repartidor.id}>
                        {repartidor.full_name ?? repartidor.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className="accion"
                disabled={ocupado || repartidorElegido.length === 0}
                onClick={() => void despachar()}
              >
                {t("despachar_pedido")}
              </button>
            </div>
          )}
          <p className="nota">{t("despacho_nota")}</p>
        </Tarjeta>
      ) : null}
      <Tarjeta titulo={t("items_titulo")}>
        {items.length === 0 ? (
          <SinDatos texto={t("sin_items")} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("th_descripcion")}</th>
                <th>{t("th_cantidad")}</th>
                <th>{t("th_precio_estimado")}</th>
                <th>{t("th_precio_real")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{formatearDinero(item.estimated_price_amount, pedido.currency)}</td>
                  <td>{formatearDinero(item.actual_price_amount, pedido.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tarjeta>
      <Tarjeta titulo={t("asignaciones_titulo")}>
        {asignaciones.length === 0 ? (
          <SinDatos texto={t("sin_asignaciones")} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("th_repartidor")}</th>
                <th>{t("th_estado")}</th>
                <th>{t("th_ofrecida")}</th>
                <th>{t("th_aceptada")}</th>
                <th>{t("th_completada")}</th>
              </tr>
            </thead>
            <tbody>
              {asignaciones.map((asignacion) => (
                <tr key={asignacion.id}>
                  <td>{nombreDe(asignacion.courier_user_id)}</td>
                  <td>{asignacion.status}</td>
                  <td>{formatearFecha(asignacion.offered_at, idioma)}</td>
                  <td>{formatearFecha(asignacion.accepted_at, idioma)}</td>
                  <td>{formatearFecha(asignacion.completed_at, idioma)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tarjeta>
      <Tarjeta titulo={t("eventos_titulo")}>
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
                <th>{t("th_detalle")}</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((evento) => (
                <tr key={evento.id}>
                  <td>{formatearFecha(evento.created_at, idioma)}</td>
                  <td>{evento.event_type}</td>
                  <td>
                    {evento.from_status ?? "—"} → {evento.to_status ?? "—"}
                  </td>
                  <td>{nombreDe(evento.actor_id)}</td>
                  <td>
                    {typeof evento.metadata["motivo"] === "string"
                      ? `${t("motivo_prefijo")} ${String(evento.metadata["motivo"])}`
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tarjeta>
    </>
  );
}
