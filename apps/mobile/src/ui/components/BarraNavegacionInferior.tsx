import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORES, ESPACIADO, RADIOS, SOMBRAS, TIPOGRAFIA } from "../theme/tokens";

export interface ElementoNavegacionInferior {
  readonly clave: string;
  readonly etiqueta: string;
  readonly renderIcono: (activo: boolean) => ReactNode;
  readonly insigniaNotificaciones?: number;
}

export interface BarraNavegacionInferiorProps {
  readonly elementos: readonly ElementoNavegacionInferior[];
  readonly claveActiva: string;
  readonly alSeleccionar: (clave: string) => void;
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORES.blanco,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
    paddingTop: ESPACIADO.sm,
    paddingBottom: ESPACIADO.md,
    paddingHorizontal: ESPACIADO.xs,
    ...SOMBRAS.barraInferior,
  },
  pestana: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: ESPACIADO.xs,
  },
  iconoContenedor: {
    position: "relative",
    width: 28,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: RADIOS.pill,
    backgroundColor: COLORES.rojoBadge,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: COLORES.blanco,
  },
  badgeTexto: {
    color: COLORES.blanco,
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 11,
  },
  etiqueta: {
    ...TIPOGRAFIA.tabEtiqueta,
    marginTop: 3,
    textAlign: "center",
  },
  etiquetaActiva: {
    color: COLORES.verdeMedio,
    fontWeight: "700",
  },
  etiquetaInactiva: {
    color: COLORES.grisIconoInactivo,
  },
});

export function BarraNavegacionInferior({
  elementos,
  claveActiva,
  alSeleccionar,
}: BarraNavegacionInferiorProps) {
  if (elementos.length === 0) {
    return null;
  }

  return (
    <View style={estilos.barra}>
      {elementos.map((elemento) => {
        const activo = elemento.clave === claveActiva;
        const insignia = elemento.insigniaNotificaciones;

        return (
          <Pressable
            key={elemento.clave}
            onPress={() => alSeleccionar(elemento.clave)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
            style={estilos.pestana}
          >
            <View style={estilos.iconoContenedor}>
              {elemento.renderIcono(activo)}
              {insignia !== undefined && insignia > 0 ? (
                <View style={estilos.badge}>
                  <Text style={estilos.badgeTexto}>
                    {insignia > 99 ? "99+" : String(insignia)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                estilos.etiqueta,
                activo ? estilos.etiquetaActiva : estilos.etiquetaInactiva,
              ]}
              numberOfLines={1}
            >
              {elemento.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
