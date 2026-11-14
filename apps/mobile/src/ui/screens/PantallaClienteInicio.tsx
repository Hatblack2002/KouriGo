import type { ReactNode } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import {
  BarraNavegacionInferior,
  type ElementoNavegacionInferior,
} from "../components/BarraNavegacionInferior";
import { BotonPrimario } from "../components/BotonPrimario";
import { CampoBusqueda } from "../components/CampoBusqueda";
import { EncabezadoLogo } from "../components/EncabezadoLogo";
import { BanderaHaiti, FondoDegradado, IconoUI } from "../components/IconosUI";
import { textoUI, type ClaveTextoUI, type Idioma } from "../i18n/diccionario-ui";
import { COLORES, ESPACIADO, RADIOS, SOMBRAS, TIPOGRAFIA } from "../theme/tokens";

export interface ServicioRapido {
  readonly id: string;
  readonly etiquetaClave: ClaveTextoUI;
  readonly slotIcono?: ReactNode;
  readonly alPulsar: () => void;
}

export interface CategoriaDestacada {
  readonly id: string;
  readonly etiquetaClave: ClaveTextoUI;
  readonly imagenFuente?: ImageSourcePropType;
  readonly slotImagen?: ReactNode;
  readonly alPulsar: () => void;
}

export interface PantallaClienteInicioProps {
  readonly idioma: Idioma;
  readonly busqueda: string;
  readonly alCambiarBusqueda: (valor: string) => void;
  readonly alEnviarBusqueda?: () => void;
  readonly alPulsarMenu?: () => void;
  readonly alPulsarIdioma?: () => void;
  readonly slotIconoMenu?: ReactNode;
  readonly slotBanderaIdioma?: ReactNode;
  readonly slotLogo?: ReactNode;
  readonly slotIconoBuscar?: ReactNode;
  readonly slotImagenHero?: ReactNode;
  readonly slotFondoDegradadoHero?: ReactNode;
  readonly servicios: readonly ServicioRapido[];
  readonly alPulsarPedidoRapido: () => void;
  readonly slotIlustracionPromo?: ReactNode;
  readonly slotFondoDegradadoPromo?: ReactNode;
  readonly slotIconoFlechaPromo?: ReactNode;
  readonly categorias: readonly CategoriaDestacada[];
  readonly alPulsarVerTodoCategorias?: () => void;
  readonly elementosNav: readonly ElementoNavegacionInferior[];
  readonly tabActiva: string;
  readonly alCambiarTab: (clave: string) => void;
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.grisFondo,
  },
  scrollContenido: {
    paddingHorizontal: ESPACIADO.lg,
    paddingTop: ESPACIADO.sm,
    paddingBottom: ESPACIADO.xxl,
    gap: ESPACIADO.md,
  },
  heroTarjeta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORES.verdeHeroOscuro,
    borderRadius: RADIOS.xl,
    minHeight: 152,
    overflow: "hidden",
    padding: ESPACIADO.lg,
    ...SOMBRAS.tarjeta,
  },
  fondoSlot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroMediaSlot: {
    width: 112,
    height: 120,
    borderRadius: RADIOS.md,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginRight: ESPACIADO.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextoContenedor: {
    flex: 1,
    justifyContent: "center",
  },
  heroTitulo: {
    ...TIPOGRAFIA.heroTitulo,
    color: COLORES.blanco,
  },
  heroSubtitulo: {
    ...TIPOGRAFIA.heroSubtitulo,
    color: "rgba(255, 255, 255, 0.92)",
    marginTop: ESPACIADO.xs,
  },
  filaServicios: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: ESPACIADO.sm,
  },
  tarjetaServicio: {
    flex: 1,
    backgroundColor: COLORES.blanco,
    borderRadius: RADIOS.md,
    borderWidth: 1,
    borderColor: COLORES.borde,
    paddingVertical: ESPACIADO.md,
    paddingHorizontal: ESPACIADO.xs,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 82,
    ...SOMBRAS.tarjeta,
  },
  iconoServicioSlot: {
    width: 34,
    height: 34,
    borderRadius: RADIOS.sm,
    backgroundColor: COLORES.verdeClaro,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: ESPACIADO.xs,
  },
  etiquetaServicio: {
    ...TIPOGRAFIA.tabEtiqueta,
    fontSize: 11,
    color: COLORES.grafito,
    textAlign: "center",
  },
  promoTarjeta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORES.verdeMentaClaro,
    borderRadius: RADIOS.lg,
    padding: ESPACIADO.md,
    minHeight: 96,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORES.bordeSecundario,
  },
  promoMediaSlot: {
    width: 88,
    height: 72,
    borderRadius: RADIOS.md,
    backgroundColor: "rgba(14, 124, 58, 0.08)",
    marginRight: ESPACIADO.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  promoContenido: {
    flex: 1,
    gap: ESPACIADO.sm,
  },
  promoTitulo: {
    ...TIPOGRAFIA.tarjetaTitulo,
    color: COLORES.grafito,
  },
  cabeceraSeccion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: ESPACIADO.xs,
  },
  tituloSeccion: {
    ...TIPOGRAFIA.tituloSeccion,
    color: COLORES.grafito,
  },
  enlaceVerTodo: {
    ...TIPOGRAFIA.etiquetaPequena,
    color: COLORES.grisTexto,
  },
  filaCategorias: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: ESPACIADO.sm,
  },
  tarjetaCategoria: {
    flex: 1,
    alignItems: "center",
  },
  categoriaMediaSlot: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: RADIOS.md,
    backgroundColor: COLORES.grisSuperficie,
    borderWidth: 1,
    borderColor: COLORES.borde,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  categoriaImagen: {
    width: "100%",
    height: "100%",
  },
  categoriaEtiqueta: {
    ...TIPOGRAFIA.etiquetaPequena,
    fontSize: 11,
    color: COLORES.grafito,
    marginTop: ESPACIADO.xs,
    textAlign: "center",
  },
});

export function PantallaClienteInicio({
  idioma,
  busqueda,
  alCambiarBusqueda,
  alEnviarBusqueda,
  alPulsarMenu,
  alPulsarIdioma,
  slotIconoMenu,
  slotBanderaIdioma,
  slotLogo,
  slotIconoBuscar,
  slotImagenHero,
  slotFondoDegradadoHero,
  servicios,
  alPulsarPedidoRapido,
  slotIlustracionPromo,
  slotFondoDegradadoPromo,
  slotIconoFlechaPromo,
  categorias,
  alPulsarVerTodoCategorias,
  elementosNav,
  tabActiva,
  alCambiarTab,
}: PantallaClienteInicioProps) {
  return (
    <View style={estilos.pantalla}>
      <EncabezadoLogo
        idioma={idioma}
        variante="marca"
        mostrarSubtituloMarca={true}
        slotLogo={slotLogo}
        slotIzquierda={
          slotIconoMenu ?? <IconoUI nombre="menu" tamano={20} color={COLORES.grafito} />
        }
        slotDerecha={slotBanderaIdioma ?? <BanderaHaiti />}
        alPulsarIzquierda={alPulsarMenu}
        alPulsarDerecha={alPulsarIdioma}
      />

      <ScrollView
        contentContainerStyle={estilos.scrollContenido}
        showsVerticalScrollIndicator={false}
      >
        <View style={estilos.heroTarjeta}>
          <View style={estilos.fondoSlot} pointerEvents="none">
            {slotFondoDegradadoHero ?? <FondoDegradado tipo="hero" />}
          </View>
          <View style={estilos.heroMediaSlot}>{slotImagenHero}</View>
          <View style={estilos.heroTextoContenedor}>
            <Text style={estilos.heroTitulo}>{textoUI(idioma, "eslogan_hero")}</Text>
            <Text style={estilos.heroSubtitulo}>{textoUI(idioma, "eslogan_hero_sub")}</Text>
          </View>
        </View>

        <CampoBusqueda
          idioma={idioma}
          valor={busqueda}
          alCambiar={alCambiarBusqueda}
          alEnviar={alEnviarBusqueda}
          slotIcono={
            slotIconoBuscar ?? (
              <IconoUI nombre="search" tamano={18} color={COLORES.grisIconoInactivo} />
            )
          }
        />

        {servicios.length > 0 ? (
          <View style={estilos.filaServicios}>
            {servicios.map((servicio) => (
              <Pressable
                key={servicio.id}
                onPress={servicio.alPulsar}
                style={({ pressed }) => [
                  estilos.tarjetaServicio,
                  pressed ? { opacity: 0.85 } : null,
                ]}
              >
                <View style={estilos.iconoServicioSlot}>{servicio.slotIcono}</View>
                <Text style={estilos.etiquetaServicio} numberOfLines={1}>
                  {textoUI(idioma, servicio.etiquetaClave)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={estilos.promoTarjeta}>
          <View style={estilos.fondoSlot} pointerEvents="none">
            {slotFondoDegradadoPromo ?? <FondoDegradado tipo="promo" />}
          </View>
          <View style={estilos.promoMediaSlot}>{slotIlustracionPromo}</View>
          <View style={estilos.promoContenido}>
            <Text style={estilos.promoTitulo}>{textoUI(idioma, "promo_rapida")}</Text>
            <BotonPrimario
              etiqueta={textoUI(idioma, "commander_maintenant")}
              alPulsar={alPulsarPedidoRapido}
              compacto={true}
              slotIconoDerecha={
                slotIconoFlechaPromo ?? (
                  <IconoUI nombre="arrowRight" tamano={14} color={COLORES.blanco} />
                )
              }
            />
          </View>
        </View>

        {categorias.length > 0 ? (
          <>
            <View style={estilos.cabeceraSeccion}>
              <Text style={estilos.tituloSeccion}>{textoUI(idioma, "nos_categories")}</Text>
              {alPulsarVerTodoCategorias !== undefined ? (
                <Pressable onPress={alPulsarVerTodoCategorias}>
                  <Text style={estilos.enlaceVerTodo}>{textoUI(idioma, "voir_tout")} ›</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={estilos.filaCategorias}>
              {categorias.map((categoria) => (
                <Pressable
                  key={categoria.id}
                  onPress={categoria.alPulsar}
                  style={({ pressed }) => [
                    estilos.tarjetaCategoria,
                    pressed ? { opacity: 0.85 } : null,
                  ]}
                >
                  <View style={estilos.categoriaMediaSlot}>
                    {categoria.slotImagen !== undefined ? (
                      categoria.slotImagen
                    ) : categoria.imagenFuente !== undefined ? (
                      <Image
                        source={categoria.imagenFuente}
                        style={estilos.categoriaImagen}
                        resizeMode="cover"
                      />
                    ) : null}
                  </View>
                  <Text style={estilos.categoriaEtiqueta} numberOfLines={1}>
                    {textoUI(idioma, categoria.etiquetaClave)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <BarraNavegacionInferior
        elementos={elementosNav}
        claveActiva={tabActiva}
        alSeleccionar={alCambiarTab}
      />
    </View>
  );
}
