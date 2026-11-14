/**
 * Concha principal del CLIENTE (README sección 2.1 + maqueta aprobada):
 * cuatro pestañas reales con la barra inferior del kit de interfaz.
 *
 * Qué está CONECTADO al backend real (ADR-0001):
 *  - Accueil: PantallaClienteInicio del kit. Los botones navegan a flujos
 *    reales (creación de pedido delivery o compra asistida). Las categorías
 *    de catálogo NO se muestran: no existe catálogo en el backend y nada se
 *    simula.
 *  - Mes commandes: lista REAL de pedidos del cliente (PostgREST bajo RLS)
 *    con el filtro de búsqueda aplicado sobre los datos cargados.
 *  - Notifications: estado vacío HONESTO (no hay sistema de notificaciones
 *    todavía: sin push, sin tabla de notificaciones).
 *  - Profil: perfil REAL propio (RLS «perfiles_leer_propio_o_admin»),
 *    cambio de idioma persistido y cierre de sesión real.
 */
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipoPedido } from "@kourigo/domain";
import {
  BarraNavegacionInferior,
  EncabezadoLogo,
  textoUI,
  type ElementoNavegacionInferior,
} from "./ui";
import { PantallaClienteInicio } from "./ui/screens/PantallaClienteInicio";
import { BotonSecundario } from "./ui/components/BotonSecundario";
import {
  IconoBoutique,
  IconoBuscar,
  IconoDivers,
  IconoFlecha,
  IconoIdioma,
  IconoRestaurante,
  IconoRuta,
  IconoSupermercado,
} from "./iconos-maqueta";
import { Aviso, BarraIdiomas, MensajeError, COLORES } from "./components";
import { texto, type Idioma } from "./i18n";
import { leerPerfilPropio, type FilaPerfil } from "./perfil";
import { PantallaListaPedidos } from "./pantalla-lista-pedidos";

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.grisFondo,
  },
  contenidoCentrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  tarjetaVacia: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: COLORES.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: 16,
  },
  perfilTarjeta: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: COLORES.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: 16,
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
  perfilRol: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORES.verdeOscuro,
    marginTop: 6,
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

export interface PropsPantallaPrincipalCliente {
  readonly idioma: Idioma;
  readonly alCambiarIdioma: (idioma: Idioma) => void;
  readonly cliente: SupabaseClient;
  readonly correo: string | null;
  readonly alAbrirDetalle: (pedidoId: string) => void;
  /** Abre el formulario REAL de pedido nuevo con el tipo preseleccionado. */
  readonly alNuevoPedido: (tipoInicial: TipoPedido) => void;
  readonly alCerrarSesion: () => void;
}

type PestañaCliente = "accueil" | "commandes" | "notifications" | "profil";

export function PantallaPrincipalCliente({
  idioma,
  alCambiarIdioma,
  cliente,
  correo,
  alAbrirDetalle,
  alNuevoPedido,
  alCerrarSesion,
}: PropsPantallaPrincipalCliente) {
  const [pestaña, setPestaña] = useState<PestañaCliente>("accueil");
  const [busqueda, setBusqueda] = useState("");
  const [perfil, setPerfil] = useState<FilaPerfil | null>(null);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);

  const cargarPerfil = useCallback(async () => {
    setErrorPerfil(null);
    const resultado = await leerPerfilPropio(cliente);
    if (resultado.tipo === "ok") {
      setPerfil(resultado.datos);
      return;
    }
    setErrorPerfil(resultado.mensaje);
  }, [cliente]);

  useEffect(() => {
    void cargarPerfil();
  }, [cargarPerfil]);

  const elementosNav: readonly ElementoNavegacionInferior[] = [
    {
      clave: "accueil",
      etiqueta: textoUI(idioma, "nav_accueil"),
      renderIcono: (activo) => (
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            backgroundColor: activo ? COLORES.verdeMedio : COLORES.grisIconoInactivo,
          }}
        />
      ),
    },
    {
      clave: "commandes",
      etiqueta: textoUI(idioma, "nav_mes_commandes"),
      renderIcono: (activo) => <IconoRuta tamano={18} color={activo ? COLORES.verdeMedio : COLORES.grisIconoInactivo} />,
    },
    {
      clave: "notifications",
      etiqueta: textoUI(idioma, "nav_notifications"),
      renderIcono: (activo) => (
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: activo ? COLORES.verdeMedio : COLORES.grisIconoInactivo,
          }}
        />
      ),
    },
    {
      clave: "profil",
      etiqueta: textoUI(idioma, "nav_profil"),
      renderIcono: (activo) => (
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: activo ? COLORES.verdeMedio : COLORES.grisIconoInactivo,
          }}
        />
      ),
    },
  ];

  /** Losetas de servicio: navegan al formulario REAL con tipo preseleccionado. */
  const servicios = [
    {
      id: "boutiques",
      etiquetaClave: "servicio_boutiques" as const,
      slotIcono: <IconoBoutique />,
      alPulsar: () => alNuevoPedido("delivery"),
    },
    {
      id: "restaurants",
      etiquetaClave: "servicio_restaurants" as const,
      slotIcono: <IconoRestaurante />,
      alPulsar: () => alNuevoPedido("delivery"),
    },
    {
      id: "supermarches",
      etiquetaClave: "servicio_supermarches" as const,
      slotIcono: <IconoSupermercado />,
      alPulsar: () => alNuevoPedido("delivery"),
    },
    {
      id: "divers",
      etiquetaClave: "servicio_divers" as const,
      slotIcono: <IconoDivers />,
      alPulsar: () => alNuevoPedido("assisted_purchase"),
    },
  ];

  if (pestaña === "accueil") {
    return (
      <View style={estilos.pantalla}>
        <PantallaClienteInicio
          idioma={idioma}
          busqueda={busqueda}
          alCambiarBusqueda={setBusqueda}
          alEnviarBusqueda={() => setPestaña("commandes")}
          slotBanderaIdioma={<IconoIdioma />}
          alPulsarIdioma={() => setPestaña("profil")}
          slotIconoBuscar={<IconoBuscar />}
          slotImagenHero={<IconoRuta tamano={44} />}
          servicios={servicios}
          alPulsarPedidoRapido={() => alNuevoPedido("delivery")}
          slotIconoFlechaPromo={<IconoFlecha />}
          categorias={[]}
          elementosNav={elementosNav}
          tabActiva={pestaña}
          alCambiarTab={(clave) => setPestaña(clave as PestañaCliente)}
        />
      </View>
    );
  }

  if (pestaña === "commandes") {
    return (
      <View style={estilos.pantalla}>
        <View style={{ flex: 1 }}>
          <PantallaListaPedidosEmbebida
            idioma={idioma}
            alCambiarIdioma={alCambiarIdioma}
            cliente={cliente}
            alAbrirDetalle={alAbrirDetalle}
            alNuevoPedido={() => alNuevoPedido("delivery")}
            alCerrarSesion={alCerrarSesion}
            filtro={busqueda}
          />
        </View>
        <BarraNavegacionInferior
          elementos={elementosNav}
          claveActiva={pestaña}
          alSeleccionar={(clave) => setPestaña(clave as PestañaCliente)}
        />
      </View>
    );
  }

  if (pestaña === "notifications") {
    return (
      <View style={estilos.pantalla}>
        <EncabezadoLogo
          idioma={idioma}
          variante="titulo"
          tituloClave="nav_notifications"
          slotDerecha={<IconoIdioma />}
          alPulsarDerecha={() => setPestaña("profil")}
        />
        <View style={estilos.tarjetaVacia}>
          <Aviso mensaje={texto(idioma, "sin_notificaciones")} />
          <Text style={{ color: COLORES.grisTexto, fontSize: 13, marginTop: 8 }}>
            {texto(idioma, "sin_notificaciones_detalle")}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <BarraNavegacionInferior
          elementos={elementosNav}
          claveActiva={pestaña}
          alSeleccionar={(clave) => setPestaña(clave as PestañaCliente)}
        />
      </View>
    );
  }

  return (
    <View style={estilos.pantalla}>
      <EncabezadoLogo
        idioma={idioma}
        variante="titulo"
        tituloClave="nav_profil"
        slotDerecha={<IconoIdioma />}
        alPulsarDerecha={() => setPestaña("accueil")}
      />
      {errorPerfil !== null ? <MensajeError mensaje={errorPerfil} /> : null}
      <View style={estilos.perfilTarjeta}>
        <Text style={estilos.perfilNombre} numberOfLines={1}>
          {perfil !== null && perfil.full_name !== null && perfil.full_name.trim().length > 0
            ? perfil.full_name
            : (correo ?? "")}
        </Text>
        <Text style={estilos.perfilCorreo} numberOfLines={1}>
          {correo ?? ""}
        </Text>
        <Text style={estilos.perfilRol}>{texto(idioma, "rol_cliente")}</Text>
        <View style={estilos.filaIdioma}>
          <Text style={{ color: COLORES.grisTexto, fontSize: 13, fontWeight: "700" }}>
            {texto(idioma, "idioma")}
          </Text>
          <BarraIdiomas idioma={idioma} alCambiar={alCambiarIdioma} />
        </View>
        <View style={{ marginTop: 16 }}>
          <BotonSecundario etiqueta={texto(idioma, "nuevo_pedido")} alPulsar={() => alNuevoPedido("delivery")} />
        </View>
      </View>
      <View style={{ flex: 1 }} />
      <View style={estilos.pieSalir}>
        <Text onPress={alCerrarSesion} style={estilos.enlaceSalir}>
          {texto(idioma, "cerrar_sesion")}
        </Text>
      </View>
      <BarraNavegacionInferior
        elementos={elementosNav}
        claveActiva={pestaña}
        alSeleccionar={(clave) => setPestaña(clave as PestañaCliente)}
      />
    </View>
  );
}

/**
 * Lista de pedidos REAL reutilizada en pestaña (sin barra de marca ni pie de
 * sesión: los aporta la concha). El filtro de búsqueda es el texto del
 * buscador de Accueil.
 */
function PantallaListaPedidosEmbebida(props: {
  readonly idioma: Idioma;
  readonly alCambiarIdioma: (idioma: Idioma) => void;
  readonly cliente: SupabaseClient;
  readonly alAbrirDetalle: (pedidoId: string) => void;
  readonly alNuevoPedido: () => void;
  readonly alCerrarSesion: () => void;
  readonly filtro: string;
}) {
  return (
    <PantallaListaPedidos
      idioma={props.idioma}
      alCambiarIdioma={props.alCambiarIdioma}
      cliente={props.cliente}
      alAbrirDetalle={props.alAbrirDetalle}
      alNuevoPedido={props.alNuevoPedido}
      alCerrarSesion={props.alCerrarSesion}
      modoTab={true}
      filtro={props.filtro}
    />
  );
}
