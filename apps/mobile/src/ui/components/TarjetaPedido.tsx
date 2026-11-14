import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import type { Idioma } from "../i18n/diccionario-ui";
import { COLORES, ESPACIADO, RADIOS, SOMBRAS, TIPOGRAFIA } from "../theme/tokens";
import { BotonPrimario } from "./BotonPrimario";
import { ChipEstado } from "./ChipEstado";

export interface TarjetaPedidoProps {
  readonly idioma: Idioma;
  readonly titulo: string;
  readonly estado?: string;
  readonly etiquetaEstadoPersonalizada?: string;
  readonly distanciaTexto?: string;
  readonly subtitulo?: string;
  readonly importeFormateado?: string;
  readonly imagenFuente?: ImageSourcePropType;
  readonly slotImagen?: ReactNode;
  readonly slotIconoDistancia?: ReactNode;
  readonly textoAccion?: string;
  readonly slotIconoAccion?: ReactNode;
  readonly alPulsarTarjeta?: () => void;
  readonly alPulsarAccion?: () => void;
  readonly accionDeshabilitada?: boolean;
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: COLORES.blanco,
    borderRadius: RADIOS.lg,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: ESPACIADO.md,
    ...SOMBRAS.tarjeta,
  },
  filaSuperior: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: ESPACIADO.sm,
  },
  distanciaFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: ESPACIADO.xs,
    marginLeft: "auto",
  },
  distanciaTexto: {
    ...TIPOGRAFIA.etiquetaPequena,
    color: COLORES.grafito,
    fontWeight: "700",
  },
  cuerpo: {
    flexDirection: "row",
    alignItems: "center",
    gap: ESPACIADO.md,
  },
  contenedorImagen: {
    width: 84,
    height: 76,
    borderRadius: RADIOS.md,
    backgroundColor: COLORES.grisSuperficie,
    borderWidth: 1,
    borderColor: COLORES.divisor,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  imagen: {
    width: "100%",
    height: "100%",
  },
  info: {
    flex: 1,
    justifyContent: "center",
  },
  titulo: {
    ...TIPOGRAFIA.tarjetaTitulo,
    color: COLORES.grafito,
  },
  subtitulo: {
    ...TIPOGRAFIA.cuerpoMedio,
    color: COLORES.grisTexto,
    marginTop: 2,
  },
  importe: {
    ...TIPOGRAFIA.precioDestacado,
    color: COLORES.verdeMedio,
    marginTop: ESPACIADO.xs,
  },
  accionContenedor: {
    marginTop: ESPACIADO.md,
  },
});

export function TarjetaPedido({
  idioma,
  titulo,
  estado,
  etiquetaEstadoPersonalizada,
  distanciaTexto,
  subtitulo,
  importeFormateado,
  imagenFuente,
  slotImagen,
  slotIconoDistancia,
  textoAccion,
  slotIconoAccion,
  alPulsarTarjeta,
  alPulsarAccion,
  accionDeshabilitada = false,
}: TarjetaPedidoProps) {
  if (titulo.trim().length === 0) {
    return null;
  }

  const tieneCabecera =
    estado !== undefined ||
    etiquetaEstadoPersonalizada !== undefined ||
    (distanciaTexto !== undefined && distanciaTexto.trim().length > 0);

  const contenido = (
    <View style={estilos.tarjeta}>
      {tieneCabecera ? (
        <View style={estilos.filaSuperior}>
          {estado !== undefined ? (
            <ChipEstado
              idioma={idioma}
              estado={estado}
              etiquetaPersonalizada={etiquetaEstadoPersonalizada}
            />
          ) : null}
          {distanciaTexto !== undefined && distanciaTexto.trim().length > 0 ? (
            <View style={estilos.distanciaFila}>
              {slotIconoDistancia}
              <Text style={estilos.distanciaTexto} numberOfLines={1}>
                {distanciaTexto}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={estilos.cuerpo}>
        <View style={estilos.contenedorImagen}>
          {slotImagen !== undefined ? (
            slotImagen
          ) : imagenFuente !== undefined ? (
            <Image source={imagenFuente} style={estilos.imagen} resizeMode="cover" />
          ) : null}
        </View>

        <View style={estilos.info}>
          <Text style={estilos.titulo} numberOfLines={1}>
            {titulo}
          </Text>
          {subtitulo !== undefined && subtitulo.trim().length > 0 ? (
            <Text style={estilos.subtitulo} numberOfLines={2}>
              {subtitulo}
            </Text>
          ) : null}
          {importeFormateado !== undefined && importeFormateado.trim().length > 0 ? (
            <Text style={estilos.importe} numberOfLines={1}>
              {importeFormateado}
            </Text>
          ) : null}
        </View>
      </View>

      {textoAccion !== undefined &&
      textoAccion.trim().length > 0 &&
      alPulsarAccion !== undefined ? (
        <View style={estilos.accionContenedor}>
          <BotonPrimario
            etiqueta={textoAccion}
            alPulsar={alPulsarAccion}
            deshabilitado={accionDeshabilitada}
            slotIconoIzquierda={slotIconoAccion}
          />
        </View>
      ) : null}
    </View>
  );

  if (alPulsarTarjeta !== undefined) {
    return (
      <Pressable
        onPress={alPulsarTarjeta}
        style={({ pressed }) => (pressed ? { opacity: 0.92 } : null)}
      >
        {contenido}
      </Pressable>
    );
  }

  return contenido;
}
