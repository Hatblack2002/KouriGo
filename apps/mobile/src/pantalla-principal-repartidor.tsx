/**
 * Concha principal del REPARTIDOR (maqueta aprobada): cuatro pestañas reales.
 *
 * Qué está CONECTADO al backend real (ADR-0001):
 *  - Courses: PantallaRepartidorInicio del kit. El interruptor guarda la
 *    disponibilidad REAL en courier_profiles.available (migración 0005). Los
 *    KPI se calculan de order_assignments terminadas. Las ofertas vienen del
 *    despacho administrativo real (Edge Function despachar-pedido) y se
 *    aceptan con la Edge Function transicion-pedido + actualización de la
 *    asignación bajo RLS. La zona de trabajo es el campo real work_zone.
 *  - Historique: asignaciones completed REALES.
 *  - Portefeuille: estado vacío HONESTO (los pagos son otra etapa: no hay
 *    ledger visible ni cobros en el móvil todavía).
 *  - Paramètres: perfil REAL propio, zona de trabajo editable (RLS
 *    «courier_actualizar_expediente_propio»), idioma y cierre de sesión.
 *
 * Qué NO se muestra porque el backend no lo expone (nada se simula): nota de
 * calificaciones (no existe tabla), mapa real, historial de pagos, notificaciones.
 */
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoPedido } from "@kourigo/domain";
import {
  BarraNavegacionInferior,
  BotonPrimario,
  EncabezadoLogo,
  IconoUI,
  TarjetaPedido,
  textoUI,
  type ElementoNavegacionInferior,
} from "./ui";
import { PantallaRepartidorInicio } from "./ui/screens/PantallaRepartidorInicio";
import { BotonSecundario } from "./ui/components/BotonSecundario";
import {
  IconoAceptar,
  IconoCaja,
  IconoCampana,
  IconoCheckCirculo,
  IconoEscudo,
  IconoIdioma,
  IconoRuta,
  IconoUbicacion,
} from "./iconos-maqueta";
import { Aviso, BarraIdiomas, Boton, MensajeError, COLORES } from "./components";
import { texto, type Idioma } from "./i18n";
import { formatearDinero } from "./formato";
import {
  actualizarAsignacion,
  calcularKpisCourier,
  clasificarAsignaciones,
  courierOperativo,
  guardarDisponibilidad,
  guardarZonaTrabajo,
  leerPerfilCourier,
  listarAsignaciones,
  siguienteTransicionCourier,
  type FilaAsignacion,
  type FilaPerfilCourier,
} from "./repartidor";
import { transicionarPedido } from "./pedidos";
import type { ConfiguracionPublica } from "./configuracion";

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.grisFondo,
  },
  contenido: {
    padding: 16,
    paddingBottom: 32,
  },
  tarjeta: {
    backgroundColor: COLORES.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: 16,
    marginBottom: 12,
  },
  tituloSeccion: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORES.grafito,
    marginBottom: 8,
  },
  vacio: {
    textAlign: "center",
    color: COLORES.grisTexto,
    marginTop: 16,
  },
  entrada: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORES.grafito,
    backgroundColor: COLORES.blanco,
  },
  perfilNombre: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORES.grafito,
  },
  perfilCorreo: {
    fontSize: 14,
    color: COLORES.grisTexto,
    marginTop: 2,
  },
  filaIdioma: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  pieSalir: {
    paddingVertical: 16,
    alignItems: "center",
  },
  enlaceSalir: {
    color: COLORES.grisTexto,
    fontWeight: "700",
    fontSize: 13,
  },
});

export interface PropsPantallaPrincipalRepartidor {
  readonly idioma: Idioma;
  readonly alCambiarIdioma: (idioma: Idioma) => void;
  readonly cliente: SupabaseClient;
  readonly configuracion: ConfiguracionPublica;
  readonly correo: string | null;
  readonly alCerrarSesion: () => void;
}

type PestañaRepartidor = "courses" | "historique" | "portefeuille" | "parametres";

export function PantallaPrincipalRepartidor({
  idioma,
  alCambiarIdioma,
  cliente,
  configuracion,
  correo,
  alCerrarSesion,
}: PropsPantallaPrincipalRepartidor) {
  const [pestaña, setPestaña] = useState<PestañaRepartidor>("courses");
  const [perfil, setPerfil] = useState<FilaPerfilCourier | null>(null);
  const [sinPerfil, setSinPerfil] = useState(false);
  const [asignaciones, setAsignaciones] = useState<readonly FilaAsignacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [enAccion, setEnAccion] = useState(false);
  const [zonaTexto, setZonaTexto] = useState("");
  const [avisoZona, setAvisoZona] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    setSinPerfil(false);
    const [resultadoPerfil, resultadoAsignaciones] = await Promise.all([
      leerPerfilCourier(cliente),
      listarAsignaciones(cliente),
    ]);
    setCargando(false);
    if (resultadoPerfil.tipo === "error") {
      setError(resultadoPerfil.mensaje);
      return;
    }
    setPerfil(resultadoPerfil.datos);
    setSinPerfil(resultadoPerfil.datos === null);
    setZonaTexto(resultadoPerfil.datos?.work_zone ?? "");
    if (resultadoAsignaciones.tipo === "error") {
      setError(resultadoAsignaciones.mensaje);
      setAsignaciones([]);
      return;
    }
    setAsignaciones(resultadoAsignaciones.datos);
  }, [cliente]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function aceptarOferta(asignacion: FilaAsignacion) {
    if (asignacion.orders === null) {
      return;
    }
    setErrorAccion(null);
    setEnAccion(true);
    // 1) El pedido pasa offered->accepted con la Edge Function real (el actor
    //    «repartidor» lo determina el servidor con el JWT).
    const transicion = await transicionarPedido(
      configuracion,
      cliente,
      asignacion.order_id,
      "accepted",
    );
    if (transicion.tipo === "error") {
      setEnAccion(false);
      setErrorAccion(transicion.mensaje);
      return;
    }
    // 2) La asignación se marca accepted (RLS + trigger SQL revalidan).
    const asignacionActualizada = await actualizarAsignacion(cliente, asignacion.id, "accepted");
    setEnAccion(false);
    if (asignacionActualizada.tipo === "error") {
      setErrorAccion(asignacionActualizada.mensaje);
      return;
    }
    await cargar();
  }

  async function rechazarOferta(asignacion: FilaAsignacion) {
    setErrorAccion(null);
    setEnAccion(true);
    const resultado = await actualizarAsignacion(cliente, asignacion.id, "rejected");
    setEnAccion(false);
    if (resultado.tipo === "error") {
      setErrorAccion(resultado.mensaje);
      return;
    }
    await cargar();
  }

  /** Siguiente paso operativo del curso activo (matriz de @kourigo/domain). */
  async function avanzarCurso(asignacion: FilaAsignacion) {
    if (asignacion.orders === null) {
      return;
    }
    const destino = siguienteTransicionCourier(asignacion.orders.status);
    if (destino === null) {
      return;
    }
    setErrorAccion(null);
    setEnAccion(true);
    const transicion = await transicionarPedido(
      configuracion,
      cliente,
      asignacion.order_id,
      destino,
    );
    if (transicion.tipo === "error") {
      setEnAccion(false);
      setErrorAccion(transicion.mensaje);
      return;
    }
    // Al entregar, la asignación se cierra como completed (trigger SQL fija
    // completed_at: es la fuente real de los KPI e historial).
    if (destino === "delivered") {
      const cierre = await actualizarAsignacion(cliente, asignacion.id, "completed");
      if (cierre.tipo === "error") {
        setEnAccion(false);
        setErrorAccion(cierre.mensaje);
        return;
      }
    }
    setEnAccion(false);
    await cargar();
  }

  async function cambiarDisponibilidad(nuevoValor: boolean) {
    const resultado = await guardarDisponibilidad(cliente, nuevoValor);
    if (resultado.tipo === "error") {
      setErrorAccion(resultado.mensaje);
      return;
    }
    setPerfil((actual) => (actual === null ? actual : { ...actual, available: nuevoValor }));
  }

  async function guardarZona() {
    setAvisoZona(null);
    const zona = zonaTexto.trim();
    if (zona.length === 0) {
      return;
    }
    const resultado = await guardarZonaTrabajo(cliente, zona);
    if (resultado.tipo === "error") {
      setAvisoZona(resultado.mensaje);
      return;
    }
    setAvisoZona(texto(idioma, "cambios_guardados"));
    await cargar();
  }

  const cursos = clasificarAsignaciones(asignaciones);
  const kpis = calcularKpisCourier(asignaciones, new Date());
  const operativo = courierOperativo(perfil);

  function etiquetaAccion(destino: EstadoPedido): string {
    switch (destino) {
      case "accepted":
        return texto(idioma, "accion_aceptar");
      case "at_pickup":
        return texto(idioma, "accion_ir_recogida");
      case "picked_up":
        return texto(idioma, "accion_recoger");
      case "in_transit":
        return texto(idioma, "accion_en_camino");
      case "delivered":
        return texto(idioma, "accion_entregar");
      default:
        return texto(idioma, "estado");
    }
  }

  function tituloPedido(asignacion: FilaAsignacion): string {
    const pedido = asignacion.orders;
    if (pedido === null) {
      return asignacion.order_id.slice(0, 8).toUpperCase();
    }
    const tipo =
      pedido.order_type === "assisted_purchase"
        ? texto(idioma, "tipo_compra_asistida")
        : texto(idioma, "tipo_entrega");
    return `${tipo} · ${pedido.id.slice(0, 8).toUpperCase()}`;
  }

  const elementosNav: readonly ElementoNavegacionInferior[] = [
    {
      clave: "courses",
      etiqueta: textoUI(idioma, "nav_courses"),
      renderIcono: (activo) => (
        <IconoUI nombre="scooter" tamano={20} color={activo ? COLORES.verde : COLORES.grisTexto} />
      ),
    },
    {
      clave: "historique",
      etiqueta: textoUI(idioma, "nav_historique"),
      renderIcono: (activo) => (
        <IconoUI nombre="chart" tamano={20} color={activo ? COLORES.verde : COLORES.grisTexto} />
      ),
    },
    {
      clave: "portefeuille",
      etiqueta: textoUI(idioma, "nav_portefeuille"),
      renderIcono: (activo) => (
        <IconoUI nombre="wallet" tamano={20} color={activo ? COLORES.verde : COLORES.grisTexto} />
      ),
    },
    {
      clave: "parametres",
      etiqueta: textoUI(idioma, "nav_parametres"),
      renderIcono: (activo) => (
        <IconoUI nombre="settings" tamano={20} color={activo ? COLORES.verde : COLORES.grisTexto} />
      ),
    },
  ];

  /** Cursos ya aceptados: tarjeta con la siguiente transición REAL. */
  function seccionCursosActivos() {
    if (cursos.activos.length === 0) {
      return null;
    }
    return (
      <View>
        <Text style={estilos.tituloSeccion}>{texto(idioma, "cursos_activos")}</Text>
        {cursos.activos.map((asignacion) => {
          const pedido = asignacion.orders;
          const destino = pedido === null ? null : siguienteTransicionCourier(pedido.status);
          return (
            <View key={asignacion.id} style={{ marginBottom: 12 }}>
              <TarjetaPedido
                idioma={idioma}
                titulo={tituloPedido(asignacion)}
                estado={pedido?.status ?? ""}
                distanciaTexto={undefined}
                subtitulo={
                  pedido === null
                    ? undefined
                    : `${pedido.pickup_address_text} → ${pedido.dropoff_address_text}`
                }
                importeFormateado={
                  pedido === null
                    ? undefined
                    : formatearDinero(pedido.service_fee_amount, pedido.currency)
                }
                slotImagen={<IconoRuta />}
                textoAccion={destino === null || enAccion ? undefined : etiquetaAccion(destino)}
                slotIconoAccion={<IconoAceptar />}
                alPulsarAccion={
                  destino === null || enAccion
                    ? undefined
                    : () => {
                        void avanzarCurso(asignacion);
                      }
                }
              />
            </View>
          );
        })}
      </View>
    );
  }

  if (pestaña === "courses") {
    return (
      <View style={estilos.pantalla}>
        {error !== null ? <MensajeError mensaje={error} /> : null}
        <PantallaRepartidorInicio
          idioma={idioma}
          enLinea={perfil?.available === true}
          alCambiarEnLinea={cambiarDisponibilidad}
          enLineaDeshabilitado={sinPerfil || cargando}
          slotLogo={undefined}
          badgeNotificacionesHeader={undefined}
          slotIconoCampana={<IconoCampana />}
          alPulsarCampana={() => setPestaña("parametres")}
          metricas={[
            {
              id: "hoy",
              valor: String(kpis.entregasHoy),
              etiquetaClave: "kpi_hoy",
              slotIcono: <IconoCaja tamano={20} />,
            },
            {
              id: "totales",
              valor: String(kpis.entregasTotales),
              etiquetaClave: "kpi_entregadas",
              slotIcono: <IconoCheckCirculo />,
            },
          ]}
          ubicacionTexto={perfil?.work_zone ?? undefined}
          slotIconoUbicacion={<IconoUbicacion />}
          alPulsarModificarUbicacion={() => setPestaña("parametres")}
          slotIconoAceptar={<IconoAceptar />}
          pedidosDisponibles={cursos.ofertas.map((asignacion) => ({
            id: asignacion.id,
            titulo: tituloPedido(asignacion),
            estado: asignacion.orders?.status ?? "offered",
            subtitulo:
              asignacion.orders === null
                ? undefined
                : `${asignacion.orders.pickup_address_text} → ${asignacion.orders.dropoff_address_text}`,
            importeFormateado:
              asignacion.orders === null
                ? undefined
                : formatearDinero(asignacion.orders.service_fee_amount, asignacion.orders.currency),
            slotImagen: <IconoRuta />,
            alAceptar:
              enAccion || !operativo
                ? undefined
                : () => {
                    void aceptarOferta(asignacion);
                  },
          }))}
          identidadVerificada={operativo}
          slotIconoEscudo={<IconoEscudo />}
          seccionExtra={
            <>
              {sinPerfil ? <Aviso mensaje={texto(idioma, "expediente_vacio")} /> : null}
              {!sinPerfil && !operativo ? (
                <Aviso mensaje={texto(idioma, "identidad_pendiente")} />
              ) : null}
              {errorAccion !== null ? <MensajeError mensaje={errorAccion} /> : null}
              {cursos.ofertas.length > 0 && operativo && !enAccion ? (
                <View>
                  <Text style={estilos.tituloSeccion}>{texto(idioma, "accion_rechazar")}</Text>
                  {cursos.ofertas.map((asignacion) => (
                    <View key={`rechazo-${asignacion.id}`} style={{ marginBottom: 8 }}>
                      <BotonSecundario
                        etiqueta={`${texto(idioma, "accion_rechazar")} · ${tituloPedido(asignacion)}`}
                        alPulsar={() => {
                          void rechazarOferta(asignacion);
                        }}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
              {seccionCursosActivos()}
            </>
          }
          elementosNav={elementosNav}
          tabActiva={pestaña}
          alCambiarTab={(clave) => setPestaña(clave as PestañaRepartidor)}
        />
      </View>
    );
  }

  if (pestaña === "historique") {
    return (
      <View style={estilos.pantalla}>
        <EncabezadoLogo
          idioma={idioma}
          variante="titulo"
          tituloClave="nav_historique"
          slotDerecha={<IconoIdioma />}
          alPulsarDerecha={() => setPestaña("parametres")}
        />
        {error !== null ? <MensajeError mensaje={error} /> : null}
        <ScrollView contentContainerStyle={estilos.contenido}>
          {cursos.terminados.length === 0 && !cargando ? (
            <Text style={estilos.vacio}>{texto(idioma, "historique_vacio")}</Text>
          ) : null}
          {cursos.terminados.map((asignacion) => (
            <TarjetaPedido
              key={asignacion.id}
              idioma={idioma}
              titulo={tituloPedido(asignacion)}
              estado={asignacion.orders?.status ?? "delivered"}
              subtitulo={
                asignacion.orders === null
                  ? undefined
                  : `${asignacion.orders.pickup_address_text} → ${asignacion.orders.dropoff_address_text}`
              }
              importeFormateado={
                asignacion.orders === null
                  ? undefined
                  : formatearDinero(
                      asignacion.orders.service_fee_amount,
                      asignacion.orders.currency,
                    )
              }
              slotImagen={<IconoRuta />}
            />
          ))}
        </ScrollView>
        <BarraNavegacionInferior
          elementos={elementosNav}
          claveActiva={pestaña}
          alSeleccionar={(clave) => setPestaña(clave as PestañaRepartidor)}
        />
      </View>
    );
  }

  if (pestaña === "portefeuille") {
    return (
      <View style={estilos.pantalla}>
        <EncabezadoLogo
          idioma={idioma}
          variante="titulo"
          tituloClave="nav_portefeuille"
          slotDerecha={<IconoIdioma />}
          alPulsarDerecha={() => setPestaña("parametres")}
        />
        <View style={estilos.tarjeta}>
          <Aviso mensaje={texto(idioma, "portefeuille_pendiente")} />
        </View>
        <View style={{ flex: 1 }} />
        <BarraNavegacionInferior
          elementos={elementosNav}
          claveActiva={pestaña}
          alSeleccionar={(clave) => setPestaña(clave as PestañaRepartidor)}
        />
      </View>
    );
  }

  return (
    <View style={estilos.pantalla}>
      <EncabezadoLogo
        idioma={idioma}
        variante="titulo"
        tituloClave="nav_parametres"
        slotDerecha={<IconoIdioma />}
        alPulsarDerecha={() => setPestaña("courses")}
      />
      <ScrollView contentContainerStyle={estilos.contenido}>
        {error !== null ? <MensajeError mensaje={error} /> : null}
        <View style={estilos.tarjeta}>
          <Text style={estilos.perfilNombre}>{correo ?? ""}</Text>
          <Text
            style={{ fontSize: 12, fontWeight: "700", color: COLORES.verdeOscuro, marginTop: 4 }}
          >
            {texto(idioma, "rol_courier")}
          </Text>
          <View style={estilos.filaIdioma}>
            <Text style={{ color: COLORES.grisTexto, fontSize: 13, fontWeight: "700" }}>
              {texto(idioma, "idioma")}
            </Text>
            <BarraIdiomas idioma={idioma} alCambiar={alCambiarIdioma} />
          </View>
        </View>
        <View style={estilos.tarjeta}>
          <Text style={estilos.tituloSeccion}>{texto(idioma, "zona_trabajo")}</Text>
          <TextInput
            style={estilos.entrada}
            value={zonaTexto}
            onChangeText={setZonaTexto}
            placeholder={texto(idioma, "zona_trabajo")}
            placeholderTextColor={COLORES.grisTexto}
            editable={perfil !== null}
            autoCapitalize="none"
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Boton
                textoBoton={texto(idioma, "guardar")}
                alPulsar={() => void guardarZona()}
                deshabilitado={perfil === null}
              />
            </View>
          </View>
          {avisoZona !== null ? <Aviso mensaje={avisoZona} /> : null}
        </View>
        <View style={estilos.tarjeta}>
          <Text style={estilos.tituloSeccion}>{texto(idioma, "disponibilidad")}</Text>
          <Text style={{ color: COLORES.grisTexto, fontSize: 13 }}>
            {perfil?.available === true
              ? textoUI(idioma, "recibiendo_pedidos")
              : textoUI(idioma, "no_recibiendo_pedidos")}
          </Text>
          <View style={{ marginTop: 12 }}>
            <BotonPrimario
              etiqueta={textoUI(
                idioma,
                perfil?.available === true ? "estado_fuera_linea" : "estado_en_linea",
              )}
              alPulsar={() => void cambiarDisponibilidad(!(perfil?.available === true))}
            />
          </View>
        </View>
      </ScrollView>
      <View style={estilos.pieSalir}>
        <Text onPress={alCerrarSesion} style={estilos.enlaceSalir}>
          {texto(idioma, "cerrar_sesion")}
        </Text>
      </View>
      <BarraNavegacionInferior
        elementos={elementosNav}
        claveActiva={pestaña}
        alSeleccionar={(clave) => setPestaña(clave as PestañaRepartidor)}
      />
    </View>
  );
}
