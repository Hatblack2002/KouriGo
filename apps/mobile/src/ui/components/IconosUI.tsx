import { Image, StyleSheet, Text, View } from "react-native";
import {
  DEGRADADOS_BASE64,
  ICONOS_BASE64,
  type NombreIconoUI,
} from "../assets/iconos-base64";
import { COLORES, TIPOGRAFIA } from "../theme/tokens";

export interface IconoUIProps {
  readonly nombre: NombreIconoUI;
  readonly tamano?: number;
  readonly color?: string;
}

export function IconoUI({ nombre, tamano = 20, color }: IconoUIProps) {
  return (
    <Image
      source={{ uri: ICONOS_BASE64[nombre] }}
      style={{
        width: tamano,
        height: tamano,
        ...(color !== undefined ? { tintColor: color } : {}),
      }}
      resizeMode="contain"
      accessibilityElementsHidden={true}
    />
  );
}

export interface LogoKouriGoProps {
  readonly subtitulo?: string;
  readonly colorSubtitulo?: string;
}

const estilosLogo = StyleSheet.create({
  contenedor: {
    alignItems: "center",
    justifyContent: "center",
  },
  emblema: {
    width: 34,
    height: 22,
    marginBottom: 1,
  },
  filaTexto: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  kouri: {
    ...TIPOGRAFIA.logoWordmark,
    fontSize: 22,
    lineHeight: 24,
    color: COLORES.logoGrafito,
  },
  go: {
    ...TIPOGRAFIA.logoWordmark,
    fontSize: 22,
    lineHeight: 24,
    color: COLORES.verdeLogoG,
  },
  subtitulo: {
    ...TIPOGRAFIA.logoSubtitulo,
    marginTop: 1,
  },
});

export function LogoKouriGo({
  subtitulo,
  colorSubtitulo = COLORES.grisTexto,
}: LogoKouriGoProps) {
  return (
    <View style={estilosLogo.contenedor}>
      <Image
        source={{ uri: ICONOS_BASE64.kourigoEmblem }}
        style={estilosLogo.emblema}
        resizeMode="contain"
        accessibilityElementsHidden={true}
      />
      <View style={estilosLogo.filaTexto}>
        <Text style={estilosLogo.kouri}>Kouri</Text>
        <Text style={estilosLogo.go}>Go</Text>
      </View>
      {subtitulo !== undefined && subtitulo.trim().length > 0 ? (
        <Text style={[estilosLogo.subtitulo, { color: colorSubtitulo }]} numberOfLines={1}>
          {subtitulo}
        </Text>
      ) : null}
    </View>
  );
}

const estilosBandera = StyleSheet.create({
  bandera: {
    width: 36,
    height: 24,
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORES.borde,
  },
  franjaAzul: {
    flex: 1,
    backgroundColor: "#00209F",
  },
  franjaRoja: {
    flex: 1,
    backgroundColor: "#D21034",
  },
  escudoCentro: {
    position: "absolute",
    top: 7,
    left: 13,
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  escudoDetalle: {
    width: 4,
    height: 6,
    borderRadius: 1,
    backgroundColor: "#0E7C3A",
  },
});

export function BanderaHaiti() {
  return (
    <View style={estilosBandera.bandera} accessibilityElementsHidden={true}>
      <View style={estilosBandera.franjaAzul} />
      <View style={estilosBandera.franjaRoja} />
      <View style={estilosBandera.escudoCentro}>
        <View style={estilosBandera.escudoDetalle} />
      </View>
    </View>
  );
}

export interface FondoDegradadoProps {
  readonly tipo: keyof typeof DEGRADADOS_BASE64;
}

export function FondoDegradado({ tipo }: FondoDegradadoProps) {
  return (
    <Image
      source={{ uri: DEGRADADOS_BASE64[tipo] }}
      style={StyleSheet.absoluteFillObject}
      resizeMode="stretch"
      accessibilityElementsHidden={true}
    />
  );
}
