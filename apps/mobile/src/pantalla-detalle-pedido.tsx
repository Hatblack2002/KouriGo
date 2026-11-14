/**
 * Detalle de pedido / seguimiento (README sección 2.1: consultar estado,
 * detalles e historial). Rediseñado con el kit de interfaz de la maqueta
 * aprobada (apps/mobile/src/ui): encabezado con marca, chip de estado,
 * línea de tiempo REAL de «order_events» (escrita por el trigger SQL) y
 * diagrama de ruta con las direcciones reales del pedido.
 *
 * Sin mapa de verdad y sin tarjeta del repartidor: ni una cosa ni la otra
 * se pueden respaldar con el backend actual (no hay proveedor de mapas
 * contratado y las políticas RLS no permiten al cliente leer el perfil de
 * otro usuario; además no existe tabla de calificaciones). Nada se simula:
 * si el backend no expone un dato, no se dibuja.
 *
 * Las acciones salen de la matriz compartida de @kourigo/domain y se aplican
 * con la Edge Function real `transicion-pedido`.
 */
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoPedido } from "@kourigo/domain";
import { esEstadoPedido, ESTADOS_PEDIDO } from "@kourigo/domain";
import {
  Aviso,
  Boton,
  MensajeError,
  TituloSeccion,
  COLORES,
} from "./components";
import {
  ChipEstado as ChipMaqueta,
  EncabezadoLogo,
  etiquetaEstadoUI,
  LineaTiempoEventos,
  type EventoLineaTiempo,
  COLORES as COLORES_MAQUETA,
  ESPACIADO,
  RADIOS,
  TIPOGRAFIA,
} from "./ui";
import { formatearDinero, formatearFecha } from "./formato";
import { texto, type Idioma } from "./i18n";
import {
  obtenerEventos,
  obtenerItems,
  obtenerPedido,
  transicionarPedido,
  transicionesClienteDesde,
  type FilaEvento,
  type FilaItem,
  type FilaPedido,
} from "./pedidos";
import type { ConfiguracionPublica } from "./configuracion";

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES_MAQUETA.grisFondo,
  },
  contenido: {
    paddingHorizontal: ESPACIADO.lg,
    paddingTop: ESPACIADO.sm,
    paddingBottom: ESPACIADO.xxl,
    gap: ESPACIADO.md,
  },
  filaEstado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: ESPACIADO.md,
  },
  numeroPedido: {
    ...TIPOGRAFIA.tituloSeccion,
    fontSize: 18,
    color: COLORES_MAQUETA.grafito,
    flex: 1,
  },
  tarjeta: {
    backgroundColor: COLORES_MAQUETA.blanco,
    borderRadius: RADIOS.lg,
    borderWidth: 1,
    borderColor: COLORES_MAQUETA.borde,
    padding: ESPACIADO.md,
  },
  tituloTarjeta: {
    ...TIPOGRAFIA.tarjetaTitulo,
    color: COLORES_MAQUETA.grafito,
    marginBottom: ESPACIADO.sm,
  },
  rutaParada: {
    flexDirection: "row",
    alignItems: "center",
    gap: ESPACIADO.md,
  },
  rutaPunto: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: COLORES_MAQUETA.verdeMedio,
    backgroundColor: COLORES_MAQUETA.blanco,
  },
  rutaPuntoComercio: {
    borderColor: COLORES_MAQUETA.amarilloEstrella,
  },
  rutaPuntoDestino: {
    borderColor: COLORES_MAQUETA.verdeProfundo,
    backgroundColor: COLORES_MAQUETA.verdeProfundo,
  },
  rutaTexto: {
    flex: 1,
  },
  rutaEtiqueta: {
    ...TIPOGRAFIA.etiquetaPequena,
    color: COLORES_MAQUETA.grisTexto,
  },
  rutaDireccion: {
    ...TIPOGRAFIA.cuerpoMedio,
    color: COLORES_MAQUETA.grafito,
    marginTop: 1,
  },
  rutaConexion: {
    width: 2,
    height: 18,
    marginLeft: 6,
    backgroundColor: COLORES_MAQUETA.bordeSecundario,
  },
  itemFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.borde,
  },
  itemTexto: {
    color: COLORES.grafito,
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  itemCantidad: {
    color: COLORES.grafito,
    fontSize: 14,
    fontWeight: "700",
  },
  dato: {
    color: COLORES.grafito,
    fontSize: 14,
    marginTop: 2,
  },
  etiquetaDato: {
    color: COLORES.grisTexto,
    fontSize: 12,
    marginTop: 10,
    fontWeight: "700",
  },
  tarifaValor: {
    color: COLORES.verdeOscuro,
    fontWeight: "800",
    fontSize: 14,
    marginTop: 2,
  },
  acciones: {
    marginTop: ESPACIADO.xs,
  },
  accion: {
    marginTop: 8,
  },
  iconoVolver: {
    fontSize: 22,
    color: COLORES_MAQUETA.grafito,
    fontWeight: "700",
  },
});

interface Props {
  readonly idioma: Idioma;
  readonly cliente: SupabaseClient;
  readonly configuracion: ConfiguracionPublica;
  readonly pedidoId: string;
  readonly alVolver: () => void;
}

/**
 * Convierte los eventos reales del pedido en la línea de tiempo del kit:
 * cronológico, con el hito del estado actual como paso activo. Estados no
 * lineales (cancelled, issue) se marcan como activo en su evento y el resto
 * de pasos previos queda completado.
 */
function construirEventos(
  eventos: readonly FilaEvento[],
  estadoActual: string,
  idioma: Idioma,
): readonly EventoLineaTiempo[] {
  const cronologicos = [...eventos].reverse();
  const indiceActual = (ESTADOS_PEDIDO as readonly string[]).indexOf(estadoActual);
  return cronologicos.map((evento) => {
    const destino = evento.to_status ?? evento.from_status ?? "";
    const indiceDestino = (ESTADOS_PEDIDO as readonly string[]).indexOf(destino);
    let paso: EventoLineaTiempo["estadoPaso"] = "pendiente";
    if (destino === estadoActual) {
      paso = "activo";
    } else if (
      indiceDestino >= 0 &&
      indiceActual >= 0 &&
      indiceDestino < indiceActual
    ) {
      paso = "completado";
    }
    return {
      id: evento.id,
      titulo: etiquetaEstadoUI(idioma, destino),
      subtitulo: `${evento.event_type} · ${formatearFecha(evento.created_at, idioma)}`,
      estadoPaso: paso,
    };
  });
}

export function PantallaDetallePedido({
  idioma,
  cliente,
  configuracion,
  pedidoId,
  alVolver,
}: Props) {
  const [pedido, setPedido] = useState<FilaPedido | null>(null);
  const [items, setItems] = useState<readonly FilaItem[]>([]);
  const [eventos, setEventos] = useState<readonly FilaEvento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [avisoAccion, setAvisoAccion] = useState<string | null>(null);
  const [enAccion, setEnAccion] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const [resultadoPedido, resultadoItems, resultadoEventos] = await Promise.all([
      obtenerPedido(cliente, pedidoId),
      obtenerItems(cliente, pedidoId),
      obtenerEventos(cliente, pedidoId),
    ]);
    setCargando(false);
    if (resultadoPedido.tipo === "error") {
      setError(resultadoPedido.mensaje);
      return;
    }
    setPedido(resultadoPedido.datos);
    setItems(resultadoItems.tipo === "ok" ? resultadoItems.datos : []);
    setEventos(resultadoEventos.tipo === "ok" ? resultadoEventos.datos : []);
  }, [cliente, pedidoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function transicionar(destino: EstadoPedido) {
    if (pedido === null) {
      return;
    }
    setErrorAccion(null);
    setAvisoAccion(null);
    setEnAccion(true);
    const resultado = await transicionarPedido(configuracion, cliente, pedido.id, destino);
    setEnAccion(false);
    if (resultado.tipo === "ok") {
      setAvisoAccion(`${resultado.datos.de} -> ${resultado.datos.a} (${resultado.datos.actor})`);
      await cargar();
      return;
    }
    setErrorAccion(resultado.mensaje);
  }

  const estadosCliente: readonly EstadoPedido[] =
    pedido !== null && esEstadoPedido(pedido.status) ? transicionesClienteDesde(pedido.status) : [];

  function nombreTipo(tipo: string): string {
    if (tipo === "assisted_purchase") {
      return texto(idioma, "tipo_compra_asistida");
    }
    return texto(idioma, "tipo_entrega");
  }

  return (
    <View style={estilos.contenedor}>
      <EncabezadoLogo
        idioma={idioma}
        variante="titulo"
        tituloClave="suivi_de_commande"
        slotIzquierda={<Text style={estilos.iconoVolver}>←</Text>}
        alPulsarIzquierda={alVolver}
      />
      <ScrollView
        contentContainerStyle={estilos.contenido}
        refreshControl={
          <RefreshControl
            refreshing={cargando}
            onRefresh={() => {
              void cargar();
            }}
          />
        }
      >
        {error !== null ? <MensajeError mensaje={error} /> : null}
        {error === null && pedido === null && cargando === false ? (
          <Aviso mensaje={texto(idioma, "sin_pedidos")} />
        ) : null}
        {pedido !== null ? (
          <>
            <View style={estilos.filaEstado}>
              <Text style={estilos.numeroPedido} numberOfLines={1}>
                {`${texto(idioma, "detalle_pedido")} · ${pedido.id.slice(0, 8).toUpperCase()}`}
              </Text>
              <ChipMaqueta idioma={idioma} estado={pedido.status} />
            </View>

            <Text style={estilos.dato}>{nombreTipo(pedido.order_type)}</Text>

            {/* Diagrama de ruta con las direcciones REALES del pedido
                (sustituye al mapa: no hay proveedor de mapas contratado). */}
            <View style={estilos.tarjeta}>
              <Text style={estilos.tituloTarjeta}>{texto(idioma, "recogida")} → {texto(idioma, "destino")}</Text>
              <View style={estilos.rutaParada}>
                <View style={estilos.rutaPunto} />
                <View style={estilos.rutaTexto}>
                  <Text style={estilos.rutaEtiqueta}>{texto(idioma, "recogida")}</Text>
                  <Text style={estilos.rutaDireccion}>{pedido.pickup_address_text}</Text>
                </View>
              </View>
              {pedido.store_address_text !== null ? (
                <>
                  <View style={estilos.rutaConexion} />
                  <View style={estilos.rutaParada}>
                    <View style={[estilos.rutaPunto, estilos.rutaPuntoComercio]} />
                    <View style={estilos.rutaTexto}>
                      <Text style={estilos.rutaEtiqueta}>{texto(idioma, "comercio")}</Text>
                      <Text style={estilos.rutaDireccion}>{pedido.store_address_text}</Text>
                    </View>
                  </View>
                </>
              ) : null}
              <View style={estilos.rutaConexion} />
              <View style={estilos.rutaParada}>
                <View style={[estilos.rutaPunto, estilos.rutaPuntoDestino]} />
                <View style={estilos.rutaTexto}>
                  <Text style={estilos.rutaEtiqueta}>{texto(idioma, "destino")}</Text>
                  <Text style={estilos.rutaDireccion}>{pedido.dropoff_address_text}</Text>
                </View>
              </View>
              {pedido.notes !== null ? (
                <>
                  <Text style={estilos.etiquetaDato}>{texto(idioma, "notas")}</Text>
                  <Text style={estilos.dato}>{pedido.notes}</Text>
                </>
              ) : null}
              <Text style={estilos.etiquetaDato}>{texto(idioma, "fecha")}</Text>
              <Text style={estilos.dato}>{formatearFecha(pedido.created_at, idioma)}</Text>
              <Text style={estilos.etiquetaDato}>{texto(idioma, "tarifa_servicio")}</Text>
              <Text style={estilos.tarifaValor}>
                {formatearDinero(pedido.service_fee_amount, pedido.currency)}
              </Text>
            </View>

            <View style={estilos.tarjeta}>
              <TituloSeccion>{texto(idioma, "articulos")}</TituloSeccion>
              {items.map((item) => (
                <View key={item.id} style={estilos.itemFila}>
                  <Text style={estilos.itemTexto}>{item.description}</Text>
                  <Text style={estilos.itemCantidad}>{`x${item.quantity}`}</Text>
                </View>
              ))}
            </View>

            <View style={estilos.tarjeta}>
              <TituloSeccion>{texto(idioma, "seguimiento")}</TituloSeccion>
              {eventos.length === 0 ? (
                <Aviso mensaje={texto(idioma, "sin_eventos")} />
              ) : (
                <LineaTiempoEventos eventos={construirEventos(eventos, pedido.status, idioma)} />
              )}
            </View>

            {estadosCliente.length > 0 ? (
              <View style={estilos.acciones}>
                {estadosCliente.map((destino) => (
                  <View key={destino} style={estilos.accion}>
                    <Boton
                      textoBoton={
                        destino === "pending"
                          ? texto(idioma, "confirmar_solicitud")
                          : texto(idioma, "cancelar_pedido")
                      }
                      alPulsar={() => {
                        void transicionar(destino);
                      }}
                      deshabilitado={enAccion}
                      peligroso={destino === "cancelled"}
                    />
                  </View>
                ))}
              </View>
            ) : null}
            {avisoAccion !== null ? <Aviso mensaje={avisoAccion} /> : null}
            {errorAccion !== null ? <MensajeError mensaje={errorAccion} /> : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
