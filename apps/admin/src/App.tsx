/**
 * Consola administrativa web de KouriGo (Etapa 5, README secciones 2.3 y
 * 14): aplicación separada, con acceso restringido y protección REAL en el
 * backend — el permiso administrativo se comprueba contra `user_roles` bajo
 * RLS al abrir la sesión y las operaciones privilegiadas pasan por las
 * Edge Functions del runtime (ADR-0005). Un no administrador queda
 * bloqueado aunque conozca las URLs (README criterio de aceptación). Todos
 * los textos visibles salen del diccionario de idiomas (README sección 9).
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
import { SelectorIdioma, useIdioma } from "./idiomas";
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
  const { t } = useIdioma();
  // La configuración faltante es un error de despliegue, no de sesión:
  // se muestra de forma explícita en lugar de una pantalla en blanco. El
  // mensaje técnico se conserva (lo exige la prueba de configuración);
  // la explicación traducida se añade al renderizar.
  const configuracion = useMemo(() => {
    try {
      return { tipo: "ok" as const, valor: leerConfiguracionPublica() };
    } catch (error) {
      return {
        tipo: "error" as const,
        mensaje:
          error instanceof ConfiguracionFaltanteError ? error.message : "",
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
        setErrorAcceso(rol.clave !== null ? t(rol.clave) : rol.mensaje);
        setAcceso("sin-permisos");
        return;
      }
      setSesion(sesionActiva);
      setAcceso(rol.administrador ? "administrador" : "sin-permisos");
      if (rol.administrador) {
        setNombre(await leerNombrePropio(cliente));
      }
    },
    [cliente, t],
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
        setErrorAcceso(restaurada.clave !== null ? t(restaurada.clave) : restaurada.mensaje);
        setAcceso("sin-sesion");
      } else {
        setAcceso("sin-sesion");
      }
    })();
    return () => {
      montado = false;
    };
  }, [cliente, comprobarRol, t]);

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
        <Tarjeta titulo={t("config_titulo")}>
          <MensajeError
            mensaje={
              configuracion.tipo === "error" && configuracion.mensaje.length > 0
                ? configuracion.mensaje
                : t("config_cliente_error")
            }
          />
          <p className="nota">{t("config_nota")}</p>
        </Tarjeta>
        <div className="selector-centrado">
          <SelectorIdioma />
        </div>
      </div>
    );
  }

  if (acceso === "comprobando") {
    return (
      <div className="pantalla-centrada">
        <p className="cargando">{t("acceso_comprobando")}</p>
      </div>
    );
  }

  if (acceso === "sin-sesion") {
    return <PantallaLogin cliente={cliente} alIniciar={(s) => void alIniciar(s)} />;
  }

  if (acceso === "sin-permisos" || sesion === null) {
    return (
      <div className="pantalla-centrada">
        <Tarjeta titulo={t("acceso_denegado")}>
          <MensajeError
            mensaje={errorAcceso ?? t("acceso_denegado_detalle")}
          />
          <p className="nota">{t("acceso_denegado_nota")}</p>
          <button className="accion" onClick={() => void salir()}>
            {t("cerrar_sesion")}
          </button>
        </Tarjeta>
        <div className="selector-centrado">
          <SelectorIdioma />
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="barra">
        <span className="marca">{t("marca")}</span>
        <nav>
          <button
            className={vista.pantalla === "resumen" ? "activo" : ""}
            onClick={() => setVista({ pantalla: "resumen" })}
          >
            {t("nav_resumen")}
          </button>
          <button
            className={vista.pantalla === "pedidos" || vista.pantalla === "pedido" ? "activo" : ""}
            onClick={() => setVista({ pantalla: "pedidos" })}
          >
            {t("nav_pedidos")}
          </button>
          <button
            className={
              vista.pantalla === "repartidores" || vista.pantalla === "expediente" ? "activo" : ""
            }
            onClick={() => setVista({ pantalla: "repartidores" })}
          >
            {t("nav_repartidores")}
          </button>
          <button
            className={vista.pantalla === "auditoria" ? "activo" : ""}
            onClick={() => setVista({ pantalla: "auditoria" })}
          >
            {t("nav_auditoria")}
          </button>
        </nav>
        <span className="usuario">
          <SelectorIdioma />
          <span>{nombre ?? sesion.correo}</span>
          <button onClick={() => void salir()}>{t("cerrar_sesion")}</button>
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
