/**
 * KouriGo — aplicación móvil (Etapa 4): autenticación real contra Supabase
 * Auth y creación de pedidos conectada al backend real (PostgREST bajo RLS
 * + Edge Function transicion-pedido). El modo repartidor y la consola
 * administrativa se implementan en etapas posteriores del plan.
 *
 * Navegación por estado sin librerías extra: el alcance de la etapa exige
 * un flujo completo y verificable, no un mapa de pantallas decorativo.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PantallaInicioSesion, PantallaRegistro } from "./src/pantalla-autenticacion.js";
import { PantallaListaPedidos } from "./src/pantalla-lista-pedidos.js";
import { PantallaNuevoPedido } from "./src/pantalla-nuevo-pedido.js";
import { PantallaDetallePedido } from "./src/pantalla-detalle-pedido.js";
import { MensajeError, Titulo, COLORES } from "./src/components.js";
import { almacenAsyncStorage } from "./src/almacen-async-storage.js";
import {
  leerConfiguracionPublica,
  ConfiguracionFaltanteError,
  type ConfiguracionPublica,
} from "./src/configuracion.js";
import {
  cerrarSesion,
  crearClienteApp,
  sesionActual,
  suscribirseCambiosSesion,
  type SesionActiva,
} from "./src/auth.js";
import { ETIQUETA_IDIOMA, IDIOMAS, texto, type Idioma } from "./src/i18n.js";

type Ruta =
  | { readonly nombre: "inicio" }
  | { readonly nombre: "registro" }
  | { readonly nombre: "lista" }
  | { readonly nombre: "nuevo" }
  | { readonly nombre: "detalle"; readonly pedidoId: string };

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES.blanco,
  },
  contenidoError: {
    padding: 20,
    marginTop: 48,
  },
  barraIdioma: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 12,
  },
  textoIdioma: {
    color: COLORES.verde,
    fontWeight: "700",
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});

export default function App() {
  const [idioma, setIdioma] = useState<Idioma>("ht");
  const [cliente, setCliente] = useState<SupabaseClient | null>(null);
  const [configuracion, setConfiguracion] = useState<ConfiguracionPublica | null>(null);
  const [sesion, setSesion] = useState<SesionActiva | null>(null);
  const [ruta, setRuta] = useState<Ruta>({ nombre: "inicio" });
  const [errorConfiguracion, setErrorConfiguracion] = useState<string | null>(null);
  const [avisoRegistro, setAvisoRegistro] = useState<string | null>(null);
  const [cargandoInicial, setCargandoInicial] = useState(true);

  useEffect(() => {
    let cancelar = () => {};
    let activo = true;
    try {
      const config = leerConfiguracionPublica();
      // En el dispositivo la sesión se persiste con AsyncStorage; en la
      // prueba E2E (Node) el cliente se crea con el almacenamiento de
      // memoria directamente desde auth.ts. Aquí el bundle es móvil.
      const clienteApp = crearClienteApp(config, almacenAsyncStorage());
      setConfiguracion(config);
      setCliente(clienteApp);
      void sesionActual(clienteApp).then((sesionRestaurada) => {
        if (!activo) {
          return;
        }
        setSesion(sesionRestaurada);
        setRuta(sesionRestaurada === null ? { nombre: "inicio" } : { nombre: "lista" });
        setCargandoInicial(false);
      });
      cancelar = suscribirseCambiosSesion(clienteApp, (sesionNueva) => {
        setSesion(sesionNueva);
        if (sesionNueva === null) {
          setRuta({ nombre: "inicio" });
        }
      });
    } catch (error) {
      const mensaje =
        error instanceof ConfiguracionFaltanteError
          ? error.message
          : `Error al iniciar la aplicación: ${String(error)}`;
      setErrorConfiguracion(mensaje);
      setCargandoInicial(false);
    }
    return () => {
      activo = false;
      cancelar();
    };
  }, []);

  if (errorConfiguracion !== null) {
    return (
      <View style={estilos.contenedor}>
        <View style={estilos.contenidoError}>
          <Titulo>{texto(idioma, "nombre_app")}</Titulo>
          <MensajeError mensaje={errorConfiguracion} />
        </View>
      </View>
    );
  }

  if (cargandoInicial || cliente === null || configuracion === null) {
    return (
      <View style={estilos.contenedor}>
        <View style={estilos.contenidoError}>
          <Text>{texto(idioma, "cargando")}</Text>
        </View>
      </View>
    );
  }

  const cambiarIdioma = (nuevo: Idioma) => {
    setIdioma(nuevo);
  };

  const selectorIdioma = (
    <View style={estilos.barraIdioma}>
      {IDIOMAS.map((opcion) => (
        <Text
          key={opcion}
          onPress={() => cambiarIdioma(opcion)}
          style={[estilos.textoIdioma, opcion === idioma ? { color: COLORES.grafito } : null]}
        >
          {ETIQUETA_IDIOMA[opcion]}
        </Text>
      ))}
    </View>
  );

  if (sesion === null) {
    if (ruta.nombre === "registro") {
      return (
        <View style={estilos.contenedor}>
          {selectorIdioma}
          <PantallaRegistro
            idioma={idioma}
            cliente={cliente}
            alIniciar={(sesionNueva) => {
              setSesion(sesionNueva);
              setRuta({ nombre: "lista" });
            }}
            alPendienteConfirmacion={() => {
              setAvisoRegistro(texto(idioma, "pendiente_confirmacion"));
              setRuta({ nombre: "inicio" });
            }}
          />
        </View>
      );
    }
    return (
      <View style={estilos.contenedor}>
        {selectorIdioma}
        <PantallaInicioSesion
          idioma={idioma}
          cliente={cliente}
          aviso={avisoRegistro}
          alIniciar={(sesionNueva) => {
            setAvisoRegistro(null);
            setSesion(sesionNueva);
            setRuta({ nombre: "lista" });
          }}
        />
        <Text
          onPress={() => setRuta({ nombre: "registro" })}
          style={{ color: COLORES.verde, textAlign: "center", padding: 16, fontWeight: "700" }}
        >
          {texto(idioma, "no_tengo_cuenta")}
        </Text>
      </View>
    );
  }

  if (ruta.nombre === "nuevo") {
    return (
      <PantallaNuevoPedido
        idioma={idioma}
        cliente={cliente}
        alCreado={(pedidoId) => setRuta({ nombre: "detalle", pedidoId })}
      />
    );
  }

  if (ruta.nombre === "detalle") {
    return (
      <PantallaDetallePedido
        idioma={idioma}
        cliente={cliente}
        configuracion={configuracion}
        pedidoId={ruta.pedidoId}
        alVolver={() => setRuta({ nombre: "lista" })}
      />
    );
  }

  return (
    <PantallaListaPedidos
      idioma={idioma}
      alCambiarIdioma={cambiarIdioma}
      cliente={cliente}
      alAbrirDetalle={(pedidoId) => setRuta({ nombre: "detalle", pedidoId })}
      alNuevoPedido={() => setRuta({ nombre: "nuevo" })}
      alCerrarSesion={() => {
        void cerrarSesion(cliente);
      }}
    />
  );
}
