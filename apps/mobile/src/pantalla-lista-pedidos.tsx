/**
 * Pantalla «Mis pedidos» (README sección 2.1): lista real de pedidos del
 * cliente (PostgREST bajo RLS), con recarga manual (RefreshControl) y
 * estados de carga y error visibles. Los pedidos de otros clientes no son
 * visibles: el backend no los devuelve.
 */
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Boton, ChipEstado, MensajeError, Titulo, COLORES } from "./components";
import { formatearDinero, formatearFecha } from "./formato";
import { ETIQUETA_IDIOMA, IDIOMAS, texto, type Idioma } from "./i18n";
import { listarPedidos, type FilaPedido } from "./pedidos";

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES.blanco,
  },
  barra: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.borde,
  },
  titulo: {
    flex: 1,
  },
  idiomas: {
    flexDirection: "row",
  },
  botonIdioma: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORES.borde,
    backgroundColor: COLORES.grisFondo,
  },
  botonIdiomaActivo: {
    backgroundColor: COLORES.grafito,
  },
  textoIdioma: {
    fontSize: 12,
    color: COLORES.grafito,
    fontWeight: "700",
  },
  textoIdiomaActivo: {
    color: COLORES.blanco,
  },
  acciones: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  accionDerecha: {
    flex: 1,
    marginLeft: 8,
  },
  accionIzquierda: {
    flex: 1,
    marginRight: 8,
  },
  tarjeta: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORES.borde,
    backgroundColor: COLORES.grisFondo,
  },
  filaTarjeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  tipo: {
    fontWeight: "700",
    color: COLORES.grafito,
    fontSize: 15,
    flex: 1,
  },
  detalle: {
    color: COLORES.grisTexto,
    fontSize: 13,
  },
  vacio: {
    textAlign: "center",
    color: COLORES.grisTexto,
    marginTop: 32,
    paddingHorizontal: 16,
  },
  error: {
    marginHorizontal: 16,
    marginTop: 16,
  },
});

interface Props {
  readonly idioma: Idioma;
  readonly alCambiarIdioma: (idioma: Idioma) => void;
  readonly cliente: SupabaseClient;
  readonly alAbrirDetalle: (pedidoId: string) => void;
  readonly alNuevoPedido: () => void;
  readonly alCerrarSesion: () => void;
}

export function PantallaListaPedidos({
  idioma,
  alCambiarIdioma,
  cliente,
  alAbrirDetalle,
  alNuevoPedido,
  alCerrarSesion,
}: Props) {
  const [pedidos, setPedidos] = useState<readonly FilaPedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const resultado = await listarPedidos(cliente);
    setCargando(false);
    if (resultado.tipo === "ok") {
      setPedidos(resultado.datos);
      return;
    }
    setError(resultado.mensaje);
  }, [cliente]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function nombreTipo(tipo: string): string {
    if (tipo === "assisted_purchase") {
      return texto(idioma, "tipo_compra_asistida");
    }
    return texto(idioma, "tipo_entrega");
  }

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.barra}>
        <View style={estilos.titulo}>
          <Titulo>{texto(idioma, "mis_pedidos")}</Titulo>
        </View>
        <View style={estilos.idiomas}>
          {IDIOMAS.map((opcion) => (
            <Pressable
              key={opcion}
              onPress={() => alCambiarIdioma(opcion)}
              style={[estilos.botonIdioma, opcion === idioma ? estilos.botonIdiomaActivo : null]}
            >
              <Text
                style={[estilos.textoIdioma, opcion === idioma ? estilos.textoIdiomaActivo : null]}
              >
                {ETIQUETA_IDIOMA[opcion]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={estilos.acciones}>
        <View style={estilos.accionIzquierda}>
          <Boton textoBoton={texto(idioma, "nuevo_pedido")} alPulsar={alNuevoPedido} />
        </View>
        <View style={estilos.accionDerecha}>
          <Boton
            textoBoton={texto(idioma, "cerrar_sesion")}
            alPulsar={alCerrarSesion}
            secundario={true}
          />
        </View>
      </View>
      {error !== null ? <MensajeError mensaje={error} /> : null}
      <FlatList
        data={pedidos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={cargando}
            onRefresh={() => {
              void cargar();
            }}
          />
        }
        ListEmptyComponent={
          error === null && !cargando ? (
            <Text style={estilos.vacio}>{texto(idioma, "sin_pedidos")}</Text>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => alAbrirDetalle(item.id)} style={estilos.tarjeta}>
            <View style={estilos.filaTarjeta}>
              <Text style={estilos.tipo}>{nombreTipo(item.order_type)}</Text>
              <ChipEstado idioma={idioma} estado={item.status} />
            </View>
            <Text style={estilos.detalle}>
              {texto(idioma, "fecha")}: {formatearFecha(item.created_at, idioma)}
            </Text>
            <Text style={estilos.detalle}>
              {texto(idioma, "recogida")}: {item.pickup_address_text}
            </Text>
            <Text style={estilos.detalle}>
              {texto(idioma, "destino")}: {item.dropoff_address_text}
            </Text>
            <Text style={estilos.detalle}>
              {texto(idioma, "tarifa_servicio")}:{" "}
              {formatearDinero(item.service_fee_amount, item.currency)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
