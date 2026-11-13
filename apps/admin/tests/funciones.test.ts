/**
 * Pruebas unitarias de la interpretación de respuestas de Edge Functions
 * (sin red): JSON válido, JSON de error, texto plano y estados raros.
 */
import { describe, expect, it } from "vitest";
import { interpretarCuerpo, type RespuestaTransicion } from "../src/funciones";

describe("interpretarCuerpo", () => {
  it("acepta un 2xx con cuerpo JSON", () => {
    const texto = JSON.stringify({
      pedido_id: "abc",
      de: "pending",
      a: "offered",
      actor: "sistema",
    });
    const resultado = interpretarCuerpo<RespuestaTransicion>(200, texto);
    expect(resultado.ok).toBe(true);
    expect(resultado.datos).not.toBeNull();
    expect(resultado.datos?.actor).toBe("sistema");
    expect(resultado.mensajeError).toBeNull();
  });

  it("traduce el error JSON a su campo `error`", () => {
    const texto = JSON.stringify({ error: "La transición no está permitida." });
    const resultado = interpretarCuerpo(422, texto);
    expect(resultado.ok).toBe(false);
    expect(resultado.datos).toBeNull();
    expect(resultado.mensajeError).toBe("La transición no está permitida.");
  });

  it("usa el texto plano cuando el cuerpo no es JSON", () => {
    const resultado = interpretarCuerpo(500, "fallo interno");
    expect(resultado.ok).toBe(false);
    expect(resultado.mensajeError).toBe("fallo interno");
  });

  it("genera mensaje propio con cuerpo vacío", () => {
    const resultado = interpretarCuerpo(503, "");
    expect(resultado.ok).toBe(false);
    expect(resultado.mensajeError).toContain("503");
  });

  it("no trata un 2xx con cuerpo no-objeto como éxito", () => {
    const resultado = interpretarCuerpo(204, "");
    expect(resultado.ok).toBe(false);
  });
});
