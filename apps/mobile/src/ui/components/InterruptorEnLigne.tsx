import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { textoUI, type Idioma } from "../i18n/diccionario-ui";
import { COLORES, ESPACIADO, RADIOS, SOMBRAS, TIPOGRAFIA } from "../theme/tokens";

export interface InterruptorEnLigneProps {
  readonly idioma: Idioma;
  readonly enLinea: boolean;
  readonly alCambiar: (nuevoValor: boolean) => void;
  readonly deshabilitado?: boolean;
  readonly slotFondoDegradado?: ReactNode;
}

const estilos = StyleSheet.create({
  contenedor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: RADIOS.lg,
    paddingHorizontal: ESPACIADO.lg,
    paddingVertical: ESPACIADO.lg,
    overflow: "hidden",
    ...SOMBRAS.tarjeta,
  },
  fondoActivo: {
    backgroundColor: COLORES.verdeBannerEnLinea,
  },
  fondoInactivo: {
    backgroundColor: COLORES.grisTexto,
  },
  fondoSlot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  textos: {
    flex: 1,
    marginRight: ESPACIADO.md,
  },
  titulo: {
    ...TIPOGRAFIA.bannerTitulo,
    color: COLORES.blanco,
  },
  subtitulo: {
    ...TIPOGRAFIA.cuerpoMedio,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 2,
  },
  pista: {
    width: 56,
    height: 32,
    borderRadius: RADIOS.pill,
    padding: 3,
    justifyContent: "center",
  },
  pistaActiva: {
    backgroundColor: COLORES.verdeProfundo,
    alignItems: "flex-end",
  },
  pistaInactiva: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    alignItems: "flex-start",
  },
  pulgar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORES.blanco,
    shadowColor: COLORES.sombra,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
});

export function InterruptorEnLigne({
  idioma,
  enLinea,
  alCambiar,
  deshabilitado = false,
  slotFondoDegradado,
}: InterruptorEnLigneProps) {
  return (
    <View style={[estilos.contenedor, enLinea ? estilos.fondoActivo : estilos.fondoInactivo]}>
      {slotFondoDegradado !== undefined ? (
        <View style={estilos.fondoSlot} pointerEvents="none">
          {slotFondoDegradado}
        </View>
      ) : null}

      <View style={estilos.textos}>
        <Text style={estilos.titulo} numberOfLines={1}>
          {textoUI(idioma, enLinea ? "estado_en_linea" : "estado_fuera_linea")}
        </Text>
        <Text style={estilos.subtitulo} numberOfLines={1}>
          {textoUI(idioma, enLinea ? "recibiendo_pedidos" : "no_recibiendo_pedidos")}
        </Text>
      </View>

      <Pressable
        disabled={deshabilitado}
        onPress={() => alCambiar(!enLinea)}
        accessibilityRole="switch"
        accessibilityState={{ checked: enLinea, disabled: deshabilitado }}
        style={[
          estilos.pista,
          enLinea ? estilos.pistaActiva : estilos.pistaInactiva,
          deshabilitado ? { opacity: 0.6 } : null,
        ]}
      >
        <View style={estilos.pulgar} />
      </Pressable>
    </View>
  );
}
