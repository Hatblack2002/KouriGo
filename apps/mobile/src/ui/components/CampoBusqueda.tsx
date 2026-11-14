import type { ReactNode } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { textoUI, type ClaveTextoUI, type Idioma } from "../i18n/diccionario-ui";
import { COLORES, ESPACIADO, RADIOS, SOMBRAS, TIPOGRAFIA } from "../theme/tokens";

export interface CampoBusquedaProps {
  readonly idioma: Idioma;
  readonly valor: string;
  readonly alCambiar: (texto: string) => void;
  readonly placeholderClave?: ClaveTextoUI;
  readonly slotIcono?: ReactNode;
  readonly alEnviar?: () => void;
}

const estilos = StyleSheet.create({
  contenedor: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORES.blanco,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.md,
    paddingHorizontal: ESPACIADO.md,
    minHeight: 44,
    ...SOMBRAS.tarjeta,
  },
  iconoContenedor: {
    marginRight: ESPACIADO.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  entrada: {
    flex: 1,
    ...TIPOGRAFIA.cuerpoMedio,
    color: COLORES.textoPrincipal,
    paddingVertical: ESPACIADO.sm,
  },
});

export function CampoBusqueda({
  idioma,
  valor,
  alCambiar,
  placeholderClave = "buscar_placeholder",
  slotIcono,
  alEnviar,
}: CampoBusquedaProps) {
  return (
    <View style={estilos.contenedor}>
      {slotIcono !== undefined ? <View style={estilos.iconoContenedor}>{slotIcono}</View> : null}
      <TextInput
        style={estilos.entrada}
        value={valor}
        onChangeText={alCambiar}
        placeholder={textoUI(idioma, placeholderClave)}
        placeholderTextColor={COLORES.grisPlaceholder}
        returnKeyType="search"
        onSubmitEditing={alEnviar}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
