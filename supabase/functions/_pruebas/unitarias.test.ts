/**
 * Pruebas unitarias de las Edge Functions de la Etapa 3 (sin red y sin
 * secretos): matrices de dominio espejadas y utilidades HTTP.
 *
 * La consistencia contra el dominio de npm (`packages/domain`) la garantizan
 * las pruebas vitest y contra la base de datos las pruebas SQL de
 * database/tests/.
 */
import { afirmar, afirmarIgual } from "./afirmar.ts";
import { ErrorHttp } from "../_shared/config.ts";
import {
  DECISIONES_EXPEDIENTE,
  esDecisionExpediente,
  esEstadoPedido,
  esTransicionValida,
  ESTADOS_PEDIDO,
  explicarTransicionInvalida,
  parAdminExpedientePermitido,
  TRANSICIONES_POR_ACTOR,
} from "../_shared/dominio.ts";
import {
  exigirCadena,
  exigirUuid,
  leerCuerpoJson,
  respuestaError,
  respuestaJson,
} from "../_shared/http.ts";

Deno.test("la matriz de pedidos mantiene los pares por actor", () => {
  afirmarIgual(ESTADOS_PEDIDO.length, 10, "diez estados de pedido");
  afirmar(esTransicionValida("draft", "pending", "cliente"), "cliente confirma");
  afirmar(esTransicionValida("pending", "cancelled", "cliente"), "cliente cancela");
  afirmar(!esTransicionValida("pending", "offered", "cliente"), "cliente no despacha");
  afirmar(esTransicionValida("pending", "offered", "sistema"), "sistema despacha");
  afirmar(esTransicionValida("in_transit", "delivered", "repartidor"), "repartidor entrega");
  afirmar(!esTransicionValida("draft", "pending", "repartidor"), "repartidor no confirma");
  afirmar(esTransicionValida("issue", "pending", "administrador"), "admin reabre incidencia");
  afirmar(esTransicionValida("accepted", "cancelled", "administrador"), "admin cancela");
  afirmar(!esTransicionValida("accepted", "cancelled", "cliente"), "cliente no cancela aceptado");
});

Deno.test("la unión administrativa cubre todos los pares de los demás actores", () => {
  const paresAdmin = new Set(
    TRANSICIONES_POR_ACTOR.administrador.map((t) => `${t.de}->${t.a}`),
  );
  for (const actor of ["cliente", "repartidor", "sistema"] as const) {
    for (const transicion of TRANSICIONES_POR_ACTOR[actor]) {
      afirmar(
        paresAdmin.has(`${transicion.de}->${transicion.a}`),
        `el administrador debe poder ${actor}: ${transicion.de}->${transicion.a}`,
      );
    }
  }
  afirmarIgual(TRANSICIONES_POR_ACTOR.sistema.length, 2, "dos pares del sistema");
  afirmarIgual(TRANSICIONES_POR_ACTOR.cliente.length, 4, "cuatro pares del cliente");
  afirmarIgual(TRANSICIONES_POR_ACTOR.repartidor.length, 9, "nueve pares del repartidor");
});

Deno.test("los estados finales no admiten transiciones", () => {
  for (const final of ["delivered", "cancelled"] as const) {
    for (const destino of ESTADOS_PEDIDO) {
      for (const actor of ["cliente", "repartidor", "administrador", "sistema"] as const) {
        afirmar(
          !esTransicionValida(final, destino, actor),
          `ningún actor debe mover un pedido ${final} hacia ${destino}`,
        );
      }
    }
  }
  afirmar(!esEstadoPedido("entregado"), "los estados son los literales del esquema");
  afirmar(esEstadoPedido("at_pickup"), "at_pickup es un estado válido");
});

Deno.test("explicarTransicionInvalida nombra par y actor", () => {
  afirmarIgual(
    explicarTransicionInvalida("draft", "offered", "cliente"),
    "La transición de estado draft -> offered no está permitida para el rol cliente.",
    "mensaje esperado",
  );
});

Deno.test("las decisiones del expediente exigen motivo y método", () => {
  afirmarIgual(DECISIONES_EXPEDIENTE.aprobar.estado, "approved", "aprobar lleva a approved");
  afirmar(DECISIONES_EXPEDIENTE.aprobar.requiereMotivo, "aprobar exige motivo");
  afirmar(DECISIONES_EXPEDIENTE.aprobar.requiereMetodo, "aprobar exige método");
  afirmar(!DECISIONES_EXPEDIENTE.iniciar_revision.requiereMotivo, "iniciar no exige motivo");
  afirmar(
    !DECISIONES_EXPEDIENTE.iniciar_revision.requiereMetodo,
    "iniciar no exige método",
  );
  afirmar(DECISIONES_EXPEDIENTE.pedir_informacion.requiereMotivo, "pedir información exige motivo");
  afirmar(
    DECISIONES_EXPEDIENTE.programar_verificacion.requiereMetodo,
    "programar exige método",
  );
  afirmar(
    !DECISIONES_EXPEDIENTE.programar_verificacion.requiereMotivo,
    "programar no exige motivo",
  );
  afirmar(esDecisionExpediente("rechazar"), "rechazar es decisión válida");
  afirmar(!esDecisionExpediente("aprobar_ya"), "decisiones desconocidas se rechazan");
});

Deno.test("los pares administrativos del expediente espejan el trigger", () => {
  afirmar(parAdminExpedientePermitido("submitted", "under_review"), "iniciar revisión");
  afirmar(parAdminExpedientePermitido("under_review", "approved"), "aprobar");
  afirmar(parAdminExpedientePermitido("suspended", "under_review"), "reabrir suspensión");
  afirmar(parAdminExpedientePermitido("expired", "under_review"), "reabrir expiración");
  afirmar(!parAdminExpedientePermitido("draft", "submitted"), "presentar es del candidato");
  afirmar(!parAdminExpedientePermitido("rejected", "under_review"), "rechazado es historial");
  afirmar(!parAdminExpedientePermitido("submitted", "approved"), "aprobar exige revisión iniciada");
  afirmar(!parAdminExpedientePermitido("approved", "rejected"), "no se rechaza lo aprobado");
});

Deno.test("las utilidades HTTP validan cuerpo, UUID y cadenas", async () => {
  const req = new Request("https://kourigo.local/prueba", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pedido_id: "no-es-uuid", motivo: "  " }),
  });
  const cuerpo = await leerCuerpoJson(req);
  let error: unknown = null;
  try {
    exigirUuid(cuerpo, "pedido_id");
  } catch (e) {
    error = e;
  }
  afirmar(error instanceof ErrorHttp && error.estado === 400, "UUID inválido -> 400");
  error = null;
  try {
    exigirCadena(cuerpo, "motivo");
  } catch (e) {
    error = e;
  }
  afirmar(error instanceof ErrorHttp && error.estado === 400, "motivo vacío -> 400");

  const reqRoto = new Request("https://kourigo.local/prueba", {
    method: "POST",
    body: "esto no es json",
  });
  error = null;
  try {
    await leerCuerpoJson(reqRoto);
  } catch (e) {
    error = e;
  }
  afirmar(error instanceof ErrorHttp && error.estado === 400, "cuerpo inválido -> 400");
});

Deno.test("respuestaError traduce ErrorHttp y deja limpio lo inesperado", async () => {
  const propia = respuestaError(new ErrorHttp(403, "Se requiere administrador."));
  afirmarIgual(propia.status, 403, "estado del ErrorHttp");
  afirmarIgual(await propia.json(), { error: "Se requiere administrador." }, "cuerpo limpio");

  const generica = respuestaError(new Error("detalle interno"));
  afirmarIgual(generica.status, 500, "error inesperado -> 500");
  const cuerpo = (await generica.json()) as { error: string };
  afirmar(!cuerpo.error.includes("detalle interno"), "no se exponen detalles internos");

  const ok = respuestaJson(200, { listo: true });
  afirmarIgual(ok.status, 200, "respuestaJson conserva el estado");
  afirmar(
    (ok.headers.get("Content-Type") ?? "").includes("application/json"),
    "Content-Type JSON",
  );
});
