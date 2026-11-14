import { StyleSheet, Text, View } from "react-native";
import { etiquetaEstadoUI, type Idioma } from "../i18n/diccionario-ui";
import { COLORES, COLOR_ESTADO, ESPACIADO, RADIOS, TIPOGRAFIA } from "../theme/tokens";

export interface ChipEstadoProps {
  readonly idioma: Idioma;
  readonly estado: string;
  readonly etiquetaPersonalizada?: string;
}

const estilos = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    borderRadius: RADIOS.pill,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.xs,
  },
  texto: {
    ...TIPOGRAFIA.chipTexto,
  },
});

export function ChipEstado({ idioma, estado, etiquetaPersonalizada }: ChipEstadoProps) {
  const etiqueta = etiquetaPersonalizada ?? etiquetaEstadoUI(idioma, estado);
  if (etiqueta.trim().length === 0) {
    return null;
  }

  const paleta = COLOR_ESTADO[estado] ?? {
    fondo: COLORES.grisFondo,
    texto: COLORES.grisTexto,
  };

  return (
    <View style={[estilos.chip, { backgroundColor: paleta.fondo }]}>
      <Text style={[estilos.texto, { color: paleta.texto }]} numberOfLines={1}>
        {etiqueta}
      </Text>
    </View>
  );
}
