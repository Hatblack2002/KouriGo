/**
 * KouriGo — aplicación móvil (Etapa 4 + kit de interfaz de la maqueta):
 * autenticación real contra Supabase Auth y pedidos conectados al backend
 * real (PostgREST bajo RLS + Edge Function transicion-pedido).
 *
 * Flujo de entrada según la decisión del fundador (2026-11-13): la primera
 * pantalla es la BIENVENIDA con la marca y la selección de idioma al frente
 * (français primero; kreyòl siempre presente). Con sesión activa, el rol lo
 * decide el BACKEND (user_roles, RLS «roles_leer_propio_o_admin»): con rol
 * courier activo se abre la concha de repartidor; en caso contrario la de
 * cliente. Nada se decide desde el cliente ni se simula.
 *
 * Navegación por estado sin librerías extra: el alcance exige un flujo
 * completo y verificable, no un mapa de pantallas decorativo.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipoPedido } from "@kourigo/domain";
import { PantallaBienvenida } from "./src/pantalla-bienvenida";
import { PantallaInicioSesion, PantallaRegistro } from "./src/pantalla-autenticacion";
import { PantallaPrincipalCliente } from "./src/pantalla-principal-cliente";
import { PantallaPrincipalRepartidor } from "./src/pantalla-principal-repartidor";
import { PantallaNuevoPedido } from "./src/pantalla-nuevo-pedido";
import { PantallaDetallePedido } from "./src/pantalla-detalle-pedido";
import { MensajeError, Marca, COLORES } from "./src/components";
import {
  almacenAsyncStorage,
  guardarIdioma,
  leerIdiomaGuardado,
} from "./src/almacen-async-storage";
import {
  leerConfiguracionPublica,
  ConfiguracionFaltanteError,
  type ConfiguracionPublica,
} from "./src/configuracion";
import {
  cerrarSesion,
  crearClienteApp,
  sesionActual,
  suscribirseCambiosSesion,
  type SesionActiva,
} from "./src/auth";
import { leerRolesActivos } from "./src/repartidor";
import { texto, type Idioma } from "./src/i18n";

type Ruta =
  | { readonly nombre: "bienvenida" }
  | { readonly nombre: "inicio" }
  | { readonly nombre: "registro" }
  | { readonly nombre: "principal" }
  | { readonly nombre: "nuevo"; readonly tipoInicial: TipoPedido }
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
  contenidoCentrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  textoCargando: {
    color: COLORES.grisTexto,
    fontSize: 14,
  },
});

export default function App() {
  const [idioma, setIdiomaEstado] = useState<Idioma>("fr");
  const [cliente, setCliente] = useState<SupabaseClient | null>(null);
  const [configuracion, setConfiguracion] = useState<ConfiguracionPublica | null>(null);
  const [sesion, setSesion] = useState<SesionActiva | null>(null);
  const [esCourier, setEsCourier] = useState<boolean | null>(null);
  const [ruta, setRuta] = useState<Ruta>({ nombre: "bienvenida" });
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
      void Promise.all([sesionActual(clienteApp), leerIdiomaGuardado()]).then(
        ([sesionRestaurada, idiomaGuardado]) => {
          if (!activo) {
            return;
          }
          if (idiomaGuardado === "ht" || idiomaGuardado === "fr") {
            setIdiomaEstado(idiomaGuardado);
          }
          setSesion(sesionRestaurada);
          setRuta(sesionRestaurada === null ? { nombre: "bienvenida" } : { nombre: "principal" });
          if (sesionRestaurada !== null) {
            // Rol efectivo leído del backend también en la sesión restaurada.
            void leerRolesActivos(clienteApp).then((resultado) => {
              if (!activo) {
                return;
              }
              setEsCourier(resultado.tipo === "ok" && resultado.datos.includes("courier"));
            });
          }
          setCargandoInicial(false);
        },
      );
      cancelar = suscribirseCambiosSesion(clienteApp, (sesionNueva) => {
        setSesion(sesionNueva);
        if (sesionNueva === null) {
          setEsCourier(null);
          setRuta({ nombre: "bienvenida" });
        } else {
          // Rol efectivo leído del backend en cada sesión nueva.
          void leerRolesActivos(clienteApp).then((resultado) => {
            if (!activo) {
              return;
            }
            setEsCourier(resultado.tipo === "ok" && resultado.datos.includes("courier"));
          });
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

  const cambiarIdioma = (nuevo: Idioma) => {
    setIdiomaEstado(nuevo);
    void guardarIdioma(nuevo);
  };

  if (errorConfiguracion !== null) {
    return (
      <View style={estilos.contenedor}>
        <View style={estilos.contenidoError}>
          <Marca idioma={idioma} />
          <MensajeError mensaje={errorConfiguracion} />
        </View>
      </View>
    );
  }

  if (cargandoInicial || cliente === null || configuracion === null) {
    return (
      <View style={estilos.contenedor}>
        <View style={estilos.contenidoCentrado}>
          <Marca idioma={idioma} centrado={true} />
          <Text style={estilos.textoCargando}>{texto(idioma, "cargando")}</Text>
        </View>
      </View>
    );
  }

  if (sesion === null) {
    if (ruta.nombre === "registro") {
      return (
        <PantallaRegistro
          idioma={idioma}
          cliente={cliente}
          alIniciar={(sesionNueva) => {
            setSesion(sesionNueva);
            setRuta({ nombre: "principal" });
          }}
          alVolver={() => setRuta({ nombre: "bienvenida" })}
          alPendienteConfirmacion={() => {
            setAvisoRegistro(texto(idioma, "pendiente_confirmacion"));
            setRuta({ nombre: "inicio" });
          }}
        />
      );
    }
    if (ruta.nombre === "inicio") {
      return (
        <PantallaInicioSesion
          idioma={idioma}
          cliente={cliente}
          aviso={avisoRegistro}
          alIniciar={(sesionNueva) => {
            setAvisoRegistro(null);
            setSesion(sesionNueva);
            setRuta({ nombre: "principal" });
          }}
          alVolver={() => setRuta({ nombre: "bienvenida" })}
        />
      );
    }
    return (
      <PantallaBienvenida
        idioma={idioma}
        alCambiarIdioma={cambiarIdioma}
        alIrRegistro={() => setRuta({ nombre: "registro" })}
        alIrInicioSesion={() => setRuta({ nombre: "inicio" })}
      />
    );
  }

  if (sesion !== null && esCourier === null) {
    // El rol efectivo viene del backend (user_roles): mientras se consulta,
    // se mantiene la pantalla de carga. No se adivina ningún rol.
    return (
      <View style={estilos.contenedor}>
        <View style={estilos.contenidoCentrado}>
          <Marca idioma={idioma} centrado={true} />
          <Text style={estilos.textoCargando}>{texto(idioma, "cargando")}</Text>
        </View>
      </View>
    );
  }

  if (ruta.nombre === "nuevo") {
    return (
      <PantallaNuevoPedido
        idioma={idioma}
        cliente={cliente}
        tipoInicial={ruta.tipoInicial}
        alCreado={(pedidoId) => setRuta({ nombre: "detalle", pedidoId })}
        alVolver={() => setRuta({ nombre: "principal" })}
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
        alVolver={() => setRuta({ nombre: "principal" })}
      />
    );
  }

  if (esCourier === true) {
    return (
      <PantallaPrincipalRepartidor
        idioma={idioma}
        alCambiarIdioma={cambiarIdioma}
        cliente={cliente}
        configuracion={configuracion}
        correo={sesion.correo}
        alCerrarSesion={() => {
          void cerrarSesion(cliente);
        }}
      />
    );
  }

  return (
    <PantallaPrincipalCliente
      idioma={idioma}
      alCambiarIdioma={cambiarIdioma}
      cliente={cliente}
      correo={sesion.correo}
      alAbrirDetalle={(pedidoId) => setRuta({ nombre: "detalle", pedidoId })}
      alNuevoPedido={(tipoInicial) => setRuta({ nombre: "nuevo", tipoInicial })}
      alCerrarSesion={() => {
        void cerrarSesion(cliente);
      }}
    />
  );
}
