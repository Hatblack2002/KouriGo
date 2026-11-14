import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA } from "../theme/tokens";

export interface BotonSecundarioProps {
  readonly etiqueta: string;
  readonly alPulsar: () => void;
  readonly deshabilitado?: boolean;
  readonly compacto?: boolean;
  readonly slotIconoIzquierda?: ReactNode;
  readonly estilo?: ViewStyle;
}

const estilos = StyleSheet.create({
  boton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORES.blanco,
    borderWidth: 1,
    borderColor: COLORES.bordeSecundario,
    borderRadius: RADIOS.md,
    paddingHorizontal: ESPACIADO.lg,
    paddingVertical: 11,
    minHeight: 44,
    gap: ESPACIADO.sm,
  },
  botonCompacto: {
    borderRadius: RADIOS.sm,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: 6,
    minHeight: 34,
    borderColor: COLORES.borde,
  },
  botonDeshabilitado: {
    opacity: 0.5,
  },
  texto: {
    ...TIPOGRAFIA.botonSecundario,
    color: COLORES.verdeProfundo,
  },
  textoCompacto: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORES.textoPrincipal,
  },
  icono: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export function BotonSecundario({
  etiqueta,
  alPulsar,
  deshabilitado = false,
  compacto = false,
  slotIconoIzquierda,
  estilo,
}: BotonSecundarioProps) {
  if (etiqueta.trim().length === 0) {
    return null;
  }

  return (
    <Pressable
      disabled={deshabilitado}
      onPress={alPulsar}
      accessibilityRole="button"
      style={({ pressed }) => [
        estilos.boton,
        compacto ? estilos.botonCompacto : null,
        deshabilitado ? estilos.botonDeshabilitado : null,
        pressed && !deshabilitado ? { opacity: 0.8 } : null,
        estilo,
      ]}
    >
      {slotIconoIzquierda !== undefined ? (
        <View style={estilos.icono}>{slotIconoIzquierda}</View>
      ) : null}
      <Text
        style={[estilos.texto, compacto ? estilos.textoCompacto : null]}
        numberOfLines={1}
      >
        {etiqueta}
      </Text>
    </Pressable>
  );
}
