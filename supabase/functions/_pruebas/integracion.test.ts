/**
 * Pruebas de integración de las Edge Functions contra el proyecto REAL de
 * Supabase (workflow "Supabase (proyecto real)"). Sin secretos se omiten:
 * el job de CI normal ejecuta solo las unitarias.
 *
 * Nada es simulado: se crean usuarios reales por la Admin API con
 * credenciales únicas, se inician sesiones reales por password grant, se
 * sube una evidencia real al bucket privado, se invocan los manejadores
 * (el mismo `procesar` que sirve Deno.serve en producción) y los efectos
 * se comprueban en las tablas reales. La limpieza final elimina usuarios,
 * filas y objetos: NO deja fixtures en el proyecto.
 * Ver docs/decisions/ADR-0005-edge-functions.md.
 */
import type { Entorno } from "../_shared/config.ts";
import { rest } from "../_shared/rest.ts";
import { procesar as procesarDespacho } from "../despachar-pedido/index.ts";
import { procesar as procesarDecision } from "../decision-verificacion/index.ts";
import { procesar as procesarDocumento } from "../documento-firmado/index.ts";
import { procesar as procesarTransicion } from "../transicion-pedido/index.ts";
import { afirmar } from "./afirmar.ts";

const urlBruta = (Deno.env.get("SUPABASE_URL") ?? "").trim();
const anonBruta = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const servicioBruta = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const entornoCompleto =
  urlBruta.length > 0 && anonBruta.length > 0 && servicioBruta.length > 0;

type Manejador = (req: Request) => Promise<Response>;

function entornoPrueba(): Entorno {
  return {
    url: urlBruta.replace(/\/+$/, ""),
    anonKey: anonBruta,
    serviceKey: servicioBruta,
  };
}

/**
 * Reintenta una operación de red ante fallos transitorios (DNS, conexión).
 * Solo la llamada: las respuestas no exitosas se evalúan fuera del reintento.
 */
async function conReintentos<T>(
  operacion: () => Promise<T>,
  descripcion: string,
): Promise<T> {
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
  const causa = ultimoError instanceof Error && ultimoError.cause
    ? ` (causa: ${String(ultimoError.cause)})`
    : "";
  throw new Error(`${descripcion} falló tras 5 intentos: ${String(ultimoError)}${causa}`);
}

async function crearUsuario(
  ent: Entorno,
  email: string,
  password: string,
): Promise<string> {
  const respuesta = await conReintentos(
    () =>
      fetch(`${ent.url}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          "apikey": ent.serviceKey,
          "Authorization": `Bearer ${ent.serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, email_confirm: true }),
      }),
    `crear usuario ${email}`,
  );
  const texto = await respuesta.text();
  afirmar(respuesta.ok, `crear usuario ${email} -> ${respuesta.status}: ${texto}`);
  const datos = JSON.parse(texto) as { id?: string };
  afirmar(typeof datos.id === "string", `crear usuario ${email} devolvió un id`);
  return datos.id as string;
}

async function iniciarSesion(
  ent: Entorno,
  email: string,
  password: string,
): Promise<string> {
  const respuesta = await conReintentos(
    () =>
      fetch(`${ent.url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "apikey": ent.anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      }),
    `iniciar sesión ${email}`,
  );
  const texto = await respuesta.text();
  afirmar(respuesta.ok, `iniciar sesión ${email} -> ${respuesta.status}: ${texto}`);
  const datos = JSON.parse(texto) as { access_token?: string };
  afirmar(typeof datos.access_token === "string", "la sesión devolvió un token");
  return datos.access_token as string;
}

async function eliminarRuta(
  ent: Entorno,
  metodo: "DELETE",
  ruta: string,
): Promise<string | null> {
  try {
    const respuesta = await conReintentos(
      () =>
        fetch(`${ent.url}${ruta}`, {
          method: metodo,
          headers: {
            "apikey": ent.serviceKey,
            "Authorization": `Bearer ${ent.serviceKey}`,
          },
        }),
      `limpieza ${metodo} ${ruta}`,
    );
    if (!respuesta.ok) {
      return `${metodo} ${ruta} -> ${respuesta.status}: ${await respuesta.text()}`;
    }
    return null;
  } catch (error) {
    return `${metodo} ${ruta} -> ${String(error)}`;
  }
}

function llamadaFuncion(
  procesar: Manejador,
  nombre: string,
  jwt: string,
  cuerpo: Record<string, unknown>,
): Promise<Response> {
  return procesar(
    new Request(`http://kourigo.local/${nombre}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Authorization": `Bearer ${jwt}`,
      },
      body: JSON.stringify(cuerpo),
    }),
  );
}

async function jsonDe(
  respuesta: Response,
): Promise<{ estado: number; cuerpo: unknown }> {
  const texto = await respuesta.text();
  let cuerpo: unknown = null;
  if (texto.length > 0) {
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      cuerpo = texto;
    }
  }
  return { estado: respuesta.status, cuerpo };
}

function mensajeError(cuerpo: unknown): string {
  if (cuerpo !== null && typeof cuerpo === "object" && "error" in cuerpo) {
    return String((cuerpo as { error: unknown }).error);
  }
  return JSON.stringify(cuerpo);
}

Deno.test({
  name: "las Edge Functions operan contra el proyecto real (flujo completo)",
  ignore: !entornoCompleto,
  fn: async () => {
    const ent = entornoPrueba();
    const uniq = crypto.randomUUID().slice(0, 8);
    const password = `Kg-${uniq}-Etapa3!`;
    let idAdmin: string | null = null;
    let idCliente: string | null = null;
    let idRepartidor: string | null = null;
    let pedidoId: string | null = null;
    let objetoSubido = false;
    let falloPrincipal: unknown = null;

    try {
      idAdmin = await crearUsuario(ent, `admin-${uniq}@kourigo-ci.test`, password);
      idCliente = await crearUsuario(ent, `cliente-${uniq}@kourigo-ci.test`, password);
      idRepartidor = await crearUsuario(
        ent,
        `repartidor-${uniq}@kourigo-ci.test`,
        password,
      );
      const jwtAdmin = await iniciarSesion(ent, `admin-${uniq}@kourigo-ci.test`, password);
      const jwtCliente = await iniciarSesion(
        ent,
        `cliente-${uniq}@kourigo-ci.test`,
        password,
      );
      const jwtRepartidor = await iniciarSesion(
        ent,
        `repartidor-${uniq}@kourigo-ci.test`,
        password,
      );

      // Roles y perfiles de los usuarios de prueba (service_role).
      await rest(ent, "POST", "/rest/v1/user_roles", {
        user_id: idAdmin,
        role: "admin",
      }, { servicio: true });
      await rest(ent, "POST", "/rest/v1/user_roles", {
        user_id: idCliente,
        role: "customer",
      }, { servicio: true });
      await rest(ent, "POST", "/rest/v1/user_roles", {
        user_id: idRepartidor,
        role: "courier",
      }, { servicio: true });
      await rest(ent, "POST", "/rest/v1/courier_profiles", {
        user_id: idRepartidor,
        account_active: true,
      }, { servicio: true });

      // El cliente crea su pedido borrador por la vía normal (RLS propia).
      const pedidos = await rest<{ id: string }[]>(
        ent,
        "POST",
        "/rest/v1/orders",
        {
          client_id: idCliente,
          order_type: "delivery",
          pickup_address_text: "Calle de prueba 1, Puerto Principe",
          dropoff_address_text: "Avenida de prueba 2, Puerto Principe",
          currency: "HTG",
          service_fee_amount: 15000,
        },
        { jwt: jwtCliente },
      );
      afirmar(Array.isArray(pedidos) && pedidos.length === 1, "el cliente creó su pedido");
      pedidoId = pedidos[0].id;

      // transicion-pedido: el cliente confirma su solicitud.
      const confirmacion = await jsonDe(await llamadaFuncion(
        procesarTransicion,
        "transicion-pedido",
        jwtCliente,
        { pedido_id: pedidoId, estado_destino: "pending" },
      ));
      afirmar(confirmacion.estado === 200, `cliente confirma: ${JSON.stringify(confirmacion)}`);

      // transicion-pedido: un repartidor sin asignación no participa.
      const ajeno = await jsonDe(await llamadaFuncion(
        procesarTransicion,
        "transicion-pedido",
        jwtRepartidor,
        { pedido_id: pedidoId, estado_destino: "at_pickup" },
      ));
      afirmar(
        ajeno.estado === 403 || ajeno.estado === 404,
        `repartidor sin asignación rechazado: ${JSON.stringify(ajeno)}`,
      );

      // transicion-pedido: par no permitido para el cliente.
      const parInvalido = await jsonDe(await llamadaFuncion(
        procesarTransicion,
        "transicion-pedido",
        jwtCliente,
        { pedido_id: pedidoId, estado_destino: "offered" },
      ));
      afirmar(
        parInvalido.estado === 422,
        `par inválido para el cliente: ${JSON.stringify(parInvalido)}`,
      );

      // Expediente del repartidor con un documento real en el bucket privado.
      const casos = await rest<{ id: string }[]>(
        ent,
        "POST",
        "/rest/v1/courier_verification_cases",
        { courier_user_id: idRepartidor },
        { servicio: true },
      );
      afirmar(Array.isArray(casos) && casos.length === 1, "expediente creado");
      const casoId = casos[0].id;
      const rutaObjeto = `${idRepartidor}/documento-${uniq}.txt`;
      const subida = await conReintentos(
        () =>
          fetch(
            `${ent.url}/storage/v1/object/courier-identity-private/${rutaObjeto}`,
            {
              method: "POST",
              headers: {
                "apikey": ent.serviceKey,
                "Authorization": `Bearer ${ent.serviceKey}`,
                "Content-Type": "text/plain",
              },
              body: "evidencia de prueba de integracion",
            },
          ),
        "subida al bucket privado",
      );
      afirmar(subida.ok, `subida al bucket privado -> ${subida.status}: ${await subida.text()}`);
      objetoSubido = true;
      const documentos = await rest<{ id: string }[]>(
        ent,
        "POST",
        "/rest/v1/courier_verification_documents",
        {
          case_id: casoId,
          courier_user_id: idRepartidor,
          document_type: "national_id_front",
          storage_bucket: "courier-identity-private",
          storage_path: rutaObjeto,
        },
        { servicio: true },
      );
      afirmar(
        Array.isArray(documentos) && documentos.length === 1,
        "documento registrado en el expediente",
      );
      const documentoId = documentos[0].id;

      // El candidato presenta su expediente por la vía normal (RLS propia).
      const presentacion = await rest<{ status: string }[]>(
        ent,
        "PATCH",
        `/rest/v1/courier_verification_cases?id=eq.${casoId}&select=status`,
        { status: "submitted" },
        { jwt: jwtRepartidor },
      );
      afirmar(
        presentacion.length === 1 && presentacion[0].status === "submitted",
        "el candidato presentó su expediente",
      );

      // decision-verificacion: iniciar la revisión.
      const revision = await jsonDe(await llamadaFuncion(
        procesarDecision,
        "decision-verificacion",
        jwtAdmin,
        { caso_id: casoId, decision: "iniciar_revision" },
      ));
      afirmar(
        revision.estado === 200,
        `iniciar revisión: ${JSON.stringify(revision)}`,
      );

      // decision-verificacion: aprobar sin motivo se rechaza.
      const sinMotivo = await jsonDe(await llamadaFuncion(
        procesarDecision,
        "decision-verificacion",
        jwtAdmin,
        { caso_id: casoId, decision: "aprobar", metodo: "documental" },
      ));
      afirmar(
        sinMotivo.estado === 422 &&
          mensajeError(sinMotivo.cuerpo).includes("motivo"),
        `aprobar sin motivo: ${JSON.stringify(sinMotivo)}`,
      );

      // decision-verificacion: aprobar con motivo y método.
      const aprobacion = await jsonDe(await llamadaFuncion(
        procesarDecision,
        "decision-verificacion",
        jwtAdmin,
        {
          caso_id: casoId,
          decision: "aprobar",
          motivo: "Documentos consistentes con la identidad declarada.",
          metodo: "documental",
        },
      ));
      afirmar(
        aprobacion.estado === 200,
        `aprobar expediente: ${JSON.stringify(aprobacion)}`,
      );
      const perfil = await rest<{ verification_status: string }[]>(
        ent,
        "GET",
        `/rest/v1/courier_profiles?user_id=eq.${idRepartidor}&select=verification_status`,
        null,
        { servicio: true },
      );
      afirmar(
        perfil.length === 1 && perfil[0].verification_status === "approved",
        "la aprobación se proyectó en courier_profiles",
      );

      // documento-firmado: el administrador obtiene y usa la URL firmada.
      const firma = await jsonDe(await llamadaFuncion(
        procesarDocumento,
        "documento-firmado",
        jwtAdmin,
        { documento_id: documentoId },
      ));
      afirmar(firma.estado === 200, `firmar documento: ${JSON.stringify(firma)}`);
      const urlFirmada = (firma.cuerpo as { url_firmada: string }).url_firmada;
      const descarga = await fetch(urlFirmada, {
        headers: { "apikey": ent.anonKey },
      });
      afirmar(
        descarga.ok && (await descarga.text()).includes("evidencia de prueba"),
        `la URL firmada sirve el contenido -> ${descarga.status}`,
      );

      // documento-firmado: un repartidor no emite URL firmadas.
      const firmaAjena = await jsonDe(await llamadaFuncion(
        procesarDocumento,
        "documento-firmado",
        jwtRepartidor,
        { documento_id: documentoId },
      ));
      afirmar(
        firmaAjena.estado === 403,
        `repartidor sin firma: ${JSON.stringify(firmaAjena)}`,
      );

      // despachar-pedido: un repartidor no despacha.
      const despachoAjeno = await jsonDe(await llamadaFuncion(
        procesarDespacho,
        "despachar-pedido",
        jwtRepartidor,
        { pedido_id: pedidoId, repartidor_id: idRepartidor },
      ));
      afirmar(
        despachoAjeno.estado === 403,
        `repartidor sin despacho: ${JSON.stringify(despachoAjeno)}`,
      );

      // despachar-pedido: el administrador despacha de forma atómica.
      const despacho = await jsonDe(await llamadaFuncion(
        procesarDespacho,
        "despachar-pedido",
        jwtAdmin,
        { pedido_id: pedidoId, repartidor_id: idRepartidor },
      ));
      afirmar(
        despacho.estado === 200,
        `despacho del administrador: ${JSON.stringify(despacho)}`,
      );
      const pedidosTras = await rest<{ status: string }[]>(
        ent,
        "GET",
        `/rest/v1/orders?id=eq.${pedidoId}&select=status`,
        null,
        { servicio: true },
      );
      afirmar(
        pedidosTras.length === 1 && pedidosTras[0].status === "offered",
        "el pedido quedó offered tras el despacho",
      );
      const auditorias = await rest<{ action: string }[]>(
        ent,
        "GET",
        `/rest/v1/audit_logs?resource_id=eq.${pedidoId}&select=action`,
        null,
        { servicio: true },
      );
      afirmar(
        auditorias.some((a) => a.action === "despacho_pedido"),
        "audit_logs registra el despacho",
      );
      const eventos = await rest<{ event_type: string }[]>(
        ent,
        "GET",
        `/rest/v1/order_events?order_id=eq.${pedidoId}&select=event_type`,
        null,
        { servicio: true },
      );
      afirmar(
        eventos.some((e) => e.event_type === "despacho_administrativo"),
        "order_events registra el despacho administrativo",
      );

      // transicion-pedido: el repartidor aprobado acepta la oferta.
      const aceptacion = await jsonDe(await llamadaFuncion(
        procesarTransicion,
        "transicion-pedido",
        jwtRepartidor,
        { pedido_id: pedidoId, estado_destino: "accepted" },
      ));
      afirmar(
        aceptacion.estado === 200,
        `repartidor acepta la oferta: ${JSON.stringify(aceptacion)}`,
      );

      // despachar-pedido: un pedido ya despachado no admite otra oferta.
      const repetido = await jsonDe(await llamadaFuncion(
        procesarDespacho,
        "despachar-pedido",
        jwtAdmin,
        { pedido_id: pedidoId, repartidor_id: idRepartidor },
      ));
      afirmar(
        repetido.estado === 400 || repetido.estado === 422,
        `re-despacho rechazado: ${JSON.stringify(repetido)}`,
      );
    } catch (error) {
      falloPrincipal = error;
      throw error;
    } finally {
      const fallos: (string | null)[] = [];
      if (idAdmin !== null || idCliente !== null || idRepartidor !== null) {
        const ids = [idAdmin, idCliente, idRepartidor]
          .filter((id) => id !== null)
          .map((id) => `"${id}"`)
          .join(",");
        fallos.push(await eliminarRuta(
          ent,
          "DELETE",
          `/rest/v1/audit_logs?actor_id=in.(${ids})`,
        ));
      }
      if (idRepartidor !== null) {
        fallos.push(await eliminarRuta(
          ent,
          "DELETE",
          `/rest/v1/courier_verification_cases?courier_user_id=eq.${idRepartidor}`,
        ));
      }
      if (pedidoId !== null) {
        fallos.push(await eliminarRuta(
          ent,
          "DELETE",
          `/rest/v1/orders?id=eq.${pedidoId}`,
        ));
      }
      if (objetoSubido) {
        fallos.push(await eliminarRuta(
          ent,
          "DELETE",
          `/storage/v1/object/courier-identity-private/${idRepartidor}/documento-${uniq}.txt`,
        ));
      }
      for (const id of [idAdmin, idCliente, idRepartidor]) {
        if (id !== null) {
          fallos.push(await eliminarRuta(
            ent,
            "DELETE",
            `/auth/v1/admin/users/${id}`,
          ));
        }
      }
      const fallosReales = fallos.filter(
        (fallo): fallo is string => fallo !== null,
      );
      if (falloPrincipal !== null) {
        for (const fallo of fallosReales) {
          console.error("[limpieza]", fallo);
        }
      } else {
        afirmar(
          fallosReales.length === 0,
          `la limpieza no dejó residuos: ${fallosReales.join(" | ")}`,
        );
      }
    }
  },
});
