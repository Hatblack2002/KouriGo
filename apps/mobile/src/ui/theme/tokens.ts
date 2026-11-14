import { Platform, type TextStyle, type ViewStyle } from "react-native";

/**
 * Tokens de diseño extraídos de la maqueta aprobada de KouriGo
 * y alineados con la paleta base de apps/mobile/src/components.tsx.
 */
export const COLORES = {
  // Verdes de marca
  verdeProfundo: "#015A23",
  verdeHeroOscuro: "#014B20",
  verdeMedio: "#0E7C3A",
  verdeBannerEnLinea: "#17833A",
  verdeLogoG: "#076E24",
  verdeTimeline: "#047A1B",
  verdeOscuro: "#0A5C2B",
  verdeMentaClaro: "#E5F1E8",
  verdeMentaVerificado: "#E1EFE4",
  verdeClaro: "#E6F4EA",

  // Neutros de superficie y texto
  blanco: "#FFFFFF",
  grisFondo: "#F9FAFC",
  grisSuperficie: "#F0F5F8",
  borde: "#E5E8ED",
  divisor: "#EBEDF1",
  bordeSecundario: "#C7DED2",
  logoGrafito: "#032A27",
  grafito: "#0D1412",
  textoPrincipal: "#1F2421",
  grisTexto: "#5A6560",
  grisIconoInactivo: "#7B8480",
  grisPlaceholder: "#8C9691",

  // Semánticos y acentos
  rojoBadge: "#F21829",
  amarilloEstrella: "#F2A222",
  error: "#B3261E",
  errorClaro: "#FDECEA",
  ambarTexto: "#8A5A00",
  ambarClaro: "#FDF3D7",
  sombra: "#032A27",

  // Alias compatibles con apps/mobile/src/components.tsx
  verde: "#0E7C3A",
} as const;

/**
 * Colores exactos de los chips de estado (estados reales de @kourigo/domain
 * + chips visuales de la maqueta).
 */
export const COLOR_ESTADO: Record<string, { readonly fondo: string; readonly texto: string }> = {
  draft: { fondo: "#F0F2F4", texto: "#5A6560" },
  pending: { fondo: "#FDF3D7", texto: "#8A5A00" },
  offered: { fondo: "#CAF3DD", texto: "#065F2D" },
  accepted: { fondo: "#E5F1E8", texto: "#0E7C3A" },
  at_pickup: { fondo: "#E5F1E8", texto: "#0E7C3A" },
  picked_up: { fondo: "#CCF4C4", texto: "#0A5C2B" },
  in_transit: { fondo: "#CCF4C4", texto: "#0A5C2B" },
  delivered: { fondo: "#015A23", texto: "#FFFFFF" },
  cancelled: { fondo: "#FDECEA", texto: "#B3261E" },
  issue: { fondo: "#FDECEA", texto: "#B3261E" },
};

export const FAMILIA_FUENTE = {
  regular: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
  media: Platform.select({ ios: "System", android: "sans-serif-medium", default: "System" }),
  negrita: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
} as const;

export const TIPOGRAFIA: Record<string, TextStyle> = {
  heroTitulo: {
    fontFamily: FAMILIA_FUENTE.negrita,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  heroSubtitulo: {
    fontFamily: FAMILIA_FUENTE.regular,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  logoWordmark: {
    fontFamily: FAMILIA_FUENTE.negrita,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  logoSubtitulo: {
    fontFamily: FAMILIA_FUENTE.media,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
  },
  tituloPantalla: {
    fontFamily: FAMILIA_FUENTE.negrita,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
  },
  bannerTitulo: {
    fontFamily: FAMILIA_FUENTE.negrita,
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 25,
  },
  tituloSeccion: {
    fontFamily: FAMILIA_FUENTE.negrita,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  kpiValor: {
    fontFamily: FAMILIA_FUENTE.negrita,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
  },
  kpiEtiqueta: {
    fontFamily: FAMILIA_FUENTE.regular,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 14,
  },
  tarjetaTitulo: {
    fontFamily: FAMILIA_FUENTE.negrita,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  precioDestacado: {
    fontFamily: FAMILIA_FUENTE.negrita,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
  },
  cuerpo: {
    fontFamily: FAMILIA_FUENTE.regular,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
  },
  cuerpoMedio: {
    fontFamily: FAMILIA_FUENTE.media,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  etiquetaPequena: {
    fontFamily: FAMILIA_FUENTE.media,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  chipTexto: {
    fontFamily: FAMILIA_FUENTE.negrita,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  botonPrimario: {
    fontFamily: FAMILIA_FUENTE.negrita,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  botonSecundario: {
    fontFamily: FAMILIA_FUENTE.negrita,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  tabEtiqueta: {
    fontFamily: FAMILIA_FUENTE.media,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
  },
};

export const ESPACIADO = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const RADIOS = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  pill: 999,
} as const;

export const SOMBRAS: Record<"tarjeta" | "barraInferior", ViewStyle> = {
  tarjeta: {
    shadowColor: COLORES.sombra,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  barraInferior: {
    shadowColor: COLORES.sombra,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 6,
  },
};
