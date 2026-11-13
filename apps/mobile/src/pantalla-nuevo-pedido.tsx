/**
 * Pantalla «Nouvelle commande» (README sección 3.1 y 3.2): crea un pedido
 * REAL en borrador (orders + order_items vía PostgREST bajo RLS). La moneda
 * y la tarifa se piden sin valores por defecto: son decisiones pendientes
 * del fundador (README sección 22). Antes de enviar, la app revalida con
 * las reglas compartidas de @kourigo/domain; el backend vuelve a validar.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArticuloPedido, TipoPedido } from "@kourigo/domain";
import { Boton, CampoTexto, MensajeError, Titulo, COLORES } from "./components";
import {
  crearPedidoBorrador,
  validarFormularioPedido,
  type DatosFormularioPedido,
} from "./pedidos";
import { texto, type ClaveTexto, type Idioma } from "./i18n";

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES.blanco,
  },
  contenido: {
    padding: 16,
    paddingBottom: 32,
  },
  filaTipo: {
    flexDirection: "row",
    marginTop: 12,
    marginBottom: 12,
  },
  opcionTipo: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
    alignItems: "center",
    backgroundColor: COLORES.grisFondo,
  },
  opcionTipoActiva: {
    borderColor: COLORES.verde,
    backgroundColor: COLORES.blanco,
  },
  textoTipo: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORES.grafito,
  },
  filaPar: {
    flexDirection: "row",
  },
  columna: {
    flex: 1,
    marginRight: 8,
  },
  item: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: COLORES.grisFondo,
  },
  filaItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  tituloItem: {
    fontWeight: "700",
    color: COLORES.grafito,
    fontSize: 13,
  },
  botonQuitar: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  textoQuitar: {
    color: COLORES.error,
    fontWeight: "700",
    fontSize: 13,
  },
  agregar: {
    marginTop: 4,
    marginBottom: 12,
  },
});

interface Props {
  readonly idioma: Idioma;
  readonly cliente: SupabaseClient;
  readonly alCreado: (pedidoId: string) => void;
}

interface ArticuloFormulario {
  readonly descripcion: string;
  readonly cantidad: string;
  readonly precio: string;
}

function articuloInicial(): ArticuloFormulario {
  return { descripcion: "", cantidad: "1", precio: "" };
}

export function PantallaNuevoPedido({ idioma, cliente, alCreado }: Props) {
  const [tipo, setTipo] = useState<TipoPedido>("delivery");
  const [recogida, setRecogida] = useState("");
  const [destino, setDestino] = useState("");
  const [comercio, setComercio] = useState("");
  const [notas, setNotas] = useState("");
  const [moneda, setMoneda] = useState("");
  const [tarifa, setTarifa] = useState("");
  const [articulos, setArticulos] = useState<readonly ArticuloFormulario[]>([articuloInicial()]);
  const [errores, setErrores] = useState<readonly ClaveTexto[]>([]);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const items = useMemo<readonly ArticuloPedido[]>(() => {
    return articulos.map((articulo) => {
      const textoPrecio = articulo.precio.trim();
      const precio =
        textoPrecio.length > 0 && /^[0-9]+$/.test(textoPrecio) ? Number(textoPrecio) : undefined;
      return {
        descripcion: articulo.descripcion,
        cantidad: /^[0-9]+$/.test(articulo.cantidad.trim())
          ? Number(articulo.cantidad.trim())
          : Number.NaN,
        precioEstimado: precio,
      };
    });
  }, [articulos]);

  function nombreTipo(opcion: TipoPedido): string {
    if (opcion === "assisted_purchase") {
      return texto(idioma, "tipo_compra_asistida");
    }
    return texto(idioma, "tipo_entrega");
  }

  function cambiarArticulo(indice: number, cambios: Partial<ArticuloFormulario>): void {
    setArticulos(
      articulos.map((articulo, i) => (i === indice ? { ...articulo, ...cambios } : articulo)),
    );
  }

  function quitarArticulo(indice: number): void {
    if (articulos.length <= 1) {
      setArticulos([articuloInicial()]);
      return;
    }
    setArticulos(articulos.filter((_articulo, i) => i !== indice));
  }

  async function enviar() {
    setErrorServidor(null);
    const datos: DatosFormularioPedido = {
      tipo,
      recogidaTexto: recogida,
      destinoTexto: destino,
      comercioTexto: comercio.trim().length > 0 ? comercio.trim() : null,
      notas: notas.trim().length > 0 ? notas.trim() : null,
      moneda: moneda.trim().toUpperCase(),
      tarifaServicio: /^[0-9]+$/.test(tarifa.trim()) ? Number(tarifa.trim()) : Number.NaN,
      items,
    };
    const claves = validarFormularioPedido(datos);
    if (claves.length > 0) {
      setErrores(claves);
      return;
    }
    setErrores([]);
    setCargando(true);
    const resultado = await crearPedidoBorrador(cliente, datos);
    setCargando(false);
    if (resultado.tipo === "ok") {
      alCreado(resultado.datos.id);
      return;
    }
    setErrorServidor(resultado.mensaje);
  }

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      <Titulo>{texto(idioma, "nuevo_pedido")}</Titulo>
      <View style={estilos.filaTipo}>
        {(["delivery", "assisted_purchase"] as readonly TipoPedido[]).map((opcion) => (
          <Pressable
            key={opcion}
            onPress={() => setTipo(opcion)}
            style={[estilos.opcionTipo, tipo === opcion ? estilos.opcionTipoActiva : null]}
          >
            <Text style={estilos.textoTipo}>{nombreTipo(opcion)}</Text>
          </Pressable>
        ))}
      </View>
      <CampoTexto
        etiqueta={texto(idioma, "recogida")}
        valor={recogida}
        alCambiar={setRecogida}
        multilinea={true}
      />
      <CampoTexto
        etiqueta={texto(idioma, "destino")}
        valor={destino}
        alCambiar={setDestino}
        multilinea={true}
      />
      {tipo === "assisted_purchase" ? (
        <CampoTexto etiqueta={texto(idioma, "comercio")} valor={comercio} alCambiar={setComercio} />
      ) : null}
      <CampoTexto
        etiqueta={texto(idioma, "notas")}
        valor={notas}
        alCambiar={setNotas}
        multilinea={true}
      />
      <View style={estilos.filaPar}>
        <View style={estilos.columna}>
          <CampoTexto etiqueta={texto(idioma, "moneda")} valor={moneda} alCambiar={setMoneda} />
        </View>
        <View style={estilos.columna}>
          <CampoTexto
            etiqueta={texto(idioma, "tarifa_servicio")}
            valor={tarifa}
            alCambiar={setTarifa}
            numerico={true}
          />
        </View>
      </View>
      <View style={estilos.agregar}>
        <Boton
          textoBoton={texto(idioma, "agregar_articulo")}
          alPulsar={() => setArticulos([...articulos, articuloInicial()])}
          secundario={true}
        />
      </View>
      {articulos.map((articulo, indice) => (
        <View key={indice} style={estilos.item}>
          <View style={estilos.filaItem}>
            <Text style={estilos.tituloItem}>{`${indice + 1}`}</Text>
            <Pressable onPress={() => quitarArticulo(indice)} style={estilos.botonQuitar}>
              <Text style={estilos.textoQuitar}>{texto(idioma, "quitar")}</Text>
            </Pressable>
          </View>
          <CampoTexto
            etiqueta={texto(idioma, "articulos")}
            valor={articulo.descripcion}
            alCambiar={(valor) => cambiarArticulo(indice, { descripcion: valor })}
          />
          <View style={estilos.filaPar}>
            <View style={estilos.columna}>
              <CampoTexto
                etiqueta={texto(idioma, "cantidad")}
                valor={articulo.cantidad}
                alCambiar={(valor) => cambiarArticulo(indice, { cantidad: valor })}
                numerico={true}
              />
            </View>
            <View style={estilos.columna}>
              <CampoTexto
                etiqueta={texto(idioma, "precio_estimado")}
                valor={articulo.precio}
                alCambiar={(valor) => cambiarArticulo(indice, { precio: valor })}
                numerico={true}
              />
            </View>
          </View>
        </View>
      ))}
      {errores.map((clave) => (
        <MensajeError key={clave} mensaje={texto(idioma, clave)} />
      ))}
      {errorServidor !== null ? <MensajeError mensaje={errorServidor} /> : null}
      <Boton
        textoBoton={cargando ? texto(idioma, "cargando") : texto(idioma, "crear_borrador")}
        alPulsar={() => {
          void enviar();
        }}
        deshabilitado={cargando}
      />
    </ScrollView>
  );
}
