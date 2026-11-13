/**
 * Pruebas unitarias del cliente de Edge Functions (interpretación pura de
 * respuestas, sin red). El contrato de error es JSON con la clave `error`
 * (_shared/http.ts de las funciones).
 */
import { describe, expect, it } from "vitest";
import { interpretarCuerpo, type RespuestaTransicion } from "../src/funciones";

describe("interpretarCuerpo", () => {
  it("acepta 200 con el cuerpo de transición", () => {
    const resultado = interpretarCuerpo<RespuestaTransicion>(
      200,
      JSON.stringify({ pedido_id: "abc", de: "draft", a: "pending", actor: "cliente" }),
    );
    expect(resultado.ok).toBe(true);
    expect(resultado.datos).toEqual({
      pedido_id: "abc",
      de: "draft",
      a: "pending",
      actor: "cliente",
    });
    expect(resultado.mensajeError).toBeNull();
  });

  it("extrae el mensaje de error del contrato { error }", () => {
    const resultado = interpretarCuerpo(422, JSON.stringify({ error: "Transición no permitida" }));
    expect(resultado.ok).toBe(false);
    expect(resultado.datos).toBeNull();
    expect(resultado.mensajeError).toBe("Transición no permitida");
    expect(resultado.estado).toBe(422);
  });

  it("tolera cuerpos que no son JSON", () => {
    const resultado = interpretarCuerpo(502, "Bad Gateway");
    expect(resultado.ok).toBe(false);
    expect(resultado.mensajeError).toBe("Bad Gateway");
  });

  it("produce un mensaje genérico ante un cuerpo vacío", () => {
    const resultado = interpretarCuerpo(500, "");
    expect(resultado.ok).toBe(false);
    expect(resultado.mensajeError).toContain("500");
  });

  it("trata los 4xx/5xx con cuerpo JSON válido pero sin clave error", () => {
    const resultado = interpretarCuerpo(403, JSON.stringify({ detalle: "x" }));
    expect(resultado.ok).toBe(false);
    expect(resultado.mensajeError).toContain("403");
  });
});
