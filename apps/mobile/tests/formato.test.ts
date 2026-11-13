/**
 * Pruebas unitarias de formato de importes y fechas (README sección 9 y 11).
 */
import { describe, expect, it } from "vitest";
import { formatearDinero, formatearFecha } from "../src/formato.js";

describe("formatearDinero", () => {
  it("divide el importe entero (unidad mínima) entre 100", () => {
    expect(formatearDinero(1250, "HTG")).toBe("12.50 HTG");
    expect(formatearDinero(0, "USD")).toBe("0.00 USD");
    expect(formatearDinero(1, "HTG")).toBe("0.01 HTG");
  });

  it("no intenta formatear importes inválidos", () => {
    expect(formatearDinero(-5, "HTG")).toBe("— HTG");
    expect(formatearDinero(Number.NaN, "USD")).toBe("— USD");
    expect(formatearDinero(1.5, "HTG")).toBe("— HTG");
  });
});

describe("formatearFecha", () => {
  it("formatea una fecha ISO válida sin romperse", () => {
    const salida = formatearFecha("2026-11-13T10:30:00.000Z", "fr");
    expect(salida.length).toBeGreaterThan(0);
    expect(salida).not.toBe("2026-11-13T10:30:00.000Z");
  });

  it("devuelve el texto original si no es una fecha", () => {
    expect(formatearFecha("no-es-fecha", "ht")).toBe("no-es-fecha");
  });
});
