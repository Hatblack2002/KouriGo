/**
 * Prueba E2E de la consola administrativa contra el proyecto REAL de
 * Supabase (workflow «Consola administrativa (web)», con secretos). Sin
 * secretos se omite: el job de CI normal ejecuta solo las unitarias.
 *
 * Nada es simulado: la prueba conduce los MÓDULOS REALES de la consola
 * (auth, api/pedidos, api/expediente, api/auditoria, api/perfiles,
 * funciones) sobre usuarios reales creados por la Admin API y contra las
 * Edge Functions REALES desplegadas en el runtime de Supabase. La limpieza
 * final elimina usuarios, filas y objetos: NO deja residuos y falla si los
 * deja. Patrón de las etapas 3 y 4.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { repartidorOperativo } from "@kourigo/domain";
import {
  cerrarSesion,
  crearClienteAdmin,
  iniciarSesion,
  leerNombrePropio,
  leerRolAdministrador,
  type SesionActiva,
} from "../../src/auth";
import { listarAuditoria } from "../../src/api/auditoria";
import {
  decidirExpediente,
  listarCasos,
  obtenerCaso,
  pedirUrlFirmada,
  decisionesAdminDisponibles,
  revisarDocumento,
} from "../../src/api/expediente";
import {
  despacharPedido,
  listarPedidos,
  obtenerAsignaciones,
  obtenerEventos,
  obtenerPedido,
  transicionarPedido,
} from "../../src/api/pedidos";
import { listarPerfiles, listarRepartidoresOperativos } from "../../src/api/perfiles";
import type { ConfiguracionPublica } from "../../src/configuracion";

const env = process.env as unknown as Record<string, string | undefined>;
const urlProyecto = (env.SUPABASE_URL ?? "").trim();
const claveAnon = (env.SUPABASE_ANON_KEY ?? "").trim();
const claveServicio = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const entornoCompleto = urlProyecto.length > 0 && claveAnon.length > 0 && claveServicio.length > 0;

const d = entornoCompleto ? describe : describe.skip;

const configuracion: ConfiguracionPublica = {
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

interface Identidades {
  adminId: string;
  clienteId: string;
  repartidorId: string;
  casoId: string;
  documentoId: string;
  rutaObjeto: string;
  pedidoId: string;
}

function idsVacios(): Identidades {
  return {
    adminId: "",
    clienteId: "",
    repartidorId: "",
    casoId: "",
    documentoId: "",
    rutaObjeto: "",
    pedidoId: "",
  };
}

const prueba: {
  clientes: {
    admin: SupabaseClient;
    cliente: SupabaseClient;
    repartidor: SupabaseClient;
    servicio: SupabaseClient;
  };
  sesiones: {
    admin: SesionActiva | null;
    cliente: SesionActiva | null;
    repartidor: SesionActiva | null;
  };
  ids: Identidades;
  objetoSubido: boolean;
} = {
  clientes: {} as {
    admin: SupabaseClient;
    cliente: SupabaseClient;
    repartidor: SupabaseClient;
    servicio: SupabaseClient;
  },
  sesiones: { admin: null, cliente: null, repartidor: null },
  ids: idsVacios(),
  objetoSubido: false,
};

async function crearUsuarioServicio(
  servicio: SupabaseClient,
  correo: string,
  contrasena: string,
): Promise<string> {
  const { data, error } = await conReintentos(
    () =>
      servicio.auth.admin.createUser({
        email: correo,
        password: contrasena,
        email_confirm: true,
      }),
    `crear usuario ${correo}`,
  );
  expect(error, `crear usuario ${correo}: ${String(error)}`).toBeNull();
  expect(data.user?.id, `crear usuario ${correo} devolvió un id`).toBeTruthy();
  return data.user?.id as string;
}

d("E2E consola administrativa contra el proyecto real", () => {
  const uniq = crypto.randomUUID().slice(0, 8);
  const contrasena = `Kg-${uniq}-Etapa5!`;
  const correos = {
    admin: `admin-e5-${uniq}@kourigo-ci.test`,
    cliente: `cliente-e5-${uniq}@kourigo-ci.test`,
    repartidor: `repartidor-e5-${uniq}@kourigo-ci.test`,
  };

  beforeAll(async () => {
    const servicio = createClient(configuracion.supabaseUrl, claveServicio, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    prueba.clientes.servicio = servicio;
    prueba.clientes.admin = crearClienteAdmin(configuracion);
    prueba.clientes.cliente = crearClienteAdmin(configuracion);
    prueba.clientes.repartidor = crearClienteAdmin(configuracion);

    // Usuarios reales por la Admin API (vía única de creación de cuentas
    // administrativas; la consola NO tiene registro público).
    prueba.ids.adminId = await crearUsuarioServicio(servicio, correos.admin, contrasena);
    prueba.ids.clienteId = await crearUsuarioServicio(servicio, correos.cliente, contrasena);
    prueba.ids.repartidorId = await crearUsuarioServicio(servicio, correos.repartidor, contrasena);

    // Roles y perfiles (service_role, igual que el aprovisionamiento real).
    const { error: eRolAdmin } = await servicio
      .from("user_roles")
      .insert({ user_id: prueba.ids.adminId, role: "admin", status: "active" });
    expect(eRolAdmin, `rol admin: ${String(eRolAdmin)}`).toBeNull();
    const { error: eRolCliente } = await servicio
      .from("user_roles")
      .insert({ user_id: prueba.ids.clienteId, role: "customer", status: "active" });
    expect(eRolCliente, `rol customer: ${String(eRolCliente)}`).toBeNull();
    const { error: eRolCourier } = await servicio
      .from("user_roles")
      .insert({ user_id: prueba.ids.repartidorId, role: "courier", status: "active" });
    expect(eRolCourier, `rol courier: ${String(eRolCourier)}`).toBeNull();
    const { error: ePerfilCourier } = await servicio
      .from("courier_profiles")
      .insert({ user_id: prueba.ids.repartidorId, account_active: true });
    expect(ePerfilCourier, `courier_profiles: ${String(ePerfilCourier)}`).toBeNull();
    const { error: ePerfiles } = await servicio.from("profiles").insert([
      { id: prueba.ids.adminId, full_name: "Administradora de Prueba" },
      { id: prueba.ids.clienteId, full_name: "Cliente de Prueba" },
      { id: prueba.ids.repartidorId, full_name: "Repartidor de Prueba" },
    ]);
    expect(ePerfiles, `profiles: ${String(ePerfiles)}`).toBeNull();

    // Expediente en borrador + documento real en el bucket privado.
    const { data: casos, error: eCaso } = await servicio
      .from("courier_verification_cases")
      .insert({ courier_user_id: prueba.ids.repartidorId })
      .select("id");
    expect(eCaso, `crear caso: ${String(eCaso)}`).toBeNull();
    prueba.ids.casoId = (casos as { id: string }[])[0]?.id ?? "";
    prueba.ids.rutaObjeto = `${prueba.ids.repartidorId}/documento-${uniq}.txt`;
    const subida = await conReintentos(
      () =>
        fetch(
          `${configuracion.supabaseUrl}/storage/v1/object/courier-identity-private/${prueba.ids.rutaObjeto}`,
          {
            method: "POST",
            headers: {
              apikey: claveServicio,
              Authorization: `Bearer ${claveServicio}`,
              "Content-Type": "text/plain",
            },
            body: "evidencia real de la consola administrativa (etapa 5)",
          },
        ),
      "subida al bucket privado",
    );
    expect(subida.ok, `subida al bucket privado -> ${subida.status}`).toBe(true);
    prueba.objetoSubido = true;
    const { data: documentos, error: eDoc } = await servicio
      .from("courier_verification_documents")
      .insert({
        case_id: prueba.ids.casoId,
        courier_user_id: prueba.ids.repartidorId,
        document_type: "national_id_front",
        storage_bucket: "courier-identity-private",
        storage_path: prueba.ids.rutaObjeto,
      })
      .select("id");
    expect(eDoc, `registrar documento: ${String(eDoc)}`).toBeNull();
    prueba.ids.documentoId = (documentos as { id: string }[])[0]?.id ?? "";

    // El candidato presenta su expediente por la vía normal (RLS propia).
    const sesionCourier = await iniciarSesion(
      prueba.clientes.repartidor,
      correos.repartidor,
      contrasena,
    );
    expect(sesionCourier.tipo, "sesión real del repartidor").toBe("ok");
    prueba.sesiones.repartidor = sesionCourier.tipo === "ok" ? sesionCourier.sesion : null;
    const presentacion = await prueba.clientes.repartidor
      .from("courier_verification_cases")
      .update({ status: "submitted" })
      .eq("id", prueba.ids.casoId)
      .select("status");
    expect(presentacion.error, `presentar expediente: ${String(presentacion.error)}`).toBeNull();
    expect((presentacion.data as { status: string }[])[0]?.status).toBe("submitted");

    // Sesiones reales por el mismo servicio de autenticación que usa la app.
    const sesionAdmin = await iniciarSesion(prueba.clientes.admin, correos.admin, contrasena);
    expect(sesionAdmin.tipo, "sesión real del administrador").toBe("ok");
    prueba.sesiones.admin = sesionAdmin.tipo === "ok" ? sesionAdmin.sesion : null;
    const sesionCliente = await iniciarSesion(prueba.clientes.cliente, correos.cliente, contrasena);
    expect(sesionCliente.tipo, "sesión real del cliente").toBe("ok");
    prueba.sesiones.cliente = sesionCliente.tipo === "ok" ? sesionCliente.sesion : null;
  });

  it("la consola autentica al administrador y comprueba su rol real", async () => {
    expect(prueba.sesiones.admin).not.toBeNull();
    const rol = await leerRolAdministrador(prueba.clientes.admin);
    expect(rol.tipo).toBe("ok");
    expect(rol.tipo === "ok" && rol.administrador).toBe(true);
    const nombre = await leerNombrePropio(prueba.clientes.admin);
    expect(nombre).toBe("Administradora de Prueba");
  });

  it("una sesión sin rol administrativo queda bloqueada y no puede escalar privilegios", async () => {
    expect(prueba.sesiones.cliente).not.toBeNull();
    const rol = await leerRolAdministrador(prueba.clientes.cliente);
    expect(rol.tipo).toBe("ok");
    expect(rol.tipo === "ok" && rol.administrador).toBe(false);

    // La auditoría queda vacía por RLS para un no administrador.
    const auditoria = await listarAuditoria(prueba.clientes.cliente, "todas");
    expect(auditoria.error).toBeNull();
    expect(auditoria.filas).toEqual([]);

    // El intento de autoasignarse el rol admin lo rechaza la política RLS.
    const escalada = await prueba.clientes.cliente
      .from("user_roles")
      .insert({
        user_id: prueba.ids.clienteId,
        role: "admin",
        status: "active",
      })
      .select("id");
    expect(escalada.error).not.toBeNull();
  });

  it("el administrador lee la auditoría real y los perfiles bajo RLS", async () => {
    const auditoria = await listarAuditoria(prueba.clientes.admin, "todas");
    expect(auditoria.error).toBeNull();
    expect(Array.isArray(auditoria.filas)).toBe(true);

    const perfiles = await listarPerfiles(prueba.clientes.admin);
    expect(perfiles.error).toBeNull();
    const ids = perfiles.filas.map((p) => p.id);
    expect(ids).toContain(prueba.ids.repartidorId);
    expect(ids).toContain(prueba.ids.clienteId);
    const courier = perfiles.filas.find((p) => p.id === prueba.ids.repartidorId);
    expect(courier?.full_name).toBe("Repartidor de Prueba");
  });

  it("el administrador revisa y aprueba el expediente real", async () => {
    const sesion = prueba.sesiones.admin;
    expect(sesion).not.toBeNull();

    const casos = await listarCasos(prueba.clientes.admin, "todos");
    expect(casos.error).toBeNull();
    expect(casos.filas.some((c) => c.id === prueba.ids.casoId)).toBe(true);

    const desdeSubmitted = decisionesAdminDisponibles("submitted");
    expect(desdeSubmitted.map((o) => o.decision)).toEqual(["iniciar_revision"]);

    const revision = await decidirExpediente(configuracion, sesion!.accessToken, {
      casoId: prueba.ids.casoId,
      decision: "iniciar_revision",
      motivo: null,
      metodo: null,
    });
    expect(revision.ok, `iniciar revisión: ${revision.mensajeError}`).toBe(true);

    const casoRevisado = await obtenerCaso(prueba.clientes.admin, prueba.ids.casoId);
    expect(casoRevisado.caso?.status).toBe("under_review");

    const docRechazo = await revisarDocumento(configuracion, sesion!.accessToken, {
      casoId: prueba.ids.casoId,
      documentoId: prueba.ids.documentoId,
      estadoRevision: "accepted",
      notas: "Documento legible y consistente.",
    });
    expect(docRechazo.ok, `revisión del documento: ${docRechazo.mensajeError}`).toBe(true);

    // Aprobar sin motivo lo rechaza la función real.
    const sinMotivo = await decidirExpediente(configuracion, sesion!.accessToken, {
      casoId: prueba.ids.casoId,
      decision: "aprobar",
      motivo: null,
      metodo: "documental",
    });
    expect(sinMotivo.ok).toBe(false);
    expect(sinMotivo.mensajeError).toContain("motivo");

    const aprobacion = await decidirExpediente(configuracion, sesion!.accessToken, {
      casoId: prueba.ids.casoId,
      decision: "aprobar",
      motivo: "Documentos consistentes con la identidad declarada.",
      metodo: "documental",
    });
    expect(aprobacion.ok, `aprobar: ${aprobacion.mensajeError}`).toBe(true);

    const { data: perfil } = await prueba.clientes.servicio
      .from("courier_profiles")
      .select("verification_status,account_active")
      .eq("user_id", prueba.ids.repartidorId);
    const fila = (perfil as { verification_status: string; account_active: boolean }[])[0];
    expect(fila?.verification_status).toBe("approved");
    expect(repartidorOperativo("approved", fila?.account_active === true)).toBe(true);

    const operativos = await listarRepartidoresOperativos(prueba.clientes.admin);
    expect(operativos.error).toBeNull();
    expect(operativos.filas.some((c) => c.user_id === prueba.ids.repartidorId)).toBe(true);
  });

  it("el cliente crea un pedido real bajo RLS y la consola lo confirma", async () => {
    const sesionCliente = prueba.sesiones.cliente;
    const sesion = prueba.sesiones.admin;
    expect(sesionCliente).not.toBeNull();
    expect(sesion).not.toBeNull();

    const { data: pedidos, error } = await prueba.clientes.cliente
      .from("orders")
      .insert({
        client_id: prueba.ids.clienteId,
        order_type: "delivery",
        pickup_address_text: "Calle de la consola 5, Puerto Principe",
        dropoff_address_text: "Avenida de la consola 6, Puerto Principe",
        currency: "HTG",
        service_fee_amount: 15000,
      })
      .select("id");
    expect(error, `crear pedido: ${String(error)}`).toBeNull();
    prueba.ids.pedidoId = (pedidos as { id: string }[])[0]?.id ?? "";

    const { error: eItem } = await prueba.clientes.cliente.from("order_items").insert({
      order_id: prueba.ids.pedidoId,
      description: "Paquete de arroz de 5 kg",
      quantity: 2,
      estimated_price_amount: 4000,
    });
    expect(eItem, `crear artículo: ${String(eItem)}`).toBeNull();

    const confirmacion = await transicionarPedido(
      configuracion,
      sesionCliente!.accessToken,
      prueba.ids.pedidoId,
      "pending",
      null,
    );
    expect(confirmacion.ok, `confirmar pedido: ${confirmacion.mensajeError}`).toBe(true);
    expect(confirmacion.datos?.actor).toBe("cliente");

    // La consola del administrador ve el pedido confirmado.
    const pendientes = await listarPedidos(prueba.clientes.admin, "pending");
    expect(pendientes.error).toBeNull();
    expect(pendientes.filas.some((p) => p.id === prueba.ids.pedidoId)).toBe(true);
    const detalle = await obtenerPedido(prueba.clientes.admin, prueba.ids.pedidoId);
    expect(detalle.pedido?.status).toBe("pending");
    expect(detalle.pedido?.currency).toBe("HTG");
  });

  it("el administrador despacha el pedido y el repartidor acepta", async () => {
    const sesion = prueba.sesiones.admin;
    const sesionCourier = prueba.sesiones.repartidor;
    expect(sesion).not.toBeNull();
    expect(sesionCourier).not.toBeNull();

    const despacho = await despacharPedido(
      configuracion,
      sesion!.accessToken,
      prueba.ids.pedidoId,
      prueba.ids.repartidorId,
    );
    expect(despacho.ok, `despacho: ${despacho.mensajeError}`).toBe(true);
    expect(despacho.datos?.estado).toBe("offered");

    const asignaciones = await obtenerAsignaciones(prueba.clientes.admin, prueba.ids.pedidoId);
    expect(asignaciones.error).toBeNull();
    expect(asignaciones.filas).toHaveLength(1);
    expect(asignaciones.filas[0]?.status).toBe("offered");
    expect(asignaciones.filas[0]?.courier_user_id).toBe(prueba.ids.repartidorId);

    const aceptacion = await transicionarPedido(
      configuracion,
      sesionCourier!.accessToken,
      prueba.ids.pedidoId,
      "accepted",
      null,
    );
    expect(aceptacion.ok, `aceptar oferta: ${aceptacion.mensajeError}`).toBe(true);
    expect(aceptacion.datos?.actor).toBe("repartidor");
  });

  it("la corrección administrativa exige motivo y deja auditoría", async () => {
    const sesion = prueba.sesiones.admin;
    expect(sesion).not.toBeNull();

    // Sin motivo la función real rechaza la corrección (README sección 12).
    const sinMotivo = await transicionarPedido(
      configuracion,
      sesion!.accessToken,
      prueba.ids.pedidoId,
      "cancelled",
      null,
    );
    expect(sinMotivo.ok).toBe(false);
    expect(sinMotivo.mensajeError).toContain("motivo");

    const conMotivo = await transicionarPedido(
      configuracion,
      sesion!.accessToken,
      prueba.ids.pedidoId,
      "cancelled",
      "Cliente canceló por error de dirección; el repartidor lo confirmó.",
    );
    expect(conMotivo.ok, `corrección con motivo: ${conMotivo.mensajeError}`).toBe(true);
    expect(conMotivo.datos?.actor).toBe("administrador");
    expect(conMotivo.datos?.de).toBe("accepted");
    expect(conMotivo.datos?.a).toBe("cancelled");

    // La auditoría contiene la corrección con el motivo registrado.
    const auditoria = await listarAuditoria(prueba.clientes.admin, "transicion_administrativa");
    expect(auditoria.error).toBeNull();
    const registro = auditoria.filas.find((f) => f.resource_id === prueba.ids.pedidoId);
    expect(registro).toBeDefined();
    expect(registro?.metadata["motivo"]).toContain("error de dirección");

    // El historial de eventos del pedido registra la transición.
    const eventos = await obtenerEventos(prueba.clientes.admin, prueba.ids.pedidoId);
    expect(eventos.error).toBeNull();
    const cancelacion = eventos.filas.find(
      (e) => e.from_status === "accepted" && e.to_status === "cancelled",
    );
    expect(cancelacion).toBeDefined();
  });

  it("el administrador obtiene y usa una URL firmada real del documento privado", async () => {
    const sesion = prueba.sesiones.admin;
    expect(sesion).not.toBeNull();
    const firma = await pedirUrlFirmada(configuracion, sesion!.accessToken, prueba.ids.documentoId);
    expect(firma.ok, `firmar documento: ${firma.mensajeError}`).toBe(true);
    expect(firma.datos?.url_firmada).toContain("courier-identity-private");
    const descarga = await conReintentos(
      () =>
        fetch(firma.datos?.url_firmada ?? "", {
          headers: { apikey: claveAnon },
        }),
      "descarga con URL firmada",
    );
    expect(descarga.ok, `descarga firmada -> ${descarga.status}`).toBe(true);
    expect(await descarga.text()).toContain("evidencia real de la consola");
  });

  it("las funciones del runtime rechazan a quien no es administrador", async () => {
    const sesionCliente = prueba.sesiones.cliente;
    const sesionCourier = prueba.sesiones.repartidor;
    expect(sesionCliente).not.toBeNull();
    expect(sesionCourier).not.toBeNull();

    const despachoAjeno = await despacharPedido(
      configuracion,
      sesionCliente!.accessToken,
      prueba.ids.pedidoId,
      prueba.ids.repartidorId,
    );
    expect(despachoAjeno.ok).toBe(false);
    expect(despachoAjeno.estado).toBe(403);

    const decisionAjena = await decidirExpediente(configuracion, sesionCourier!.accessToken, {
      casoId: prueba.ids.casoId,
      decision: "iniciar_revision",
      motivo: null,
      metodo: null,
    });
    expect(decisionAjena.ok).toBe(false);
    expect(decisionAjena.estado).toBe(403);

    const firmaAjena = await pedirUrlFirmada(
      configuracion,
      sesionCliente!.accessToken,
      prueba.ids.documentoId,
    );
    expect(firmaAjena.ok).toBe(false);
    expect(firmaAjena.estado).toBe(403);
  });

  afterAll(async () => {
    // Limpieza SIN residuos: auditoría, expedientes, pedidos, objeto del
    // bucket privado y usuarios. La prueba falla si algo queda suelto.
    const fallos: string[] = [];
    const servicio = prueba.clientes.servicio;
    const ids = [prueba.ids.adminId, prueba.ids.clienteId, prueba.ids.repartidorId].filter(
      (id) => id.length > 0,
    );

    if (ids.length > 0) {
      const listaIn = `(${ids.map((id) => `"${id}"`).join(",")})`;
      const { error } = await servicio
        .from("audit_logs")
        .delete()
        .or(`actor_id.in.${listaIn},resource_id.in.${listaIn}`);
      if (error) {
        fallos.push(`audit_logs: ${error.message}`);
      }
    }
    if (prueba.ids.repartidorId.length > 0) {
      const { error } = await servicio
        .from("courier_verification_cases")
        .delete()
        .eq("courier_user_id", prueba.ids.repartidorId);
      if (error) {
        fallos.push(`casos: ${error.message}`);
      }
    }
    if (prueba.ids.pedidoId.length > 0) {
      const { error } = await servicio.from("orders").delete().eq("id", prueba.ids.pedidoId);
      if (error) {
        fallos.push(`pedidos: ${error.message}`);
      }
    }
    if (prueba.objetoSubido && prueba.ids.rutaObjeto.length > 0) {
      const respuesta = await conReintentos(
        () =>
          fetch(
            `${configuracion.supabaseUrl}/storage/v1/object/courier-identity-private/${prueba.ids.rutaObjeto}`,
            {
              method: "DELETE",
              headers: {
                apikey: claveServicio,
                Authorization: `Bearer ${claveServicio}`,
              },
            },
          ),
        "eliminar objeto del bucket",
      );
      if (!respuesta.ok) {
        fallos.push(`objeto storage: ${respuesta.status}`);
      }
    }
    for (const id of ids) {
      const { error } = await servicio.auth.admin.deleteUser(id);
      if (error) {
        fallos.push(`usuario ${id}: ${error.message}`);
      }
    }

    // Comprobación de residuos: nada de lo creado debe seguir existiendo.
    if (ids.length === 3) {
      const restosAuditoria = await servicio
        .from("audit_logs")
        .select("id")
        .or(`actor_id.in.(${ids.map((id) => `"${id}"`).join(",")})`);
      if ((restosAuditoria.data ?? []).length > 0) {
        fallos.push("quedaron entradas de auditoría");
      }
      const restosUsuarios = await servicio.auth.admin.listUsers({
        perPage: 200,
        page: 1,
      });
      if (restosUsuarios.error !== null) {
        fallos.push(`listUsers para residuos: ${restosUsuarios.error.message}`);
      } else {
        for (const usuario of restosUsuarios.data.users) {
          if (usuario.email !== null && Object.values(correos).includes(usuario.email)) {
            fallos.push(`quedó el usuario ${usuario.email}`);
          }
        }
      }
      if (prueba.ids.pedidoId.length > 0) {
        const restosPedidos = await servicio
          .from("orders")
          .select("id")
          .eq("id", prueba.ids.pedidoId);
        if ((restosPedidos.data ?? []).length > 0) {
          fallos.push("quedó el pedido de prueba");
        }
      }
      const restosCasos = await servicio
        .from("courier_verification_cases")
        .select("id")
        .eq("courier_user_id", prueba.ids.repartidorId);
      if ((restosCasos.data ?? []).length > 0) {
        fallos.push("quedaron casos de verificación");
      }
    }

    // Cerrar las sesiones reales al final (limpieza educada del proyecto).
    for (const cliente of [
      prueba.clientes.admin,
      prueba.clientes.cliente,
      prueba.clientes.repartidor,
    ]) {
      if (cliente !== undefined) {
        await cerrarSesion(cliente);
      }
    }

    expect(fallos, `la limpieza no dejó residuos: ${fallos.join(" | ")}`).toEqual([]);
  });
});
