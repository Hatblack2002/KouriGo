import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { textoUI, type ClaveTextoUI, type Idioma } from "../i18n/diccionario-ui";
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA } from "../theme/tokens";
import { LogoKouriGo } from "./IconosUI";

export interface EncabezadoLogoProps {
  readonly idioma: Idioma;
  readonly variante?: "marca" | "titulo";
  readonly tituloClave?: ClaveTextoUI;
  readonly subtituloClave?: ClaveTextoUI;
  readonly mostrarSubtituloMarca?: boolean;
  readonly slotLogo?: ReactNode;
  readonly slotIzquierda?: ReactNode;
  readonly slotDerecha?: ReactNode;
  readonly alPulsarIzquierda?: () => void;
  readonly alPulsarDerecha?: () => void;
  readonly badgeDerecha?: number;
}

const estilos = StyleSheet.create({
  contenedor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORES.blanco,
    paddingHorizontal: ESPACIADO.lg,
    paddingVertical: ESPACIADO.md,
    minHeight: 60,
  },
  contenedorConBorde: {
    borderBottomWidth: 1,
    borderBottomColor: COLORES.divisor,
  },
  ladoIzquierdo: {
    width: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  ladoDerecho: {
    width: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  botonIcono: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIOS.pill,
  },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  marcaFila: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  marcaKouri: {
    ...TIPOGRAFIA.logoWordmark,
    color: COLORES.logoGrafito,
  },
  marcaGo: {
    ...TIPOGRAFIA.logoWordmark,
    color: COLORES.verdeLogoG,
  },
  marcaSubtitulo: {
    ...TIPOGRAFIA.logoSubtitulo,
    color: COLORES.grisTexto,
    marginTop: ESPACIADO.xxs,
  },
  subtituloRol: {
    ...TIPOGRAFIA.logoSubtitulo,
    color: COLORES.verdeMedio,
    marginTop: ESPACIADO.xxs,
    fontWeight: "700",
  },
  tituloPantalla: {
    ...TIPOGRAFIA.tituloPantalla,
    color: COLORES.grafito,
    textAlign: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: RADIOS.pill,
    backgroundColor: COLORES.rojoBadge,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeTexto: {
    color: COLORES.blanco,
    fontSize: 10,
    fontWeight: "800",
  },
});

export function EncabezadoLogo({
  idioma,
  variante = "marca",
  tituloClave,
  subtituloClave,
  mostrarSubtituloMarca = true,
  slotLogo,
  slotIzquierda,
  slotDerecha,
  alPulsarIzquierda,
  alPulsarDerecha,
  badgeDerecha,
}: EncabezadoLogoProps) {
  const mostrarBadge = badgeDerecha !== undefined && badgeDerecha > 0;

  return (
    <View style={[estilos.contenedor, variante === "titulo" ? estilos.contenedorConBorde : null]}>
      <View style={estilos.ladoIzquierdo}>
        {slotIzquierda !== undefined ? (
          alPulsarIzquierda !== undefined ? (
            <Pressable
              onPress={alPulsarIzquierda}
              style={estilos.botonIcono}
              accessibilityRole="button"
            >
              {slotIzquierda}
            </Pressable>
          ) : (
            <View style={estilos.botonIcono}>{slotIzquierda}</View>
          )
        ) : null}
      </View>

      <View style={estilos.centro}>
        {variante === "titulo" && tituloClave !== undefined ? (
          <Text style={estilos.tituloPantalla} numberOfLines={1}>
            {textoUI(idioma, tituloClave)}
          </Text>
        ) : (
          <>
            {slotLogo !== undefined ? (
              slotLogo
            ) : (
              <LogoKouriGo
                subtitulo={
                  subtituloClave !== undefined
                    ? textoUI(idioma, subtituloClave)
                    : mostrarSubtituloMarca
                      ? textoUI(idioma, "etiqueta_marca")
                      : undefined
                }
                colorSubtitulo={
                  subtituloClave !== undefined ? COLORES.verdeMedio : COLORES.grisTexto
                }
              />
            )}
          </>
        )}
      </View>

      <View style={estilos.ladoDerecho}>
        {slotDerecha !== undefined ? (
          alPulsarDerecha !== undefined ? (
            <Pressable
              onPress={alPulsarDerecha}
              style={estilos.botonIcono}
              accessibilityRole="button"
            >
              {slotDerecha}
              {mostrarBadge ? (
                <View style={estilos.badge}>
                  <Text style={estilos.badgeTexto}>{badgeDerecha}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : (
            <View style={estilos.botonIcono}>
              {slotDerecha}
              {mostrarBadge ? (
                <View style={estilos.badge}>
                  <Text style={estilos.badgeTexto}>{badgeDerecha}</Text>
                </View>
              ) : null}
            </View>
          )
        ) : null}
      </View>
    </View>
  );
}
