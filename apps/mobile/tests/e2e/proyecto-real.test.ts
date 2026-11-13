/**
 * Prueba E2E de la app móvil contra el proyecto REAL de Supabase (workflow
 * «App móvil (Expo)», con secretos). Sin secretos se omite: el job de CI
 * normal ejecuta solo las unitarias.
 *
 * Nada es simulado: se crean usuarios reales por la Admin API, se inician
 * sesiones reales con el mismo servicio de autenticación que usa la app,
 * los pedidos se crean por PostgREST bajo RLS y las transiciones pasan por
 * la Edge Function real `transicion-pedido` desplegada en el runtime. La
 * limpieza final elimina usuarios y filas: NO deja residuos en el proyecto
 * y la prueba falla si los deja. Patrón de ADR-0005 (Etapa 3).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cerrarSesion,
  crearClienteApp,
  guardarPerfil,
  iniciarSesion,
  registrarCliente,
  sesionActual,
  type SesionActiva,
} from "../../src/auth";
import { almacenMemoria } from "../../src/almacen-memoria";
import type { ConfiguracionPublica } from "../../src/configuracion";
import {
  crearPedidoBorrador,
  listarPedidos,
  obtenerEventos,
  obtenerItems,
  obtenerPedido,
  transicionarPedido,
  type FilaEvento,
  type FilaItem,
  type FilaPedido,
} from "../../src/pedidos";
import type { SupabaseClient } from "@supabase/supabase-js";

const env = process.env as unknown as Record<string, string | undefined>;
const urlProyecto = (env.SUPABASE_URL ?? "").trim();
const claveAnon = (env.SUPABASE_ANON_KEY ?? "").trim();
const claveServicio = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const entornoCompleto = urlProyecto.length > 0 && claveAnon.length > 0 && claveServicio.length > 0;

const config: ConfiguracionPublica = {
  supabaseUrl: urlProyecto.replace(/\/+$/, ""),
  supabaseAnonKey: claveAnon,
};

/** Reintenta llamadas de red ante fallos transitorios (patrón ADR-0005). */
async function conReintentos<T>(operacion: () => Promise<T>, descripcion: string): Promise<T> {
  let ultimoError: unknown = null;
  for (let intento = 1; intento <= 5; intento++) {
    try {
      return await operacion();
    } catch (error) {
      ultimoError = error;
      if (intento < 5) {
        await new Promise((resolver) => setTimeout(resolver, 3000 * intento));
      }
    }
  }
  throw new Error(`${descripcion} falló tras 5 intentos: ${String(ultimoError)}`);
}

interface CabecerasServicio {
  readonly apikey: string;
  readonly Authorization: string;
}

function cabecerasServicio(): CabecerasServicio {
  return {
    apikey: claveServicio,
    Authorization: `Bearer ${claveServicio}`,
  };
}

async function crearUsuario(correo: string, password: string): Promise<string> {
  const respuesta = await conReintentos(
    () =>
      fetch(`${config.supabaseUrl}/auth/v1/admin/users`, {
        method: "POST",
        headers: { ...cabecerasServicio(), "Content-Type": "application/json" },
        body: JSON.stringify({ email: correo, password, email_confirm: true }),
      }),
    `crear usuario ${correo}`,
  );
  const texto = await respuesta.text();
  expect(respuesta.ok, `crear usuario ${correo} -> ${respuesta.status}: ${texto}`).toBe(true);
  const datos = JSON.parse(texto) as { id?: string };
  expect(typeof datos.id).toBe("string");
  return datos.id as string;
}

async function confirmarCorreo(idUsuario: string): Promise<void> {
  const respuesta = await conReintentos(
    () =>
      fetch(`${config.supabaseUrl}/auth/v1/admin/users/${idUsuario}`, {
        method: "PUT",
        headers: { ...cabecerasServicio(), "Content-Type": "application/json" },
        body: JSON.stringify({ email_confirm: true }),
      }),
    `confirmar correo ${idUsuario}`,
  );
  expect(respuesta.ok, `confirmar correo -> ${respuesta.status}`).toBe(true);
}

async function eliminarUsuario(idUsuario: string): Promise<string | null> {
  try {
    const respuesta = await conReintentos(
      () =>
        fetch(`${config.supabaseUrl}/auth/v1/admin/users/${idUsuario}`, {
          method: "DELETE",
          headers: cabecerasServicio(),
        }),
      `eliminar usuario ${idUsuario}`,
    );
    if (!respuesta.ok) {
      return `DELETE usuario ${idUsuario} -> ${respuesta.status}: ${await respuesta.text()}`;
    }
    return null;
  } catch (error) {
    return `DELETE usuario ${idUsuario} -> ${String(error)}`;
  }
}

async function eliminarFilas(tabla: string, filtro: string): Promise<string | null> {
  try {
    const respuesta = await conReintentos(
      () =>
        fetch(`${config.supabaseUrl}/rest/v1/${tabla}?${filtro}`, {
          method: "DELETE",
          headers: { ...cabecerasServicio(), Prefer: "return=minimal" },
        }),
      `eliminar filas ${tabla}`,
    );
    if (!respuesta.ok) {
      return `DELETE ${tabla} -> ${respuesta.status}: ${await respuesta.text()}`;
    }
    return null;
  } catch (error) {
    return `DELETE ${tabla} -> ${String(error)}`;
  }
}

async function contarFilas(tabla: string, filtro: string): Promise<number> {
  const respuesta = await conReintentos(
    () =>
      fetch(`${config.supabaseUrl}/rest/v1/${tabla}?${filtro}&select=*`, {
        headers: cabecerasServicio(),
      }),
    `contar ${tabla}`,
  );
  const texto = await respuesta.text();
  expect(respuesta.ok, `GET ${tabla} -> ${respuesta.status}: ${texto}`).toBe(true);
  const filas = JSON.parse(texto) as unknown[];
  return filas.length;
}

describe.skipIf(!entornoCompleto)("App móvil contra el proyecto real de Supabase", () => {
  const sufijo = crypto.randomUUID().slice(0, 8);
  const password = `Kg-${sufijo}-Etapa4!`;
  const correoA = `cliente-a-${sufijo}@kourigo-e2e.test`;
  const correoB = `cliente-b-${sufijo}@kourigo-e2e.test`;
  // El registro público valida el dominio del correo (la Admin API no):
  // example.com está reservado por IANA para documentación y pruebas.
  const correoC = `cliente-c-${sufijo}@example.com`;

  let idA: string | null = null;
  let idB: string | null = null;
  let idC: string | null = null;
  let pedidoId: string | null = null;
  const fallosLimpieza: string[] = [];

  beforeAll(async () => {
    idA = await crearUsuario(correoA, password);
    idB = await crearUsuario(correoB, password);
  });

  afterAll(async () => {
    const ids = [idA, idB, idC].filter((id): id is string => id !== null);
    if (ids.length > 0) {
      // Red de seguridad: cualquier pedido creado por los usuarios de prueba
      // (los pedidos no se eliminan en cascada al borrar el usuario).
      const errorPorCliente = await eliminarFilas("orders", `client_id=in.(${ids.join(",")})`);
      if (errorPorCliente !== null) {
        fallosLimpieza.push(errorPorCliente);
      }
    }
    if (pedidoId !== null) {
      const errorFilas = await eliminarFilas("orders", `id=eq.${pedidoId}`);
      if (errorFilas !== null) {
        fallosLimpieza.push(errorFilas);
      }
    }
    for (const id of [idA, idB, idC]) {
      if (id !== null) {
        const errorUsuario = await eliminarUsuario(id);
        if (errorUsuario !== null) {
          fallosLimpieza.push(errorUsuario);
        }
      }
    }
    expect(fallosLimpieza, `la limpieza falló: ${fallosLimpieza.join("; ")}`).toEqual([]);
  });

  it(
    "autenticación real y creación de pedidos de punta a punta",
    { timeout: 300_000 },
    async () => {
      // --- Sesión real del cliente A con el servicio de la app ---
      const clienteA: SupabaseClient = crearClienteApp(config, almacenMemoria());
      const entradaA = await iniciarSesion(clienteA, correoA, password);
      expect(entradaA.tipo).toBe("ok");
      if (entradaA.tipo !== "ok") {
        throw new Error("la sesión de A no se estableció");
      }
      const sesionA: SesionActiva = entradaA.sesion;
      expect(sesionA.usuarioId).toBe(idA);

      const restaurada = await sesionActual(clienteA);
      expect(restaurada?.usuarioId).toBe(idA);

      // --- Perfil propio (RLS: perfiles_insertar_propio) ---
      expect(await guardarPerfil(clienteA, idA as string, "Cliente Prueba A")).toBeNull();

      // --- Creación del pedido en borrador (PostgREST + RLS reales) ---
      const creado = await crearPedidoBorrador(clienteA, {
        tipo: "delivery",
        recogidaTexto: "Rue Geffrard 12, Port-au-Prince",
        destinoTexto: "Avenue Christophe 5, Port-au-Prince",
        comercioTexto: null,
        notas: "Prueba E2E de la Etapa 4",
        moneda: "HTG",
        tarifaServicio: 50000,
        items: [{ descripcion: "Colis de prueba", cantidad: 1, precioEstimado: 150000 }],
      });
      expect(creado.tipo).toBe("ok");
      if (creado.tipo !== "ok") {
        throw new Error(`crearPedidoBorrador falló: ${creado.mensaje}`);
      }
      const pedido: FilaPedido = creado.datos;
      pedidoId = pedido.id;
      expect(pedido.status).toBe("draft");
      expect(pedido.currency).toBe("HTG");
      expect(pedido.service_fee_amount).toBe(50000);
      expect(pedido.client_id).toBe(idA);

      const resultadoItems = await obtenerItems(clienteA, pedido.id);
      expect(resultadoItems.tipo).toBe("ok");
      if (resultadoItems.tipo !== "ok") {
        throw new Error(`obtenerItems falló: ${resultadoItems.mensaje}`);
      }
      const items: readonly FilaItem[] = resultadoItems.datos;
      expect(items.length).toBe(1);
      expect(items[0]?.description).toBe("Colis de prueba");
      expect(items[0]?.quantity).toBe(1);

      // --- Aislamiento: el cliente B no ve el pedido de A (RLS) ---
      const clienteB: SupabaseClient = crearClienteApp(config, almacenMemoria());
      const entradaB = await iniciarSesion(clienteB, correoB, password);
      expect(entradaB.tipo).toBe("ok");
      const listaB = await listarPedidos(clienteB);
      expect(listaB.tipo).toBe("ok");
      if (listaB.tipo === "ok") {
        expect(listaB.datos.some((p) => p.id === pedido.id)).toBe(false);
      }
      const pedidoVistoPorB = await obtenerPedido(clienteB, pedido.id);
      expect(pedidoVistoPorB.tipo).toBe("ok");
      if (pedidoVistoPorB.tipo === "ok") {
        expect(pedidoVistoPorB.datos).toBeNull();
      }
      const itemsVistosPorB = await obtenerItems(clienteB, pedido.id);
      expect(itemsVistosPorB.tipo).toBe("ok");
      if (itemsVistosPorB.tipo === "ok") {
        expect(itemsVistosPorB.datos.length).toBe(0);
      }

      // --- Confirmación del pedido vía la Edge Function real ---
      const confirmado = await transicionarPedido(config, clienteA, pedido.id, "pending");
      expect(confirmado.tipo).toBe("ok");
      if (confirmado.tipo !== "ok") {
        throw new Error(`transicion a pending falló: ${confirmado.mensaje}`);
      }
      expect(confirmado.datos.de).toBe("draft");
      expect(confirmado.datos.a).toBe("pending");
      expect(confirmado.datos.actor).toBe("cliente");
      const trasConfirmar = await obtenerPedido(clienteA, pedido.id);
      if (trasConfirmar.tipo === "ok" && trasConfirmar.datos !== null) {
        expect(trasConfirmar.datos.status).toBe("pending");
      } else {
        throw new Error("el pedido desapareció tras confirmar");
      }

      // --- Evento registrado por el trigger SQL ---
      const eventos = await obtenerEventos(clienteA, pedido.id);
      expect(eventos.tipo).toBe("ok");
      if (eventos.tipo === "ok") {
        const eventosFila: FilaEvento[] = eventos.datos;
        const eventoConfirmacion = eventosFila.find(
          (e) => e.from_status === "draft" && e.to_status === "pending",
        );
        expect(eventoConfirmacion).toBeDefined();
        expect(eventoConfirmacion?.event_type).toBe("status_changed");
        expect((eventoConfirmacion?.metadata as { actor_rol?: string }).actor_rol).toBe("cliente");
      }

      // --- Rechazos reales del backend ---
      const invalida = await transicionarPedido(config, clienteA, pedido.id, "delivered");
      expect(invalida.tipo).toBe("error");
      const ajena = await transicionarPedido(config, clienteB, pedido.id, "pending");
      expect(ajena.tipo).toBe("error");

      // --- Cancelación real (pending -> cancelled) ---
      const cancelado = await transicionarPedido(config, clienteA, pedido.id, "cancelled");
      expect(cancelado.tipo).toBe("ok");
      if (cancelado.tipo === "ok") {
        expect(cancelado.datos.a).toBe("cancelled");
      }

      // --- Historial del cliente A ---
      const listaA = await listarPedidos(clienteA);
      expect(listaA.tipo).toBe("ok");
      if (listaA.tipo === "ok") {
        const elPedido = listaA.datos.find((p) => p.id === pedido.id);
        expect(elPedido?.status).toBe("cancelled");
      }

      // --- Sin sesión, el backend rechaza la creación (401) ---
      const clienteAnonimo: SupabaseClient = crearClienteApp(config, almacenMemoria());
      const sinSesion = await crearPedidoBorrador(clienteAnonimo, {
        tipo: "delivery",
        recogidaTexto: "Rue Fantin 3, Port-au-Prince",
        destinoTexto: "Boulevard Toussaint 8, Port-au-Prince",
        comercioTexto: null,
        notas: null,
        moneda: "HTG",
        tarifaServicio: 10000,
        items: [{ descripcion: "Colis anonimo", cantidad: 1 }],
      });
      expect(sinSesion.tipo).toBe("error");

      await cerrarSesion(clienteB);
      expect((await sesionActual(clienteB)) === null).toBe(true);
    },
  );

  it(
    "registro público real como cliente (signUp + confirmación si el proyecto la exige)",
    { timeout: 300_000 },
    async () => {
      const clienteC: SupabaseClient = crearClienteApp(config, almacenMemoria());
      const registro = await registrarCliente(clienteC, correoC, password, "Cliente Prueba C");

      if (registro.tipo === "error" && registro.clave === "limite_intentos") {
        // El plan gratuito de Supabase limita los correos de confirmación por
        // hora. Nada se simula: se registra el error real del backend y el
        // resto del flujo (sesión + perfil propio por RLS) se prueba con un
        // usuario real creado por la Admin API. La vía signUp se reevalúa
        // cuando el fundador ajuste la confirmación de correo (decisión
        // pendiente del proyecto).
        console.log(
          `NOTA E2E: signUp devolvió el error real del backend: ${registro.mensaje}. ` +
            "El plan gratuito limita los correos por hora; se continúa con un usuario real de la Admin API.",
        );
        idC = await crearUsuario(correoC, password);
        const entrada = await iniciarSesion(clienteC, correoC, password);
        expect(
          entrada.tipo,
          `iniciarSesion de C: ${entrada.tipo === "error" ? entrada.mensaje : ""}`,
        ).toBe("ok");
        expect(await guardarPerfil(clienteC, idC, "Cliente Prueba C")).toBeNull();
      } else {
        expect(
          ["ok", "pendiente_confirmacion"],
          `registrarCliente: ${registro.tipo === "error" ? registro.mensaje : "sin detalle"}`,
        ).toContain(registro.tipo);
        if (registro.tipo === "pendiente_confirmacion") {
          idC = registro.usuarioId;
          await confirmarCorreo(idC);
          const entrada = await iniciarSesion(clienteC, correoC, password);
          expect(
            entrada.tipo,
            `iniciarSesion de C: ${entrada.tipo === "error" ? entrada.mensaje : ""}`,
          ).toBe("ok");
          if (entrada.tipo !== "ok") {
            throw new Error("la sesión de C no se estableció tras confirmar");
          }
          expect(await guardarPerfil(clienteC, registro.usuarioId, "Cliente Prueba C")).toBeNull();
        } else {
          const usuarioActual = await sesionActual(clienteC);
          expect(usuarioActual?.usuarioId).toBeDefined();
          idC = usuarioActual?.usuarioId ?? null;
        }
      }

      // El perfil de C queda visible para sí mismo en el backend.
      if (idC !== null) {
        expect(await contarFilas("profiles", `id=eq.${idC}`)).toBe(1);
      }
    },
  );
});
