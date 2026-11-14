import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA } from "../theme/tokens";

export interface BotonPrimarioProps {
  readonly etiqueta: string;
  readonly alPulsar: () => void;
  readonly deshabilitado?: boolean;
  readonly compacto?: boolean;
  readonly slotIconoIzquierda?: ReactNode;
  readonly slotIconoDerecha?: ReactNode;
  readonly estilo?: ViewStyle;
}

const estilos = StyleSheet.create({
  boton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORES.verdeProfundo,
    borderRadius: RADIOS.md,
    paddingHorizontal: ESPACIADO.lg,
    paddingVertical: ESPACIADO.md,
    minHeight: 46,
    gap: ESPACIADO.sm,
  },
  botonCompacto: {
    borderRadius: RADIOS.sm,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.sm,
    minHeight: 36,
    alignSelf: "flex-start",
  },
  botonDeshabilitado: {
    backgroundColor: COLORES.borde,
  },
  texto: {
    ...TIPOGRAFIA.botonPrimario,
    color: COLORES.blanco,
  },
  textoCompacto: {
    fontSize: 12,
    lineHeight: 16,
  },
  textoDeshabilitado: {
    color: COLORES.grisTexto,
  },
  icono: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export function BotonPrimario({
  etiqueta,
  alPulsar,
  deshabilitado = false,
  compacto = false,
  slotIconoIzquierda,
  slotIconoDerecha,
  estilo,
}: BotonPrimarioProps) {
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
        pressed && !deshabilitado ? { opacity: 0.85 } : null,
        estilo,
      ]}
    >
      {slotIconoIzquierda !== undefined ? (
        <View style={estilos.icono}>{slotIconoIzquierda}</View>
      ) : null}
      <Text
        style={[
          estilos.texto,
          compacto ? estilos.textoCompacto : null,
          deshabilitado ? estilos.textoDeshabilitado : null,
        ]}
        numberOfLines={1}
      >
        {etiqueta}
      </Text>
      {slotIconoDerecha !== undefined ? (
        <View style={estilos.icono}>{slotIconoDerecha}</View>
      ) : null}
    </Pressable>
  );
}
