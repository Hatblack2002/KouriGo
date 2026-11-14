import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  BarraNavegacionInferior,
  type ElementoNavegacionInferior,
} from "../components/BarraNavegacionInferior";
import { BotonSecundario } from "../components/BotonSecundario";
import { EncabezadoLogo } from "../components/EncabezadoLogo";
import { IconoUI } from "../components/IconosUI";
import { InterruptorEnLigne } from "../components/InterruptorEnLigne";
import { TarjetaPedido, type TarjetaPedidoProps } from "../components/TarjetaPedido";
import { textoUI, type ClaveTextoUI, type Idioma } from "../i18n/diccionario-ui";
import { COLORES, ESPACIADO, RADIOS, SOMBRAS, TIPOGRAFIA } from "../theme/tokens";

export interface MetricaRepartidor {
  readonly id: string;
  readonly valor: string;
  readonly etiquetaClave: ClaveTextoUI;
  readonly slotIcono?: ReactNode;
}

export interface PedidoDisponibleItem
  extends Omit<TarjetaPedidoProps, "idioma" | "textoAccion" | "alPulsarAccion"> {
  readonly id: string;
  readonly alAceptar?: () => void;
  readonly alAbrir?: () => void;
}

export interface PantallaRepartidorInicioProps {
  readonly idioma: Idioma;
  readonly enLinea: boolean;
  readonly alCambiarEnLinea: (valor: boolean) => void;
  readonly enLineaDeshabilitado?: boolean;
  readonly slotFondoBannerEnLinea?: ReactNode;
  readonly slotLogo?: ReactNode;
  readonly slotIconoCampana?: ReactNode;
  readonly alPulsarCampana?: () => void;
  readonly badgeNotificacionesHeader?: number;
  readonly metricas: readonly MetricaRepartidor[];
  readonly ubicacionTexto?: string;
  readonly slotIconoUbicacion?: ReactNode;
  readonly alPulsarModificarUbicacion?: () => void;
  readonly pedidosDisponibles: readonly PedidoDisponibleItem[];
  readonly alPulsarVerTodosPedidos?: () => void;
  readonly slotIconoAceptar?: ReactNode;
  readonly identidadVerificada: boolean;
  readonly slotIconoEscudo?: ReactNode;
  readonly seccionExtra?: ReactNode;
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
  tarjetaMetricas: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORES.blanco,
    borderRadius: RADIOS.lg,
    borderWidth: 1,
    borderColor: COLORES.borde,
    paddingVertical: ESPACIADO.md,
    ...SOMBRAS.tarjeta,
  },
  columnaMetrica: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ESPACIADO.xs,
  },
  divisorMetrica: {
    borderRightWidth: 1,
    borderRightColor: COLORES.divisor,
  },
  iconoMetrica: {
    marginBottom: ESPACIADO.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  valorMetrica: {
    ...TIPOGRAFIA.kpiValor,
    color: COLORES.grafito,
  },
  etiquetaMetrica: {
    ...TIPOGRAFIA.kpiEtiqueta,
    color: COLORES.grisTexto,
    marginTop: 2,
    textAlign: "center",
  },
  tarjetaUbicacion: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORES.verdeMentaClaro,
    borderRadius: RADIOS.lg,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.md,
    gap: ESPACIADO.md,
  },
  ubicacionInfo: {
    flex: 1,
  },
  ubicacionEtiqueta: {
    ...TIPOGRAFIA.etiquetaPequena,
    color: COLORES.grisTexto,
  },
  ubicacionValor: {
    ...TIPOGRAFIA.tarjetaTitulo,
    fontSize: 14,
    color: COLORES.grafito,
    marginTop: 1,
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
  listaPedidos: {
    gap: ESPACIADO.md,
  },
  tarjetaVerificada: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORES.verdeMentaVerificado,
    borderRadius: RADIOS.lg,
    paddingHorizontal: ESPACIADO.lg,
    paddingVertical: ESPACIADO.md,
    gap: ESPACIADO.md,
  },
  verificadaTextos: {
    flex: 1,
  },
  verificadaTitulo: {
    ...TIPOGRAFIA.tarjetaTitulo,
    fontSize: 14,
    color: COLORES.grafito,
  },
  verificadaSubtitulo: {
    ...TIPOGRAFIA.etiquetaPequena,
    color: COLORES.grisTexto,
    marginTop: 2,
  },
});

export function PantallaRepartidorInicio({
  idioma,
  enLinea,
  alCambiarEnLinea,
  enLineaDeshabilitado = false,
  slotFondoBannerEnLinea,
  slotLogo,
  slotIconoCampana,
  alPulsarCampana,
  badgeNotificacionesHeader,
  metricas,
  ubicacionTexto,
  slotIconoUbicacion,
  alPulsarModificarUbicacion,
  pedidosDisponibles,
  alPulsarVerTodosPedidos,
  slotIconoAceptar,
  identidadVerificada,
  slotIconoEscudo,
  seccionExtra,
  elementosNav,
  tabActiva,
  alCambiarTab,
}: PantallaRepartidorInicioProps) {
  const tieneUbicacion = ubicacionTexto !== undefined && ubicacionTexto.trim().length > 0;

  return (
    <View style={estilos.pantalla}>
      <EncabezadoLogo
        idioma={idioma}
        variante="marca"
        subtituloClave="subtitulo_repartidor"
        mostrarSubtituloMarca={false}
        slotLogo={slotLogo}
        slotDerecha={
          slotIconoCampana ?? <IconoUI nombre="bell" tamano={20} color={COLORES.grafito} />
        }
        alPulsarDerecha={alPulsarCampana}
        badgeDerecha={badgeNotificacionesHeader}
      />

      <ScrollView
        contentContainerStyle={estilos.scrollContenido}
        showsVerticalScrollIndicator={false}
      >
        <InterruptorEnLigne
          idioma={idioma}
          enLinea={enLinea}
          alCambiar={alCambiarEnLinea}
          deshabilitado={enLineaDeshabilitado}
          slotFondoDegradado={slotFondoBannerEnLinea}
        />

        {metricas.length > 0 ? (
          <View style={estilos.tarjetaMetricas}>
            {metricas.map((metrica, indice) => (
              <View
                key={metrica.id}
                style={[
                  estilos.columnaMetrica,
                  indice < metricas.length - 1 ? estilos.divisorMetrica : null,
                ]}
              >
                {metrica.slotIcono !== undefined ? (
                  <View style={estilos.iconoMetrica}>{metrica.slotIcono}</View>
                ) : null}
                <Text style={estilos.valorMetrica} numberOfLines={1}>
                  {metrica.valor}
                </Text>
                <Text style={estilos.etiquetaMetrica} numberOfLines={1}>
                  {textoUI(idioma, metrica.etiquetaClave)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {tieneUbicacion ? (
          <View style={estilos.tarjetaUbicacion}>
            {slotIconoUbicacion ?? (
              <IconoUI nombre="pin" tamano={20} color={COLORES.verdeMedio} />
            )}
            <View style={estilos.ubicacionInfo}>
              <Text style={estilos.ubicacionEtiqueta} numberOfLines={1}>
                {textoUI(idioma, "tu_ubicacion")}
              </Text>
              <Text style={estilos.ubicacionValor} numberOfLines={1}>
                {ubicacionTexto}
              </Text>
            </View>
            {alPulsarModificarUbicacion !== undefined ? (
              <BotonSecundario
                etiqueta={textoUI(idioma, "modifier")}
                alPulsar={alPulsarModificarUbicacion}
                compacto={true}
              />
            ) : null}
          </View>
        ) : null}

        {pedidosDisponibles.length > 0 ? (
          <>
            <View style={estilos.cabeceraSeccion}>
              <Text style={estilos.tituloSeccion}>
                {textoUI(idioma, "commandes_disponibles")}
              </Text>
              {alPulsarVerTodosPedidos !== undefined ? (
                <Pressable onPress={alPulsarVerTodosPedidos}>
                  <Text style={estilos.enlaceVerTodo}>
                    {textoUI(idioma, "voir_tout")} ›
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={estilos.listaPedidos}>
              {pedidosDisponibles.map((pedido) => (
                <TarjetaPedido
                  key={pedido.id}
                  idioma={idioma}
                  titulo={pedido.titulo}
                  estado={pedido.estado}
                  etiquetaEstadoPersonalizada={pedido.etiquetaEstadoPersonalizada}
                  distanciaTexto={pedido.distanciaTexto}
                  subtitulo={pedido.subtitulo}
                  importeFormateado={pedido.importeFormateado}
                  imagenFuente={pedido.imagenFuente}
                  slotImagen={pedido.slotImagen}
                  slotIconoDistancia={
                    pedido.slotIconoDistancia ?? (
                      <IconoUI nombre="pin" tamano={13} color={COLORES.grafito} />
                    )
                  }
                  textoAccion={
                    pedido.alAceptar !== undefined ? textoUI(idioma, "accepter_course") : undefined
                  }
                  slotIconoAccion={
                    slotIconoAceptar ?? (
                      <IconoUI nombre="arrowRight" tamano={16} color={COLORES.blanco} />
                    )
                  }
                  alPulsarAccion={pedido.alAceptar}
                  alPulsarTarjeta={pedido.alAbrir}
                  accionDeshabilitada={pedido.accionDeshabilitada}
                />
              ))}
            </View>
          </>
        ) : null}

        {identidadVerificada ? (
          <View style={estilos.tarjetaVerificada}>
            {slotIconoEscudo ?? (
              <IconoUI nombre="shieldCheck" tamano={24} color={COLORES.verdeProfundo} />
            )}
            <View style={estilos.verificadaTextos}>
              <Text style={estilos.verificadaTitulo}>
                {textoUI(idioma, "identidad_verificada")}
              </Text>
              <Text style={estilos.verificadaSubtitulo}>
                {textoUI(idioma, "respetar_reglas")}
              </Text>
            </View>
          </View>
        ) : null}

        {seccionExtra}
      </ScrollView>

      <BarraNavegacionInferior
        elementos={elementosNav}
        claveActiva={tabActiva}
        alSeleccionar={alCambiarTab}
      />
    </View>
  );
}
