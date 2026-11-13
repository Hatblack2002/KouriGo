/**
 * Pantalla de bienvenida (primer arranque): marca, héroe con el eslogan de
 * la maqueta aprobada y selección de idioma AL FRENTE (decisión del
 * fundador, 2026-11-13: el francés entra de manera estratégica desde la
 * primera pantalla, sin abandonar el kreyòl; la elección queda guardada en
 * el dispositivo). Solo ofrece las dos salidas reales que existen hoy:
 * crear cuenta o iniciar sesión con e-mail (Google Sign-In aún no existe:
 * el proveedor no está configurado en Supabase y la app no lo simula).
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BarraIdiomas, Boton, COLORES, Marca } from "./components";
import { ETIQUETA_IDIOMA, texto, type Idioma } from "./i18n";

/** Orden del selector grande: francés primero (decisión del fundador). */
const ORDEN_GRANDE: readonly Idioma[] = ["fr", "ht"];

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES.blanco,
  },
  contenido: {
    padding: 20,
    paddingBottom: 40,
  },
  barraSuperior: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  bloqueMarca: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 20,
  },
  heroe: {
    backgroundColor: COLORES.verde,
    borderRadius: 18,
    padding: 24,
    marginBottom: 24,
  },
  heroeEslogan: {
    color: COLORES.blanco,
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32,
  },
  heroeSub: {
    color: COLORES.blanco,
    fontSize: 15,
    marginTop: 8,
    opacity: 0.92,
  },
  tarjetaIdioma: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  etiquetaIdioma: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORES.grisTexto,
    marginBottom: 10,
  },
  filaOpciones: {
    flexDirection: "row",
  },
  opcion: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginRight: 10,
    backgroundColor: COLORES.blanco,
  },
  opcionActiva: {
    borderColor: COLORES.verde,
    backgroundColor: COLORES.verdeClaro,
  },
  opcionTexto: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORES.grafito,
  },
  opcionTextoActivo: {
    color: COLORES.verdeOscuro,
  },
  enlace: {
    color: COLORES.verde,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 14,
    paddingVertical: 14,
  },
});

interface Props {
  readonly idioma: Idioma;
  readonly alCambiarIdioma: (idioma: Idioma) => void;
  readonly alIrRegistro: () => void;
  readonly alIrInicioSesion: () => void;
}

export function PantallaBienvenida({
  idioma,
  alCambiarIdioma,
  alIrRegistro,
  alIrInicioSesion,
}: Props) {
  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      <View style={estilos.barraSuperior}>
        <BarraIdiomas idioma={idioma} alCambiar={alCambiarIdioma} />
      </View>
      <View style={estilos.bloqueMarca}>
        <Marca idioma={idioma} centrado={true} />
      </View>
      <View style={estilos.heroe}>
        <Text style={estilos.heroeEslogan}>{texto(idioma, "eslogan_hero")}</Text>
        <Text style={estilos.heroeSub}>{texto(idioma, "eslogan_hero_sub")}</Text>
      </View>
      <View style={estilos.tarjetaIdioma}>
        <Text style={estilos.etiquetaIdioma}>{texto(idioma, "elegir_idioma")}</Text>
        <View style={estilos.filaOpciones}>
          {ORDEN_GRANDE.map((opcion) => (
            <Pressable
              key={opcion}
              onPress={() => alCambiarIdioma(opcion)}
              style={[estilos.opcion, opcion === idioma ? estilos.opcionActiva : null]}
            >
              <Text
                style={[estilos.opcionTexto, opcion === idioma ? estilos.opcionTextoActivo : null]}
              >
                {ETIQUETA_IDIOMA[opcion]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Boton textoBoton={texto(idioma, "comenzar")} alPulsar={alIrRegistro} />
      <Text onPress={alIrInicioSesion} style={estilos.enlace}>
        {texto(idioma, "ya_tengo_cuenta")}
      </Text>
    </ScrollView>
  );
}
