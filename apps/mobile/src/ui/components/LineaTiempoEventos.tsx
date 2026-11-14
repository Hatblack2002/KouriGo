import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA } from "../theme/tokens";

export type EstadoPasoTimeline = "completado" | "activo" | "pendiente";

export interface EventoLineaTiempo {
  readonly id: string;
  readonly titulo: string;
  readonly subtitulo?: string;
  readonly estadoPaso: EstadoPasoTimeline;
  readonly slotIcono?: ReactNode;
}

export interface LineaTiempoEventosProps {
  readonly eventos: readonly EventoLineaTiempo[];
}

const estilos = StyleSheet.create({
  contenedor: {
    width: "100%",
  },
  fila: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  eje: {
    width: 34,
    alignItems: "center",
    marginRight: ESPACIADO.md,
  },
  nodoCompletado: {
    width: 24,
    height: 24,
    borderRadius: RADIOS.pill,
    backgroundColor: COLORES.verdeTimeline,
    alignItems: "center",
    justifyContent: "center",
  },
  nodoActivo: {
    width: 30,
    height: 30,
    borderRadius: RADIOS.pill,
    backgroundColor: COLORES.verdeMentaClaro,
    borderWidth: 1.5,
    borderColor: COLORES.verdeMedio,
    alignItems: "center",
    justifyContent: "center",
  },
  nodoPendiente: {
    width: 22,
    height: 22,
    borderRadius: RADIOS.pill,
    backgroundColor: COLORES.borde,
    alignItems: "center",
    justifyContent: "center",
  },
  puntoPendienteInterno: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORES.blanco,
  },
  puntoCompletadoInterno: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORES.blanco,
  },
  puntoActivoInterno: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORES.verdeMedio,
  },
  linea: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginVertical: 3,
  },
  lineaCompletada: {
    backgroundColor: COLORES.verdeTimeline,
  },
  lineaPendiente: {
    backgroundColor: COLORES.borde,
  },
  cuerpo: {
    flex: 1,
    paddingBottom: ESPACIADO.lg,
    justifyContent: "flex-start",
  },
  cuerpoUltimo: {
    paddingBottom: ESPACIADO.xs,
  },
  titulo: {
    ...TIPOGRAFIA.tarjetaTitulo,
    color: COLORES.grafito,
  },
  tituloPendiente: {
    ...TIPOGRAFIA.cuerpo,
    fontWeight: "500",
    color: COLORES.grisTexto,
  },
  subtitulo: {
    ...TIPOGRAFIA.cuerpoMedio,
    color: COLORES.grisTexto,
    marginTop: 2,
  },
  subtituloActivo: {
    ...TIPOGRAFIA.tarjetaTitulo,
    fontSize: 14,
    color: COLORES.verdeMedio,
    marginTop: 2,
  },
});

export function LineaTiempoEventos({ eventos }: LineaTiempoEventosProps) {
  if (eventos.length === 0) {
    return null;
  }

  return (
    <View style={estilos.contenedor}>
      {eventos.map((evento, indice) => {
        const esUltimo = indice === eventos.length - 1;
        const esCompletado = evento.estadoPaso === "completado";
        const esActivo = evento.estadoPaso === "activo";

        return (
          <View key={evento.id} style={estilos.fila}>
            <View style={estilos.eje}>
              <View
                style={
                  esCompletado
                    ? estilos.nodoCompletado
                    : esActivo
                      ? estilos.nodoActivo
                      : estilos.nodoPendiente
                }
              >
                {evento.slotIcono !== undefined ? (
                  evento.slotIcono
                ) : (
                  <View
                    style={
                      esCompletado
                        ? estilos.puntoCompletadoInterno
                        : esActivo
                          ? estilos.puntoActivoInterno
                          : estilos.puntoPendienteInterno
                    }
                  />
                )}
              </View>

              {!esUltimo ? (
                <View
                  style={[
                    estilos.linea,
                    esCompletado ? estilos.lineaCompletada : estilos.lineaPendiente,
                  ]}
                />
              ) : null}
            </View>

            <View style={[estilos.cuerpo, esUltimo ? estilos.cuerpoUltimo : null]}>
              <Text
                style={evento.estadoPaso === "pendiente" ? estilos.tituloPendiente : estilos.titulo}
              >
                {evento.titulo}
              </Text>
              {evento.subtitulo !== undefined && evento.subtitulo.trim().length > 0 ? (
                <Text style={esActivo ? estilos.subtituloActivo : estilos.subtitulo}>
                  {evento.subtitulo}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
