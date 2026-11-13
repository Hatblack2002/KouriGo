/**
 * Detalle operativo de un pedido real: ficha, artículos, eventos, asignaciones,
 * transiciones vía la Edge Function `transicion-pedido` y despacho vía
 * `despachar-pedido`. Las correcciones administrativas (pares exclusivos del
 * rol) exigen motivo (README secciones 4 y 12) y el servidor lo vuelve a
 * imponer y registra en la auditoría.
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
      setError(resPedido.error ?? "El pedido no existe o no es visible para tu sesión.");
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
  }, [cliente, pedidoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function nombreDe(usuarioId: string | null): string {
    if (usuarioId === null) {
      return "sistema";
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
      setError("La corrección administrativa exige un motivo registrado.");
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
        setError(resultado.mensajeError ?? `La función respondió ${resultado.estado}.`);
        return;
      }
      setAviso(
        `Transición aplicada: ${resultado.datos?.de ?? "?"} → ${resultado.datos?.a ?? "?"}.`,
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
      setError("Elige un repartidor aprobado para el despacho.");
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
        setError(resultado.mensajeError ?? `La función respondió ${resultado.estado}.`);
        return;
      }
      setAviso("Oferta enviada al repartidor (estado offered).");
      setRepartidorElegido("");
      await cargar();
    } finally {
      setOcupado(false);
    }
  }

  if (cargando) {
    return <Cargando texto="Leyendo el pedido real…" />;
  }

  if (pedido === null) {
    return (
      <>
        <MensajeError mensaje={error} />
        <button className="secundario" onClick={alVolver}>
          Volver a la lista
        </button>
      </>
    );
  }

  return (
    <>
      <button className="secundario" onClick={alVolver}>
        ← Volver a la lista
      </button>
      <MensajeError mensaje={error} />
      <MensajeOk mensaje={aviso} />
      <Tarjeta titulo={`Pedido ${pedido.id.slice(0, 8)}…`}>
        <dl className="ficha">
          <dt>Estado</dt>
          <dd>
            <InsigniaEstado estado={pedido.status} />
          </dd>
          <dt>Tipo</dt>
          <dd>{pedido.order_type === "assisted_purchase" ? "compra asistida" : "entrega"}</dd>
          <dt>Recogida</dt>
          <dd>{pedido.pickup_address_text}</dd>
          <dt>Tienda (compra asistida)</dt>
          <dd>{pedido.store_address_text ?? "—"}</dd>
          <dt>Destino</dt>
          <dd>{pedido.dropoff_address_text}</dd>
          <dt>Cliente</dt>
          <dd>{nombreDe(pedido.client_id)}</dd>
          <dt>Tarifa de servicio</dt>
          <dd>{formatearDinero(pedido.service_fee_amount, pedido.currency)}</dd>
          <dt>Notas</dt>
          <dd>{pedido.notes ?? "—"}</dd>
          <dt>Creado</dt>
          <dd>{formatearFecha(pedido.created_at)}</dd>
          <dt>Actualizado</dt>
          <dd>{formatearFecha(pedido.updated_at)}</dd>
        </dl>
      </Tarjeta>
      <Tarjeta titulo="Transiciones permitidas para el administrador">
        {opciones.length === 0 ? (
          <SinDatos texto="El pedido está en un estado final: no admite más transiciones." />
        ) : (
          <div className="acciones">
            <div>
              <label>
                Mover a
                <select
                  value={seleccionTransicion}
                  onChange={(e) => setSeleccionTransicion(e.target.value as EstadoPedido)}
                >
                  <option value="">— elegir estado —</option>
                  {opciones.map((opcion) => (
                    <option key={opcion.destino} value={opcion.destino}>
                      {opcion.destino}
                      {opcion.correccion ? " (corrección con motivo)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {elegida !== null && elegida.correccion ? (
              <div>
                <label>
                  Motivo (obligatorio, se registra en auditoría)
                  <textarea
                    value={motivo}
                    maxLength={500}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Justificación de la corrección administrativa"
                  />
                </label>
              </div>
            ) : null}
            <button
              className="accion"
              disabled={ocupado || seleccionTransicion === ""}
              onClick={() => void aplicarTransicion()}
            >
              Aplicar transición
            </button>
          </div>
        )}
        <p className="nota">
          Las transiciones pasan SIEMPRE por la función `transicion-pedido`: el actor lo determina
          el servidor desde el JWT y el trigger SQL vuelve a imponer la matriz. Los pares exclusivos
          del administrador son correcciones con motivo y auditoría.
        </p>
      </Tarjeta>
      {pedido.status === "pending" ? (
        <Tarjeta titulo="Despacho (ofertar a un repartidor aprobado)">
          {repartidores.length === 0 ? (
            <SinDatos texto="No hay repartidores con expediente aprobado y cuenta activa." />
          ) : (
            <div className="acciones">
              <div>
                <label>
                  Repartidor
                  <select
                    value={repartidorElegido}
                    onChange={(e) => setRepartidorElegido(e.target.value)}
                  >
                    <option value="">— elegir repartidor —</option>
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
                Despachar pedido
              </button>
            </div>
          )}
          <p className="nota">
            El despacho usa la función `despachar-pedido` (RPC atómico por service_role: crea la
            asignación, mueve el pedido a offered y registra la auditoría en una única transacción).
          </p>
        </Tarjeta>
      ) : null}
      <Tarjeta titulo="Artículos">
        {items.length === 0 ? (
          <SinDatos texto="El pedido no tiene artículos registrados." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Precio estimado</th>
                <th>Precio real</th>
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
      <Tarjeta titulo="Asignaciones">
        {asignaciones.length === 0 ? (
          <SinDatos texto="El pedido no tiene asignaciones todavía." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Repartidor</th>
                <th>Estado</th>
                <th>Ofrecida</th>
                <th>Aceptada</th>
                <th>Completada</th>
              </tr>
            </thead>
            <tbody>
              {asignaciones.map((asignacion) => (
                <tr key={asignacion.id}>
                  <td>{nombreDe(asignacion.courier_user_id)}</td>
                  <td>{asignacion.status}</td>
                  <td>{formatearFecha(asignacion.offered_at)}</td>
                  <td>{formatearFecha(asignacion.accepted_at)}</td>
                  <td>{formatearFecha(asignacion.completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tarjeta>
      <Tarjeta titulo="Historial de eventos">
        {eventos.length === 0 ? (
          <SinDatos texto="Sin eventos registrados." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Cuando</th>
                <th>Evento</th>
                <th>Transición</th>
                <th>Actor</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((evento) => (
                <tr key={evento.id}>
                  <td>{formatearFecha(evento.created_at)}</td>
                  <td>{evento.event_type}</td>
                  <td>
                    {evento.from_status ?? "—"} → {evento.to_status ?? "—"}
                  </td>
                  <td>{nombreDe(evento.actor_id)}</td>
                  <td>
                    {typeof evento.metadata["motivo"] === "string"
                      ? `motivo: ${String(evento.metadata["motivo"])}`
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
