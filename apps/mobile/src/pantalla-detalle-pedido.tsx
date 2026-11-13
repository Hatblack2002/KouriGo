/**
 * Detalle de pedido (README sección 2.1: consultar estado, detalles e
 * historial). Muestra los datos reales, los artículos, la línea de
 * «évènman» (order_events escrita por el trigger SQL) y las acciones que el
 * CLIENTE puede hacer según la matriz compartida de @kourigo/domain: las
 * transiciones se aplican con la Edge Function real `transicion-pedido`.
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoPedido } from "@kourigo/domain";
import { esEstadoPedido } from "@kourigo/domain";
import {
  Aviso,
  Boton,
  ChipEstado,
  MensajeError,
  Titulo,
  TituloSeccion,
  COLORES,
} from "./components.js";
import { formatearDinero, formatearFecha } from "./formato.js";
import { texto, type Idioma } from "./i18n.js";
import {
  obtenerEventos,
  obtenerItems,
  obtenerPedido,
  transicionarPedido,
  transicionesClienteDesde,
  type FilaEvento,
  type FilaItem,
  type FilaPedido,
} from "./pedidos.js";
import type { ConfiguracionPublica } from "./configuracion.js";

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES.blanco,
  },
  contenido: {
    padding: 16,
    paddingBottom: 32,
  },
  barraVolver: {
    marginBottom: 8,
  },
  botonVolver: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  textoVolver: {
    color: COLORES.verde,
    fontWeight: "700",
    fontSize: 14,
  },
  filaEstado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  dato: {
    color: COLORES.grafito,
    fontSize: 14,
    marginTop: 6,
  },
  etiquetaDato: {
    color: COLORES.grisTexto,
    fontSize: 12,
    marginTop: 8,
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
  },
  itemCantidad: {
    color: COLORES.grafito,
    fontSize: 14,
    fontWeight: "700",
    marginRight: 8,
  },
  evento: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.borde,
  },
  eventoTexto: {
    color: COLORES.grafito,
    fontSize: 13,
  },
  eventoFecha: {
    color: COLORES.grisTexto,
    fontSize: 12,
    marginTop: 2,
  },
  acciones: {
    marginTop: 20,
  },
  accion: {
    marginTop: 8,
  },
});

interface Props {
  readonly idioma: Idioma;
  readonly cliente: SupabaseClient;
  readonly configuracion: ConfiguracionPublica;
  readonly pedidoId: string;
  readonly alVolver: () => void;
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
    <ScrollView
      style={estilos.contenedor}
      contentContainerStyle={estilos.contenido}
      refreshControl={
        <RefreshControl refreshing={cargando} onRefresh={() => { void cargar(); }} />
      }
    >
      <View style={estilos.barraVolver}>
        <Pressable onPress={alVolver} style={estilos.botonVolver}>
          <Text style={estilos.textoVolver}>← {texto(idioma, "volver")}</Text>
        </Pressable>
      </View>
      {error !== null ? <MensajeError mensaje={error} /> : null}
      {error === null && pedido === null && cargando === false ? (
        <Aviso mensaje={texto(idioma, "sin_pedidos")} />
      ) : null}
      {pedido !== null ? (
        <>
          <Titulo>{texto(idioma, "detalle_pedido")}</Titulo>
          <View style={estilos.filaEstado}>
            <Text style={estilos.dato}>{nombreTipo(pedido.order_type)}</Text>
            <ChipEstado idioma={idioma} estado={pedido.status} />
          </View>
          <Text style={estilos.etiquetaDato}>{texto(idioma, "recogida")}</Text>
          <Text style={estilos.dato}>{pedido.pickup_address_text}</Text>
          <Text style={estilos.etiquetaDato}>{texto(idioma, "destino")}</Text>
          <Text style={estilos.dato}>{pedido.dropoff_address_text}</Text>
          {pedido.store_address_text !== null ? (
            <>
              <Text style={estilos.etiquetaDato}>{texto(idioma, "comercio")}</Text>
              <Text style={estilos.dato}>{pedido.store_address_text}</Text>
            </>
          ) : null}
          {pedido.notes !== null ? (
            <>
              <Text style={estilos.etiquetaDato}>{texto(idioma, "notas")}</Text>
              <Text style={estilos.dato}>{pedido.notes}</Text>
            </>
          ) : null}
          <Text style={estilos.etiquetaDato}>{texto(idioma, "fecha")}</Text>
          <Text style={estilos.dato}>{formatearFecha(pedido.created_at, idioma)}</Text>
          <Text style={estilos.etiquetaDato}>{texto(idioma, "tarifa_servicio")}</Text>
          <Text style={estilos.dato}>
            {formatearDinero(pedido.service_fee_amount, pedido.currency)}
          </Text>
          <TituloSeccion>{texto(idioma, "articulos")}</TituloSeccion>
          {items.map((item) => (
            <View key={item.id} style={estilos.itemFila}>
              <Text style={estilos.itemTexto}>{item.description}</Text>
              <Text style={estilos.itemCantidad}>{`x${item.quantity}`}</Text>
            </View>
          ))}
          <TituloSeccion>{texto(idioma, "eventos")}</TituloSeccion>
          {eventos.length === 0 ? (
            <Aviso mensaje={texto(idioma, "sin_eventos")} />
          ) : (
            eventos.map((evento) => (
              <View key={evento.id} style={estilos.evento}>
                <Text style={estilos.eventoTexto}>
                  {`${evento.from_status ?? "—"} -> ${evento.to_status ?? "—"} (${evento.event_type})`}
                </Text>
                <Text style={estilos.eventoFecha}>
                  {formatearFecha(evento.created_at, idioma)}
                </Text>
              </View>
            ))
          )}
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
                    secundario={destino === "cancelled"}
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
  );
}
