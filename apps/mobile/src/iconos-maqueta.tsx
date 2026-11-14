/**
 * Glifos decorativos del kit de la maqueta, dibujados solo con Views y
 * Textos puntuales (sin emojis, sin assets externos, sin dependencias
 * nuevas). Son iconografía de marca: NO contienen datos del backend.
 */
import { StyleSheet, Text, View } from "react-native";
import { COLORES } from "./ui/theme/tokens";

const tamanos = StyleSheet.create({
  caja: {
    alignItems: "center",
    justifyContent: "center",
  },
});

interface PropsIcono {
  readonly color?: string;
  readonly tamano?: number;
}

/** Tres barras horizontales (menú). */
export function IconoMenu({ color = COLORES.grafito, tamano = 20 }: PropsIcono) {
  return (
    <View style={tamanos.caja} accessibilityElementsHidden={true}>
      <View style={{ width: tamano, height: 2, borderRadius: 1, backgroundColor: color }} />
      <View
        style={{
          width: tamano * 0.72,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
          marginTop: 4,
        }}
      />
      <View style={{ width: tamano, height: 2, borderRadius: 1, backgroundColor: color, marginTop: 4 }} />
    </View>
  );
}

/** Globo (selector de idioma). */
export function IconoIdioma({ color = COLORES.grafito, tamano = 20 }: PropsIcono) {
  return (
    <View
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        borderWidth: 1.6,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityElementsHidden={true}
    >
      <View style={{ width: tamano * 0.6, height: 1.6, backgroundColor: color }} />
      <View
        style={{
          position: "absolute",
          width: tamano * 0.4,
          height: tamano * 0.9,
          borderRadius: tamano * 0.2,
          borderWidth: 1.2,
          borderColor: color,
        }}
      />
    </View>
  );
}

/** Lupa (búsqueda). */
export function IconoBuscar({ color = COLORES.grisTexto, tamano = 18 }: PropsIcono) {
  return (
    <View style={tamanos.caja} accessibilityElementsHidden={true}>
      <View
        style={{
          width: tamano * 0.7,
          height: tamano * 0.7,
          borderRadius: tamano * 0.35,
          borderWidth: 2,
          borderColor: color,
        }}
      />
      <View
        style={{
          width: 2,
          height: tamano * 0.45,
          borderRadius: 1,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
          marginTop: -tamano * 0.16,
          marginLeft: tamano * 0.3,
        }}
      />
    </View>
  );
}

/** Campana (notificaciones). */
export function IconoCampana({ color = COLORES.grafito, tamano = 20 }: PropsIcono) {
  return (
    <View style={tamanos.caja} accessibilityElementsHidden={true}>
      <View
        style={{
          width: tamano * 0.75,
          height: tamano * 0.6,
          borderTopLeftRadius: tamano * 0.4,
          borderTopRightRadius: tamano * 0.4,
          borderWidth: 1.8,
          borderColor: color,
        }}
      />
      <View
        style={{
          width: tamano * 0.9,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
          marginTop: 2,
        }}
      />
      <View
        style={{
          width: tamano * 0.24,
          height: tamano * 0.24,
          borderRadius: tamano * 0.12,
          backgroundColor: color,
          marginTop: 2,
        }}
      />
    </View>
  );
}

/** Punto de ubicación. */
export function IconoUbicacion({ color = COLORES.verdeMedio, tamano = 18 }: PropsIcono) {
  return (
    <View
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        borderWidth: 2,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityElementsHidden={true}
    >
      <View
        style={{
          width: tamano * 0.34,
          height: tamano * 0.34,
          borderRadius: tamano * 0.17,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Escudo (identidad verificada). */
export function IconoEscudo({ color = COLORES.verdeMedio, tamano = 22 }: PropsIcono) {
  return (
    <View
      style={{
        width: tamano * 0.8,
        height: tamano,
        borderBottomLeftRadius: tamano * 0.5,
        borderBottomRightRadius: tamano * 0.5,
        borderTopLeftRadius: tamano * 0.12,
        borderTopRightRadius: tamano * 0.12,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityElementsHidden={true}
    >
      <Text style={{ color: COLORES.blanco, fontSize: tamano * 0.55, fontWeight: "800", lineHeight: tamano * 0.62 }}>
        ✓
      </Text>
    </View>
  );
}

/** Estrella de calificación. */
export function IconoEstrella({ tamano = 14 }: PropsIcono) {
  return (
    <Text
      style={{ color: COLORES.amarilloEstrella, fontSize: tamano, lineHeight: tamano + 2 }}
      accessibilityElementsHidden={true}
    >
      ★
    </Text>
  );
}

/** Marca de verificación (aceptar). */
export function IconoAceptar({ color = COLORES.blanco, tamano = 16 }: PropsIcono) {
  return (
    <Text style={{ color, fontSize: tamano, fontWeight: "800", lineHeight: tamano + 2 }} accessibilityElementsHidden={true}>
      ✓
    </Text>
  );
}

/** Flecha a la derecha. */
export function IconoFlecha({ color = COLORES.blanco, tamano = 16 }: PropsIcono) {
  return (
    <Text style={{ color, fontSize: tamano, fontWeight: "800", lineHeight: tamano + 2 }} accessibilityElementsHidden={true}>
      →
    </Text>
  );
}

/** Glifo de ruta (recogida → destino) para el hueco de imagen de las tarjetas. */
export function IconoRuta({ tamano = 34 }: PropsIcono) {
  return (
    <View style={tamanos.caja} accessibilityElementsHidden={true}>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          borderWidth: 2,
          borderColor: COLORES.verdeMedio,
        }}
      />
      <View style={{ width: 2, height: tamano * 0.4, backgroundColor: COLORES.bordeSecundario }} />
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: COLORES.verdeProfundo,
        }}
      />
    </View>
  );
}

/** Loseta «Boutiques» (toldo de tienda). */
export function IconoBoutique({ tamano = 20 }: PropsIcono) {
  return (
    <View style={tamanos.caja} accessibilityElementsHidden={true}>
      <View
        style={{
          width: tamano,
          height: tamano * 0.3,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          backgroundColor: COLORES.verdeMedio,
        }}
      />
      <View
        style={{
          width: tamano * 0.72,
          height: tamano * 0.5,
          borderLeftWidth: 2,
          borderRightWidth: 2,
          borderBottomWidth: 2,
          borderColor: COLORES.verdeProfundo,
          marginTop: 1,
        }}
      />
    </View>
  );
}

/** Loseta «Restaurants» (tenedor y cuchara estilizados). */
export function IconoRestaurante({ tamano = 20 }: PropsIcono) {
  return (
    <View style={tamanos.caja} accessibilityElementsHidden={true}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
        <View
          style={{
            width: 3,
            height: tamano * 0.7,
            borderRadius: 1.5,
            backgroundColor: COLORES.verdeProfundo,
          }}
        />
        <View
          style={{
            width: 3,
            height: tamano * 0.9,
            borderRadius: 1.5,
            backgroundColor: COLORES.verdeMedio,
          }}
        />
        <View
          style={{
            width: tamano * 0.22,
            height: tamano * 0.5,
            borderTopLeftRadius: tamano * 0.11,
            borderTopRightRadius: tamano * 0.11,
            backgroundColor: COLORES.verdeProfundo,
          }}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 4, marginTop: 2 }}>
        <View style={{ width: 3, height: 2, backgroundColor: COLORES.verdeProfundo }} />
        <View style={{ width: 3, height: 2, backgroundColor: COLORES.verdeProfundo }} />
      </View>
    </View>
  );
}

/** Loseta «Supermarchés» (carrito). */
export function IconoSupermercado({ tamano = 20 }: PropsIcono) {
  return (
    <View style={tamanos.caja} accessibilityElementsHidden={true}>
      <View style={{ flexDirection: "row" }}>
        <View
          style={{
            width: tamano * 0.16,
            height: 3,
            borderRadius: 1.5,
            backgroundColor: COLORES.verdeProfundo,
            marginTop: 2,
          }}
        />
        <View
          style={{
            width: tamano * 0.7,
            height: tamano * 0.42,
            borderTopRightRadius: 4,
            borderBottomRightRadius: 2,
            borderWidth: 2,
            borderColor: COLORES.verdeMedio,
            marginLeft: -1,
          }}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 3, marginLeft: tamano * 0.2 }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: COLORES.verdeProfundo,
          }}
        />
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: COLORES.verdeProfundo,
          }}
        />
      </View>
    </View>
  );
}

/** Loseta «Divers» (bolsa de encargo). */
export function IconoDivers({ tamano = 20 }: PropsIcono) {
  return (
    <View style={tamanos.caja} accessibilityElementsHidden={true}>
      <View
        style={{
          width: tamano * 0.5,
          height: tamano * 0.28,
          borderTopLeftRadius: tamano * 0.14,
          borderTopRightRadius: tamano * 0.14,
          borderWidth: 2,
          borderColor: COLORES.verdeMedio,
          marginBottom: -2,
        }}
      />
      <View
        style={{
          width: tamano * 0.78,
          height: tamano * 0.62,
          borderRadius: 3,
          backgroundColor: COLORES.verdeProfundo,
        }}
      />
    </View>
  );
}
