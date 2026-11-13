import { describe, expect, it } from "vitest";
import { calcularRepartoTarifaServicio, ComisionInvalidaError } from "../src/comision.js";

describe("reparto de la tarifa de servicio", () => {
  it("aplica el ejemplo ilustrativo del README: 100 con 60 % para el repartidor", () => {
    const reparto = calcularRepartoTarifaServicio(100, 60);
    expect(reparto.montoRepartidor).toBe(60);
    expect(reparto.montoPlataforma).toBe(40);
    expect(reparto.montoRepartidor + reparto.montoPlataforma).toBe(reparto.tarifaServicio);
  });

  it("redondea a favor del repartidor y ajusta la plataforma para que sume exacto", () => {
    const reparto = calcularRepartoTarifaServicio(101, 60);
    expect(reparto.montoRepartidor).toBe(61);
    expect(reparto.montoPlataforma).toBe(40);
    expect(reparto.montoRepartidor + reparto.montoPlataforma).toBe(101);
  });

  it("acepta 0 % y 100 % sin perder importe", () => {
    expect(calcularRepartoTarifaServicio(250, 0)).toMatchObject({
      montoRepartidor: 0,
      montoPlataforma: 250,
    });
    expect(calcularRepartoTarifaServicio(250, 100)).toMatchObject({
      montoRepartidor: 250,
      montoPlataforma: 0,
    });
  });

  it("mantiene el importe total en casos de redondeo variados", () => {
    for (const tarifa of [1, 7, 33, 99, 999, 15000, 1234567]) {
      for (const porcentaje of [0, 40, 60, 100]) {
        const reparto = calcularRepartoTarifaServicio(tarifa, porcentaje);
        expect(reparto.montoRepartidor + reparto.montoPlataforma).toBe(tarifa);
        expect(reparto.montoRepartidor).toBeGreaterThanOrEqual(0);
        expect(reparto.montoPlataforma).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("rechaza tarifas no enteras, negativas o porcentajes imposibles", () => {
    expect(() => calcularRepartoTarifaServicio(-1, 60)).toThrow(ComisionInvalidaError);
    expect(() => calcularRepartoTarifaServicio(10.5, 60)).toThrow(ComisionInvalidaError);
    expect(() => calcularRepartoTarifaServicio(100, -5)).toThrow(ComisionInvalidaError);
    expect(() => calcularRepartoTarifaServicio(100, 101)).toThrow(ComisionInvalidaError);
    expect(() => calcularRepartoTarifaServicio(Number.NaN, 60)).toThrow(ComisionInvalidaError);
  });
});
