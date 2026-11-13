/**
 * Consola administrativa web de KouriGo (Etapa 5, README secciones 2.3 y
 * 14): aplicación separada, con acceso restringido y protección REAL en el
 * backend — el permiso administrativo se comprueba contra `user_roles` bajo
 * RLS al abrir la sesión y las operaciones privilegiadas pasan por las
 * Edge Functions del runtime (ADR-0005). Un no administrador queda
 * bloqueado aunque conozca las URLs (README criterio de aceptación).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SesionActiva } from "./auth";
import {
  cerrarSesion,
  crearClienteAdmin,
  leerNombrePropio,
  leerRolAdministrador,
  sesionActual,
} from "./auth";
import { MensajeError, Tarjeta } from "./componentes";
import { ConfiguracionFaltanteError, leerConfiguracionPublica } from "./configuracion";
import { PantallaAuditoria } from "./pantallas/PantallaAuditoria";
import { PantallaDetalleExpediente } from "./pantallas/PantallaDetalleExpediente";
import { PantallaDetallePedido } from "./pantallas/PantallaDetallePedido";
import { PantallaLogin } from "./pantallas/PantallaLogin";
import { PantallaPedidos } from "./pantallas/PantallaPedidos";
import { PantallaRepartidores } from "./pantallas/PantallaRepartidores";
import { PantallaResumen } from "./pantallas/PantallaResumen";

type Vista =
  | { readonly pantalla: "resumen" }
  | { readonly pantalla: "pedidos" }
  | { readonly pantalla: "pedido"; readonly id: string }
  | { readonly pantalla: "repartidores" }
  | { readonly pantalla: "expediente"; readonly id: string }
  | { readonly pantalla: "auditoria" };

type EstadoAcceso = "comprobando" | "sin-sesion" | "administrador" | "sin-permisos";

export function App() {
  // La configuración faltante es un error de despliegue, no de sesión:
  // se muestra de forma explícita en lugar de una pantalla en blanco.
  const configuracion = useMemo(() => {
    try {
      return { tipo: "ok" as const, valor: leerConfiguracionPublica() };
    } catch (error) {
      return {
        tipo: "error" as const,
        mensaje:
          error instanceof ConfiguracionFaltanteError
            ? error.message
            : "Error desconocido al leer la configuración pública.",
      };
    }
  }, []);

  const cliente = useMemo(
    () => (configuracion.tipo === "ok" ? crearClienteAdmin(configuracion.valor) : null),
    [configuracion],
  );

  const [acceso, setAcceso] = useState<EstadoAcceso>("comprobando");
  const [sesion, setSesion] = useState<SesionActiva | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);
  const [errorAcceso, setErrorAcceso] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>({ pantalla: "resumen" });

  const comprobarRol = useCallback(
    async (sesionActiva: SesionActiva) => {
      if (cliente === null) {
        return;
      }
      const rol = await leerRolAdministrador(cliente);
      if (rol.tipo === "error") {
        setErrorAcceso(rol.mensaje);
        setAcceso("sin-permisos");
        return;
      }
      setSesion(sesionActiva);
      setAcceso(rol.administrador ? "administrador" : "sin-permisos");
      if (rol.administrador) {
        setNombre(await leerNombrePropio(cliente));
      }
    },
    [cliente],
  );

  // Restaurar la sesión persistida del navegador al abrir la consola.
  useEffect(() => {
    if (cliente === null) {
      return;
    }
    let montado = true;
    void (async () => {
      const restaurada = await sesionActual(cliente);
      if (!montado) {
        return;
      }
      if (restaurada.tipo === "ok") {
        await comprobarRol(restaurada.sesion);
      } else if (restaurada.tipo === "error") {
        setErrorAcceso(restaurada.mensaje);
        setAcceso("sin-sesion");
      } else {
        setAcceso("sin-sesion");
      }
    })();
    return () => {
      montado = false;
    };
  }, [cliente, comprobarRol]);

  async function alIniciar(sesionNueva: SesionActiva) {
    setErrorAcceso(null);
    await comprobarRol(sesionNueva);
  }

  async function salir() {
    if (cliente !== null) {
      await cerrarSesion(cliente);
    }
    setSesion(null);
    setNombre(null);
    setAcceso("sin-sesion");
    setVista({ pantalla: "resumen" });
  }

  if (configuracion.tipo === "error" || cliente === null) {
    return (
      <div className="pantalla-centrada">
        <Tarjeta titulo="Configuración faltante">
          <MensajeError
            mensaje={
              configuracion.tipo === "error"
                ? configuracion.mensaje
                : "No se pudo crear el cliente del backend."
            }
          />
          <p className="nota">
            La consola se compila con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
          </p>
        </Tarjeta>
      </div>
    );
  }

  if (acceso === "comprobando") {
    return (
      <div className="pantalla-centrada">
        <p className="cargando">Restaurando la sesión real…</p>
      </div>
    );
  }

  if (acceso === "sin-sesion") {
    return <PantallaLogin cliente={cliente} alIniciar={(s) => void alIniciar(s)} />;
  }

  if (acceso === "sin-permisos" || sesion === null) {
    return (
      <div className="pantalla-centrada">
        <Tarjeta titulo="Acceso denegado">
          <MensajeError
            mensaje={
              errorAcceso ??
              "La sesión es real pero no tiene rol administrativo activo en user_roles " +
                "(comprobado contra el backend bajo RLS)."
            }
          />
          <p className="nota">
            La consola bloquea a usuarios sin permisos aunque conozcan las URLs; los datos quedan
            además protegidos por RLS en el servidor.
          </p>
          <button className="accion" onClick={() => void salir()}>
            Cerrar sesión
          </button>
        </Tarjeta>
      </div>
    );
  }

  return (
    <>
      <header className="barra">
        <span className="marca">KouriGo · Consola administrativa</span>
        <nav>
          <button
            className={vista.pantalla === "resumen" ? "activo" : ""}
            onClick={() => setVista({ pantalla: "resumen" })}
          >
            Resumen
          </button>
          <button
            className={vista.pantalla === "pedidos" || vista.pantalla === "pedido" ? "activo" : ""}
            onClick={() => setVista({ pantalla: "pedidos" })}
          >
            Pedidos
          </button>
          <button
            className={
              vista.pantalla === "repartidores" || vista.pantalla === "expediente" ? "activo" : ""
            }
            onClick={() => setVista({ pantalla: "repartidores" })}
          >
            Repartidores
          </button>
          <button
            className={vista.pantalla === "auditoria" ? "activo" : ""}
            onClick={() => setVista({ pantalla: "auditoria" })}
          >
            Auditoría
          </button>
        </nav>
        <span className="usuario">
          <span>{nombre ?? sesion.correo}</span>
          <button onClick={() => void salir()}>Cerrar sesión</button>
        </span>
      </header>
      <main className="contenido">
        {vista.pantalla === "resumen" ? <PantallaResumen cliente={cliente} /> : null}
        {vista.pantalla === "pedidos" ? (
          <PantallaPedidos
            cliente={cliente}
            alAbrirPedido={(id) => setVista({ pantalla: "pedido", id })}
          />
        ) : null}
        {vista.pantalla === "pedido" ? (
          <PantallaDetallePedido
            cliente={cliente}
            configuracion={configuracion.valor}
            sesion={sesion}
            pedidoId={vista.id}
            alVolver={() => setVista({ pantalla: "pedidos" })}
          />
        ) : null}
        {vista.pantalla === "repartidores" ? (
          <PantallaRepartidores
            cliente={cliente}
            alAbrirCaso={(id) => setVista({ pantalla: "expediente", id })}
          />
        ) : null}
        {vista.pantalla === "expediente" ? (
          <PantallaDetalleExpediente
            cliente={cliente}
            configuracion={configuracion.valor}
            sesion={sesion}
            casoId={vista.id}
            alVolver={() => setVista({ pantalla: "repartidores" })}
          />
        ) : null}
        {vista.pantalla === "auditoria" ? <PantallaAuditoria cliente={cliente} /> : null}
      </main>
    </>
  );
}
