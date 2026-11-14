/**
 * Iconografía de la maqueta KouriGo renderizada con PNG @3x transparentes
 * (apps/mobile/src/ui/components/IconosUI.tsx). Cero dependencias externas,
 * cero datos simulados y compatible con tintColor en iOS y Android.
 */
import { View } from "react-native";
import { IconoUI, BanderaHaiti, LogoKouriGo } from "./ui";
import { COLORES } from "./ui/theme/tokens";

interface PropsIcono {
  readonly color?: string;
  readonly tamano?: number;
}

export { BanderaHaiti, LogoKouriGo };

export function IconoMenu({ color = COLORES.grafito, tamano = 20 }: PropsIcono) {
  return <IconoUI nombre="menu" tamano={tamano} color={color} />;
}

export function IconoIdioma({ color = COLORES.grafito, tamano = 20 }: PropsIcono) {
  return <IconoUI nombre="settings" tamano={tamano} color={color} />;
}

export function IconoBuscar({ color = COLORES.grisIconoInactivo, tamano = 18 }: PropsIcono) {
  return <IconoUI nombre="search" tamano={tamano} color={color} />;
}

export function IconoCampana({ color = COLORES.grafito, tamano = 20 }: PropsIcono) {
  return <IconoUI nombre="bell" tamano={tamano} color={color} />;
}

export function IconoUbicacion({ color = COLORES.verdeMedio, tamano = 18 }: PropsIcono) {
  return <IconoUI nombre="pin" tamano={tamano} color={color} />;
}

export function IconoEscudo({ color = COLORES.verdeProfundo, tamano = 22 }: PropsIcono) {
  return <IconoUI nombre="shieldCheck" tamano={tamano} color={color} />;
}

export function IconoEstrella({ color = COLORES.amarilloEstrella, tamano = 14 }: PropsIcono) {
  return <IconoUI nombre="star" tamano={tamano} color={color} />;
}

export function IconoAceptar({ color = COLORES.blanco, tamano = 16 }: PropsIcono) {
  return <IconoUI nombre="arrowRight" tamano={tamano} color={color} />;
}

export function IconoFlecha({ color = COLORES.blanco, tamano = 16 }: PropsIcono) {
  return <IconoUI nombre="arrowRight" tamano={tamano} color={color} />;
}

export function IconoRuta({ color = COLORES.verdeMedio, tamano = 28 }: PropsIcono) {
  return <IconoUI nombre="orders" tamano={tamano} color={color} />;
}

export function IconoBoutique({ color = COLORES.verdeMedio, tamano = 20 }: PropsIcono) {
  return <IconoUI nombre="cart" tamano={tamano} color={color} />;
}

export function IconoRestaurante({ color = COLORES.verdeMedio, tamano = 20 }: PropsIcono) {
  return <IconoUI nombre="utensils" tamano={tamano} color={color} />;
}

export function IconoSupermercado({ color = COLORES.verdeMedio, tamano = 20 }: PropsIcono) {
  return <IconoUI nombre="store" tamano={tamano} color={color} />;
}

export function IconoDivers({ color = COLORES.verdeMedio, tamano = 20 }: PropsIcono) {
  return <IconoUI nombre="gift" tamano={tamano} color={color} />;
}

export function IconoCaja({ color = COLORES.verdeMedio, tamano = 20 }: PropsIcono) {
  return <IconoUI nombre="package" tamano={tamano} color={color} />;
}

export function IconoCheckCirculo() {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: COLORES.verdeTimeline,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <IconoUI nombre="check" tamano={12} color={COLORES.blanco} />
    </View>
  );
}
