/**
 * Componentes de interfaz reutilizables (README sección 8: componentes
 * reutilizables, contraste accesible, tipografía legible). Identidad visual
 * según la maqueta aprobada por el fundador (2026-11-13): verde profundo
 * para la marca y las acciones, tarjetas blancas con bordes suaves, chips de
 * estado coloreados según el estado REAL del pedido y selector de idiomas
 * siempre visible. Sin imágenes decorativas ni datos simulados: todo lo
 * visible proviene de la sesión o del backend real (ADR-0001).
 */
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { ETIQUETA_IDIOMA, etiquetaEstado, texto, type Idioma } from "./i18n";

export const COLORES = {
  verde: "#0E7C3A",
  verdeOscuro: "#0A5C2B",
  verdeClaro: "#E6F4EA",
  grafito: "#1F2421",
  blanco: "#FFFFFF",
  grisFondo: "#F4F6F5",
  grisTexto: "#5A6560",
  error: "#B3261E",
  errorClaro: "#FDECEA",
  ambarTexto: "#8A5A00",
  ambarClaro: "#FDF3D7",
  borde: "#D8DDD9",
} as const;

/** Orden visual del selector: el francés entra primero (decisión del fundador). */
const ORDEN_VISUAL_IDIOMAS: readonly Idioma[] = ["fr", "ht"];

/** Color del chip según el estado REAL del pedido (literales de la base de datos). */
const COLOR_ESTADO: Record<string, { readonly fondo: string; readonly texto: string }> = {
  draft: { fondo: COLORES.grisFondo, texto: COLORES.grisTexto },
  pending: { fondo: COLORES.ambarClaro, texto: COLORES.ambarTexto },
  offered: { fondo: COLORES.verdeClaro, texto: COLORES.verdeOscuro },
  accepted: { fondo: COLORES.verdeClaro, texto: COLORES.verdeOscuro },
  at_pickup: { fondo: COLORES.verdeClaro, texto: COLORES.verdeOscuro },
  picked_up: { fondo: COLORES.verdeClaro, texto: COLORES.verdeOscuro },
  in_transit: { fondo: COLORES.verdeClaro, texto: COLORES.verdeOscuro },
  delivered: { fondo: COLORES.verde, texto: COLORES.blanco },
  cancelled: { fondo: COLORES.errorClaro, texto: COLORES.error },
  issue: { fondo: COLORES.errorClaro, texto: COLORES.error },
};

const estilos = StyleSheet.create({
  marcaFila: {
    alignItems: "flex-start",
  },
  marcaCentrado: {
    alignItems: "center",
  },
  marcaTexto: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  marcaTextoVerde: {
    color: COLORES.verde,
  },
  marcaTextoGrafito: {
    color: COLORES.grafito,
  },
  marcaEtiqueta: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORES.verde,
    marginTop: 2,
    letterSpacing: 1,
  },
  etiqueta: {
    fontSize: 13,
    color: COLORES.grafito,
    marginBottom: 6,
    fontWeight: "600",
  },
  entrada: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORES.grafito,
    backgroundColor: COLORES.blanco,
    marginBottom: 12,
  },
  boton: {
    backgroundColor: COLORES.verde,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 4,
  },
  botonDeshabilitado: {
    backgroundColor: COLORES.borde,
  },
  botonTexto: {
    color: COLORES.blanco,
    fontSize: 15,
    fontWeight: "700",
  },
  botonSecundario: {
    backgroundColor: COLORES.verdeClaro,
    borderWidth: 1,
    borderColor: COLORES.verde,
  },
  botonSecundarioTexto: {
    color: COLORES.verdeOscuro,
  },
  botonPeligroso: {
    backgroundColor: COLORES.errorClaro,
    borderWidth: 1,
    borderColor: COLORES.error,
  },
  botonPeligrosoTexto: {
    color: COLORES.error,
  },
  botonEnlace: {
    backgroundColor: "transparent",
    paddingVertical: 12,
    alignItems: "center",
  },
  botonEnlaceTexto: {
    color: COLORES.verde,
    fontSize: 14,
    fontWeight: "700",
  },
  error: {
    color: COLORES.error,
    fontSize: 13,
    marginVertical: 8,
  },
  aviso: {
    color: COLORES.grafito,
    fontSize: 13,
    marginVertical: 8,
  },
  titulo: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORES.grafito,
  },
  seccion: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORES.grafito,
    marginTop: 16,
    marginBottom: 6,
  },
  tarjeta: {
    backgroundColor: COLORES.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: 16,
    shadowColor: COLORES.verdeOscuro,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  chipEstado: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: COLORES.grisFondo,
  },
  chipEstadoTexto: {
    fontSize: 12,
    fontWeight: "700",
  },
  filaIdiomas: {
    flexDirection: "row",
  },
  botonIdioma: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: COLORES.borde,
    backgroundColor: COLORES.blanco,
  },
  botonIdiomaActivo: {
    backgroundColor: COLORES.grafito,
    borderColor: COLORES.grafito,
  },
  textoIdioma: {
    fontSize: 12,
    color: COLORES.grafito,
    fontWeight: "700",
  },
  textoIdiomaActivo: {
    color: COLORES.blanco,
  },
});

/** Marca de texto: «KouriGo» + etiqueta de la maqueta (Livraison • Achat assisté). */
export function Marca({
  idioma,
  centrado = false,
}: {
  readonly idioma: Idioma;
  readonly centrado?: boolean;
}) {
  return (
    <View style={centrado ? estilos.marcaCentrado : estilos.marcaFila}>
      <Text style={estilos.marcaTexto}>
        <Text style={estilos.marcaTextoGrafito}>Kouri</Text>
        <Text style={estilos.marcaTextoVerde}>Go</Text>
      </Text>
      <Text style={estilos.marcaEtiqueta}>{texto(idioma, "etiqueta_marca")}</Text>
    </View>
  );
}

/** Selector de idiomas (Français primero; IDIOMAS conserva el orden canónico). */
export function BarraIdiomas({
  idioma,
  alCambiar,
}: {
  readonly idioma: Idioma;
  readonly alCambiar: (idioma: Idioma) => void;
}) {
  return (
    <View style={estilos.filaIdiomas}>
      {ORDEN_VISUAL_IDIOMAS.map((opcion) => (
        <Pressable
          key={opcion}
          onPress={() => alCambiar(opcion)}
          style={[estilos.botonIdioma, opcion === idioma ? estilos.botonIdiomaActivo : null]}
        >
          <Text style={[estilos.textoIdioma, opcion === idioma ? estilos.textoIdiomaActivo : null]}>
            {ETIQUETA_IDIOMA[opcion]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

interface CampoTextoProps {
  readonly etiqueta: string;
  readonly valor: string;
  readonly alCambiar: (valor: string) => void;
  readonly multilinea?: boolean;
  readonly numerico?: boolean;
  readonly secreta?: boolean;
}

export function CampoTexto({
  etiqueta,
  valor,
  alCambiar,
  multilinea = false,
  numerico = false,
  secreta = false,
}: CampoTextoProps) {
  return (
    <View>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        style={estilos.entrada}
        value={valor}
        onChangeText={alCambiar}
        multiline={multilinea}
        secureTextEntry={secreta}
        autoCapitalize="none"
        keyboardType={numerico ? "numeric" : "default"}
        numberOfLines={multilinea ? 3 : 1}
      />
    </View>
  );
}

interface BotonProps {
  readonly textoBoton: string;
  readonly alPulsar: () => void;
  readonly deshabilitado?: boolean;
  readonly secundario?: boolean;
  readonly peligroso?: boolean;
  readonly enlace?: boolean;
}

export function Boton({
  textoBoton,
  alPulsar,
  deshabilitado = false,
  secundario = false,
  peligroso = false,
  enlace = false,
}: BotonProps) {
  const estiloContenedor: ViewStyle[] = [estilos.boton];
  const estiloTexto: TextStyle[] = [estilos.botonTexto];
  if (deshabilitado) {
    estiloContenedor.push(estilos.botonDeshabilitado);
  }
  if (secundario) {
    estiloContenedor.push(estilos.botonSecundario);
    estiloTexto.push(estilos.botonSecundarioTexto);
  }
  if (peligroso) {
    estiloContenedor.push(estilos.botonPeligroso);
    estiloTexto.push(estilos.botonPeligrosoTexto);
  }
  if (enlace) {
    estiloContenedor.push(estilos.botonEnlace);
    estiloTexto.push(estilos.botonEnlaceTexto);
  }
  return (
    <Pressable
      disabled={deshabilitado}
      onPress={alPulsar}
      style={({ pressed }) => [estiloContenedor, pressed ? { opacity: 0.8 } : null]}
    >
      <Text style={estiloTexto}>{textoBoton}</Text>
    </Pressable>
  );
}

/** Tarjeta blanca con borde y sombra suave (estilo de la maqueta). */
export function Tarjeta({
  children,
  estilo,
}: {
  readonly children: ReactNode;
  readonly estilo?: ViewStyle;
}) {
  return <View style={[estilos.tarjeta, estilo]}>{children}</View>;
}

export function MensajeError({ mensaje }: { readonly mensaje: string }) {
  return <Text style={estilos.error}>{mensaje}</Text>;
}

export function Aviso({ mensaje }: { readonly mensaje: string }) {
  return <Text style={estilos.aviso}>{mensaje}</Text>;
}

export function Titulo({ children }: { readonly children: string }) {
  return <Text style={estilos.titulo}>{children}</Text>;
}

export function TituloSeccion({ children }: { readonly children: string }) {
  return <Text style={estilos.seccion}>{children}</Text>;
}

export function ChipEstado({
  idioma,
  estado,
}: {
  readonly idioma: Idioma;
  readonly estado: string;
}) {
  const color = COLOR_ESTADO[estado] ?? { fondo: COLORES.grisFondo, texto: COLORES.grisTexto };
  return (
    <View style={[estilos.chipEstado, { backgroundColor: color.fondo }]}>
      <Text style={[estilos.chipEstadoTexto, { color: color.texto }]}>
        {etiquetaEstado(idioma, estado)}
      </Text>
    </View>
  );
}
