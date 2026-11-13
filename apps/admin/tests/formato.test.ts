/**
 * Pruebas unitarias del formato de importes y fechas de la consola.
 */
import { describe, expect, it } from "vitest";
import { formatearDinero, formatearFecha } from "../src/formato";

describe("formatearDinero", () => {
  it("muestra la unidad menor dividida entre 100", () => {
    expect(formatearDinero(1250, "HTG")).toBe("12.50 HTG");
    expect(formatearDinero(0, "USD")).toBe("0.00 USD");
    expect(formatearDinero(1, "HTG")).toBe("0.01 HTG");
  });

  it("mostró un guión ante montos imposibles en lugar de inventar", () => {
    expect(formatearDinero(null, "HTG")).toBe("— HTG");
    expect(formatearDinero(-5, "HTG")).toBe("— HTG");
    expect(formatearDinero(1.5, "HTG")).toBe("— HTG");
  });
});

describe("formatearFecha", () => {
  it("formatea una fecha ISO válida", () => {
    const texto = formatearFecha("2026-11-14T10:30:00Z");
    expect(texto).not.toBe("2026-11-14T10:30:00Z");
    expect(texto.length).toBeGreaterThan(8);
  });

  it("devuelve un guión para nulo", () => {
    expect(formatearFecha(null)).toBe("—");
    expect(formatearFecha("")).toBe("—");
  });

  it("devuelve el original si la cadena no es una fecha", () => {
    expect(formatearFecha("no-es-fecha")).toBe("no-es-fecha");
  });
});
