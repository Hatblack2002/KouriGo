import type { ReactNode } from "react";
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { textoUI, type Idioma } from "../i18n/diccionario-ui";
import { COLORES, ESPACIADO, RADIOS, SOMBRAS, TIPOGRAFIA } from "../theme/tokens";
import { BotonSecundario } from "./BotonSecundario";

export interface TarjetaPerfilRepartidorProps {
  readonly idioma: Idioma;
  readonly nombre: string;
  readonly calificacionTexto?: string;
  readonly entregasTexto?: string;
  readonly avatarFuente?: ImageSourcePropType;
  readonly slotAvatar?: ReactNode;
  readonly slotIconoEstrella?: ReactNode;
  readonly slotIconoLlamar?: ReactNode;
  readonly slotIconoChat?: ReactNode;
  readonly alPulsarLlamar?: () => void;
  readonly alPulsarChat?: () => void;
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: COLORES.blanco,
    borderRadius: RADIOS.xl,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: ESPACIADO.md,
    ...SOMBRAS.tarjeta,
  },
  filaSuperior: {
    flexDirection: "row",
    alignItems: "center",
    gap: ESPACIADO.md,
  },
  avatarContenedor: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORES.grisSuperficie,
    borderWidth: 1,
    borderColor: COLORES.divisor,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImagen: {
    width: "100%",
    height: "100%",
  },
  info: {
    flex: 1,
  },
  nombre: {
    ...TIPOGRAFIA.tarjetaTitulo,
    fontSize: 16,
    color: COLORES.grafito,
  },
  metaFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: ESPACIADO.xs,
    marginTop: 3,
  },
  calificacion: {
    ...TIPOGRAFIA.cuerpoMedio,
    fontWeight: "700",
    color: COLORES.grafito,
  },
  entregas: {
    ...TIPOGRAFIA.cuerpoMedio,
    color: COLORES.grisTexto,
  },
  acciones: {
    flexDirection: "row",
    gap: ESPACIADO.sm,
    marginTop: ESPACIADO.md,
  },
  botonColumna: {
    flex: 1,
  },
});

export function TarjetaPerfilRepartidor({
  idioma,
  nombre,
  calificacionTexto,
  entregasTexto,
  avatarFuente,
  slotAvatar,
  slotIconoEstrella,
  slotIconoLlamar,
  slotIconoChat,
  alPulsarLlamar,
  alPulsarChat,
}: TarjetaPerfilRepartidorProps) {
  if (nombre.trim().length === 0) {
    return null;
  }

  const tieneMeta =
    (calificacionTexto !== undefined && calificacionTexto.trim().length > 0) ||
    (entregasTexto !== undefined && entregasTexto.trim().length > 0);
  const tieneAcciones = alPulsarLlamar !== undefined || alPulsarChat !== undefined;

  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.filaSuperior}>
        <View style={estilos.avatarContenedor}>
          {slotAvatar !== undefined ? (
            slotAvatar
          ) : avatarFuente !== undefined ? (
            <Image source={avatarFuente} style={estilos.avatarImagen} resizeMode="cover" />
          ) : null}
        </View>

        <View style={estilos.info}>
          <Text style={estilos.nombre} numberOfLines={1}>
            {nombre}
          </Text>
          {tieneMeta ? (
            <View style={estilos.metaFila}>
              {slotIconoEstrella}
              {calificacionTexto !== undefined && calificacionTexto.trim().length > 0 ? (
                <Text style={estilos.calificacion}>{calificacionTexto}</Text>
              ) : null}
              {entregasTexto !== undefined && entregasTexto.trim().length > 0 ? (
                <Text style={estilos.entregas} numberOfLines={1}>
                  {entregasTexto}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {tieneAcciones ? (
        <View style={estilos.acciones}>
          {alPulsarLlamar !== undefined ? (
            <View style={estilos.botonColumna}>
              <BotonSecundario
                etiqueta={textoUI(idioma, "appeler")}
                alPulsar={alPulsarLlamar}
                slotIconoIzquierda={slotIconoLlamar}
              />
            </View>
          ) : null}
          {alPulsarChat !== undefined ? (
            <View style={estilos.botonColumna}>
              <BotonSecundario
                etiqueta={textoUI(idioma, "chat")}
                alPulsar={alPulsarChat}
                slotIconoIzquierda={slotIconoChat}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
