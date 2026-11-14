/**
 * Pantalla de bienvenida (primer arranque): marca, héroe visual con fotografía
 * de la maqueta aprobada y selección de idioma AL FRENTE (decisión del
 * fundador, 2026-11-13: el francés entra de manera estratégica desde la
 * primera pantalla, sin abandonar el kreyòl; la elección queda guardada en
 * el dispositivo). Solo ofrece las dos salidas reales que existen hoy:
 * crear cuenta o iniciar sesión con e-mail (Google Sign-In aún no existe:
 * el proveedor no está configurado en Supabase y la app no lo simula).
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ETIQUETA_IDIOMA, texto, type Idioma } from "./i18n";
import {
  BanderaHaiti,
  BotonPrimario,
  BotonSecundario,
  COLORES,
  ESPACIADO,
  FondoDegradado,
  IconoUI,
  ImagenIlustracion,
  LogoKouriGo,
  RADIOS,
  SOMBRAS,
  TIPOGRAFIA,
} from "./ui";

/** Orden del selector grande: francés primero (decisión del fundador). */
const ORDEN_GRANDE: readonly Idioma[] = ["fr", "ht"];

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES.grisFondo,
  },
  contenido: {
    paddingHorizontal: ESPACIADO.lg,
    paddingTop: 52,
    paddingBottom: 36,
    gap: ESPACIADO.lg,
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  encabezadoLateral: {
    width: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  encabezadoCentro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroeTarjeta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORES.verdeHeroOscuro,
    borderRadius: RADIOS.xl,
    minHeight: 196,
    overflow: "hidden",
    padding: ESPACIADO.lg,
    gap: ESPACIADO.md,
    ...SOMBRAS.tarjeta,
  },
  heroeFondo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroeMarcoImagen: {
    width: 124,
    height: 164,
    borderRadius: RADIOS.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: COLORES.verdeHeroOscuro,
  },
  heroeTextos: {
    flex: 1,
    justifyContent: "center",
    gap: ESPACIADO.xs,
  },
  heroeEslogan: {
    ...TIPOGRAFIA.heroTitulo,
    fontSize: 22,
    lineHeight: 27,
    color: COLORES.blanco,
  },
  heroeSub: {
    ...TIPOGRAFIA.heroSubtitulo,
    color: "rgba(255, 255, 255, 0.94)",
    fontWeight: "600",
  },
  heroeLemaCaja: {
    marginTop: ESPACIADO.xs,
    paddingTop: ESPACIADO.xs,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
  },
  heroeLema: {
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255, 255, 255, 0.85)",
  },
  filaCapacidades: {
    flexDirection: "row",
    gap: ESPACIADO.sm,
  },
  tarjetaCapacidad: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORES.blanco,
    borderRadius: RADIOS.md,
    borderWidth: 1,
    borderColor: COLORES.borde,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.md,
    gap: ESPACIADO.sm,
    ...SOMBRAS.tarjeta,
  },
  iconoCapacidad: {
    width: 34,
    height: 34,
    borderRadius: RADIOS.sm,
    backgroundColor: COLORES.verdeClaro,
    alignItems: "center",
    justifyContent: "center",
  },
  textoCapacidad: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: COLORES.grafito,
  },
  tarjetaIdioma: {
    backgroundColor: COLORES.blanco,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.lg,
    padding: ESPACIADO.lg,
    gap: ESPACIADO.md,
    ...SOMBRAS.tarjeta,
  },
  etiquetaIdioma: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORES.grisTexto,
  },
  filaOpciones: {
    flexDirection: "row",
    gap: ESPACIADO.sm,
  },
  opcion: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ESPACIADO.xs,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.md,
    paddingVertical: 14,
    paddingHorizontal: ESPACIADO.sm,
    backgroundColor: COLORES.blanco,
  },
  opcionActiva: {
    borderColor: COLORES.verdeMedio,
    borderWidth: 1.5,
    backgroundColor: COLORES.verdeClaro,
  },
  opcionTexto: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORES.grafito,
  },
  opcionTextoActivo: {
    color: COLORES.verdeHeroOscuro,
  },
  acciones: {
    gap: ESPACIADO.sm,
    marginTop: ESPACIADO.xs,
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
    <ScrollView
      style={estilos.contenedor}
      contentContainerStyle={estilos.contenido}
      showsVerticalScrollIndicator={false}
    >
      <View style={estilos.encabezado}>
        <View style={estilos.encabezadoLateral} />
        <View style={estilos.encabezadoCentro}>
          <LogoKouriGo tamano="grande" subtitulo={texto(idioma, "etiqueta_marca")} />
        </View>
        <View style={estilos.encabezadoLateral}>
          <BanderaHaiti />
        </View>
      </View>

      <View style={estilos.heroeTarjeta}>
        <View style={estilos.heroeFondo} pointerEvents="none">
          <FondoDegradado tipo="hero" />
        </View>
        <View style={estilos.heroeMarcoImagen}>
          <ImagenIlustracion nombre="heroCliente" />
        </View>
        <View style={estilos.heroeTextos}>
          <Text style={estilos.heroeEslogan}>{texto(idioma, "eslogan_hero")}</Text>
          <Text style={estilos.heroeSub}>{texto(idioma, "eslogan_hero_sub")}</Text>
          <View style={estilos.heroeLemaCaja}>
            <Text style={estilos.heroeLema}>{texto(idioma, "eslogan")}</Text>
          </View>
        </View>
      </View>

      <View style={estilos.filaCapacidades}>
        <View style={estilos.tarjetaCapacidad}>
          <View style={estilos.iconoCapacidad}>
            <IconoUI nombre="scooter" tamano={18} color={COLORES.verdeMedio} />
          </View>
          <Text style={estilos.textoCapacidad} numberOfLines={2}>
            {texto(idioma, "tipo_entrega")}
          </Text>
        </View>
        <View style={estilos.tarjetaCapacidad}>
          <View style={estilos.iconoCapacidad}>
            <IconoUI nombre="cart" tamano={18} color={COLORES.verdeMedio} />
          </View>
          <Text style={estilos.textoCapacidad} numberOfLines={2}>
            {texto(idioma, "tipo_compra_asistida")}
          </Text>
        </View>
      </View>

      <View style={estilos.tarjetaIdioma}>
        <Text style={estilos.etiquetaIdioma}>{texto(idioma, "elegir_idioma")}</Text>
        <View style={estilos.filaOpciones}>
          {ORDEN_GRANDE.map((opcion) => {
            const activa = opcion === idioma;
            return (
              <Pressable
                key={opcion}
                onPress={() => alCambiarIdioma(opcion)}
                style={({ pressed }) => [
                  estilos.opcion,
                  activa ? estilos.opcionActiva : null,
                  pressed ? { opacity: 0.85 } : null,
                ]}
              >
                {activa ? <IconoUI nombre="check" tamano={14} color={COLORES.verdeMedio} /> : null}
                <Text style={[estilos.opcionTexto, activa ? estilos.opcionTextoActivo : null]}>
                  {ETIQUETA_IDIOMA[opcion]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={estilos.acciones}>
        <BotonPrimario
          etiqueta={texto(idioma, "comenzar")}
          alPulsar={alIrRegistro}
          slotIconoDerecha={<IconoUI nombre="arrowRight" tamano={16} color={COLORES.blanco} />}
        />
        <BotonSecundario etiqueta={texto(idioma, "ya_tengo_cuenta")} alPulsar={alIrInicioSesion} />
      </View>
    </ScrollView>
  );
}
