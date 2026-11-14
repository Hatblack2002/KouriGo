import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { ChipEstado } from "../components/ChipEstado";
import { EncabezadoLogo } from "../components/EncabezadoLogo";
import {
  LineaTiempoEventos,
  type EventoLineaTiempo,
} from "../components/LineaTiempoEventos";
import { TarjetaPerfilRepartidor } from "../components/TarjetaPerfilRepartidor";
import { textoUI, type Idioma } from "../i18n/diccionario-ui";
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA } from "../theme/tokens";

export interface DatosRepartidorSeguimiento {
  readonly nombre: string;
  readonly calificacionTexto?: string;
  readonly entregasTexto?: string;
  readonly avatarFuente?: ImageSourcePropType;
  readonly slotAvatar?: ReactNode;
}

export interface PantallaSeguimientoTiempoRealProps {
  readonly idioma: Idioma;
  readonly pedidoNumero: string;
  readonly estado: string;
  readonly etiquetaEstadoPersonalizada?: string;
  readonly alVolver: () => void;
  readonly alPulsarSoporte?: () => void;
  readonly slotIconoVolver?: ReactNode;
  readonly slotIconoSoporte?: ReactNode;
  readonly slotMapa?: ReactNode;
  readonly eventos: readonly EventoLineaTiempo[];
  readonly repartidor?: DatosRepartidorSeguimiento | null;
  readonly slotIconoEstrella?: ReactNode;
  readonly slotIconoLlamar?: ReactNode;
  readonly slotIconoChat?: ReactNode;
  readonly alPulsarLlamar?: () => void;
  readonly alPulsarChat?: () => void;
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.blanco,
  },
  scrollContenido: {
    paddingHorizontal: ESPACIADO.lg,
    paddingTop: ESPACIADO.md,
    paddingBottom: ESPACIADO.xxl,
    gap: ESPACIADO.lg,
  },
  contenedorMapa: {
    width: "100%",
    height: 240,
    borderRadius: RADIOS.xl,
    backgroundColor: COLORES.grisSuperficie,
    borderWidth: 1,
    borderColor: COLORES.borde,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  cabeceraPedido: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: ESPACIADO.md,
  },
  numeroPedido: {
    ...TIPOGRAFIA.tituloSeccion,
    fontSize: 18,
    color: COLORES.grafito,
    flex: 1,
  },
});

export function PantallaSeguimientoTiempoReal({
  idioma,
  pedidoNumero,
  estado,
  etiquetaEstadoPersonalizada,
  alVolver,
  alPulsarSoporte,
  slotIconoVolver,
  slotIconoSoporte,
  slotMapa,
  eventos,
  repartidor,
  slotIconoEstrella,
  slotIconoLlamar,
  slotIconoChat,
  alPulsarLlamar,
  alPulsarChat,
}: PantallaSeguimientoTiempoRealProps) {
  const tieneNumero = pedidoNumero.trim().length > 0;

  return (
    <View style={estilos.pantalla}>
      <EncabezadoLogo
        idioma={idioma}
        variante="titulo"
        tituloClave="suivi_de_commande"
        slotIzquierda={slotIconoVolver}
        slotDerecha={slotIconoSoporte}
        alPulsarIzquierda={alVolver}
        alPulsarDerecha={alPulsarSoporte}
      />

      <ScrollView
        contentContainerStyle={estilos.scrollContenido}
        showsVerticalScrollIndicator={false}
      >
        <View style={estilos.contenedorMapa}>{slotMapa}</View>

        {tieneNumero ? (
          <View style={estilos.cabeceraPedido}>
            <Text style={estilos.numeroPedido} numberOfLines={1}>
              {`${textoUI(idioma, "pedido_prefijo")} ${pedidoNumero}`}
            </Text>
            <ChipEstado
              idioma={idioma}
              estado={estado}
              etiquetaPersonalizada={etiquetaEstadoPersonalizada}
            />
          </View>
        ) : null}

        <LineaTiempoEventos eventos={eventos} />

        {repartidor !== null && repartidor !== undefined ? (
          <TarjetaPerfilRepartidor
            idioma={idioma}
            nombre={repartidor.nombre}
            calificacionTexto={repartidor.calificacionTexto}
            entregasTexto={repartidor.entregasTexto}
            avatarFuente={repartidor.avatarFuente}
            slotAvatar={repartidor.slotAvatar}
            slotIconoEstrella={slotIconoEstrella}
            slotIconoLlamar={slotIconoLlamar}
            slotIconoChat={slotIconoChat}
            alPulsarLlamar={alPulsarLlamar}
            alPulsarChat={alPulsarChat}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
