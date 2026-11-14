/**
 * Pantalla «Mis pedidos» (README sección 2.1): lista real de pedidos del
 * cliente (PostgREST bajo RLS), con recarga manual (RefreshControl) y
 * estados de carga y error visibles. Los pedidos de otros clientes no son
 * visibles: el backend no los devuelve. Estilo según la maqueta aprobada:
 * marca arriba, botón verde grande para el pedido nuevo y tarjetas blancas
 * con chip de estado coloreado. Sin catálogo ni buscador de productos: esas
 * funciones todavía no existen y no se simulan.
 *
 * Modo pestaña (modoTab): integrada en la concha principal, oculta la barra
 * de marca y el pie de sesión (los aporta la concha) y aplica el filtro de
 * búsqueda REAL sobre los pedidos ya cargados (coincidencia de texto sobre
 * tipo, direcciones, notas y estado).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BarraIdiomas, Boton, ChipEstado, Marca, MensajeError, COLORES } from "./components";
import { formatearDinero, formatearFecha } from "./formato";
import { texto, etiquetaEstado, type Idioma } from "./i18n";
import { listarPedidos, type FilaPedido } from "./pedidos";

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES.grisFondo,
  },
  barra: {
    backgroundColor: COLORES.blanco,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.borde,
  },
  filaMarca: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  titulo: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORES.grafito,
    marginTop: 8,
  },
  accion: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  lista: {
    paddingBottom: 32,
  },
  tarjeta: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORES.borde,
    backgroundColor: COLORES.blanco,
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
    marginRight: 8,
  },
  detalle: {
    color: COLORES.grisTexto,
    fontSize: 13,
    marginTop: 2,
  },
  filaTarifa: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
  },
  tarifaEtiqueta: {
    color: COLORES.grisTexto,
    fontSize: 12,
  },
  tarifaValor: {
    color: COLORES.verdeOscuro,
    fontWeight: "800",
    fontSize: 14,
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
  pie: {
    paddingVertical: 16,
    alignItems: "center",
  },
  accionTab: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  enlaceSalir: {
    color: COLORES.grisTexto,
    fontWeight: "700",
    fontSize: 13,
  },
});

interface Props {
  readonly idioma: Idioma;
  readonly alCambiarIdioma: (idioma: Idioma) => void;
  readonly cliente: SupabaseClient;
  readonly alAbrirDetalle: (pedidoId: string) => void;
  readonly alNuevoPedido: () => void;
  readonly alCerrarSesion: () => void;
  /** En pestaña de la concha principal: sin barra de marca ni pie de sesión. */
  readonly modoTab?: boolean;
  /** Texto de búsqueda real (filtra los pedidos cargados del propio cliente). */
  readonly filtro?: string;
}

export function PantallaListaPedidos({
  idioma,
  alCambiarIdioma,
  cliente,
  alAbrirDetalle,
  alNuevoPedido,
  alCerrarSesion,
  modoTab = false,
  filtro = "",
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

  /**
   * Filtro REAL sobre los pedidos cargados (RLS solo devuelve los propios):
   * compara en minúsculas y sin acentos contra tipo, direcciones, comercio,
   * notas y etiqueta de estado.
   */
  const pedidosFiltrados = useMemo<readonly FilaPedido[]>(() => {
    const consulta = filtro
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "");
    if (consulta.length === 0) {
      return pedidos;
    }
    return pedidos.filter((pedido) => {
      const aguja = [
        nombreTipo(pedido.order_type),
        pedido.pickup_address_text,
        pedido.dropoff_address_text,
        pedido.store_address_text ?? "",
        pedido.notes ?? "",
        pedido.status,
        etiquetaEstado(idioma, pedido.status),
      ]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\\u0300-\\u036f]/g, "");
      return aguja.includes(consulta);
    });
  }, [pedidos, filtro, idioma]);

  return (
    <View style={estilos.contenedor}>
      {modoTab ? (
        <View style={estilos.accionTab}>
          <Text style={estilos.titulo}>{texto(idioma, "mis_pedidos")}</Text>
        </View>
      ) : (
        <View style={estilos.barra}>
          <View style={estilos.filaMarca}>
            <Marca idioma={idioma} />
            <BarraIdiomas idioma={idioma} alCambiar={alCambiarIdioma} />
          </View>
          <Text style={estilos.titulo}>{texto(idioma, "mis_pedidos")}</Text>
        </View>
      )}
      <View style={estilos.accion}>
        <Boton textoBoton={texto(idioma, "nuevo_pedido")} alPulsar={alNuevoPedido} />
      </View>
      {error !== null ? <MensajeError mensaje={error} /> : null}
      <FlatList
        data={pedidosFiltrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={estilos.lista}
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
        ListFooterComponent={
          modoTab ? undefined : (
            <Pressable onPress={alCerrarSesion} style={estilos.pie}>
              <Text style={estilos.enlaceSalir}>{texto(idioma, "cerrar_sesion")}</Text>
            </Pressable>
          )
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
            <Text style={estilos.detalle} numberOfLines={1}>
              {texto(idioma, "recogida")}: {item.pickup_address_text}
            </Text>
            <Text style={estilos.detalle} numberOfLines={1}>
              {texto(idioma, "destino")}: {item.dropoff_address_text}
            </Text>
            <View style={estilos.filaTarifa}>
              <Text style={estilos.tarifaEtiqueta}>{texto(idioma, "tarifa_servicio")}</Text>
              <Text style={estilos.tarifaValor}>
                {formatearDinero(item.service_fee_amount, item.currency)}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
