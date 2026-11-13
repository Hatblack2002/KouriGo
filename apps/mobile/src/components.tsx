/**
 * Componentes de interfaz reutilizables (README sección 8: componentes
 * reutilizables, contraste accesible, tipografía legible). Verde para
 * acciones, grafito para contraste y blanco para legibilidad. Los colores
 * exactos son provisionales hasta la fase de identidad visual.
 */
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { etiquetaEstado, type Idioma } from "./i18n.js";

export const COLORES = {
  verde: "#0E7C3A",
  grafito: "#1F2421",
  blanco: "#FFFFFF",
  grisFondo: "#F2F4F3",
  grisTexto: "#5A6560",
  error: "#B3261E",
  borde: "#D8DDD9",
} as const;

const estilos = StyleSheet.create({
  etiqueta: {
    fontSize: 13,
    color: COLORES.grafito,
    marginBottom: 4,
    fontWeight: "600",
  },
  entrada: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORES.grafito,
    backgroundColor: COLORES.blanco,
    marginBottom: 12,
  },
  boton: {
    backgroundColor: COLORES.verde,
    borderRadius: 8,
    paddingVertical: 12,
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
    backgroundColor: COLORES.grisFondo,
    borderWidth: 1,
    borderColor: COLORES.grafito,
  },
  botonSecundarioTexto: {
    color: COLORES.grafito,
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
  chipEstado: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: COLORES.grisFondo,
    borderWidth: 1,
    borderColor: COLORES.borde,
  },
  chipEstadoTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORES.grafito,
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
});

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
}

export function Boton({
  textoBoton,
  alPulsar,
  deshabilitado = false,
  secundario = false,
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
  return (
    <View style={estilos.chipEstado}>
      <Text style={estilos.chipEstadoTexto}>{etiquetaEstado(idioma, estado)}</Text>
    </View>
  );
}
