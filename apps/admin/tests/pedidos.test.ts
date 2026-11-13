/**
 * Pruebas unitarias de la lógica de pedidos de la consola (sin red): el
 * agrupamiento de métricas y las transiciones disponibles para el
 * administrador, que deben coincidir EXACTAMENTE con la matriz de
 * @kourigo/domain (la misma que imponen el trigger SQL y la Edge Function).
 */
import { describe, expect, it } from "vitest";
import { agruparPorEstado, transicionesAdminDisponibles } from "../src/api/pedidos";

describe("agruparPorEstado", () => {
  it("cuenta por estado y calcula el total", () => {
    const conteos = agruparPorEstado([
      { status: "draft" },
      { status: "draft" },
      { status: "pending" },
      { status: "delivered" },
      { status: "issue" },
    ]);
    expect(conteos["__total"]).toBe(5);
    expect(conteos["draft"]).toBe(2);
    expect(conteos["pending"]).toBe(1);
    expect(conteos["delivered"]).toBe(1);
    expect(conteos["issue"]).toBe(1);
    expect(conteos["cancelled"]).toBeUndefined();
  });

  it("devuelve cero con una lista vacía", () => {
    const conteos = agruparPorEstado([]);
    expect(conteos["__total"]).toBe(0);
  });
});

describe("transicionesAdminDisponibles", () => {
  it("desde pending ofrece offered y cancelled, ninguna corrección", () => {
    const opciones = transicionesAdminDisponibles("pending");
    const destinos = opciones.map((o) => o.destino).sort();
    expect(destinos).toEqual(["cancelled", "offered"]);
    expect(opciones.every((o) => !o.correccion)).toBe(true);
  });

  it("desde offered permite offered->pending y offered->cancelled", () => {
    const destinos = transicionesAdminDisponibles("offered")
      .map((o) => o.destino)
      .sort();
    expect(destinos).toEqual(["cancelled", "pending"]);
  });

  it("las cancelaciones justificadas son correcciones con motivo", () => {
    const desdeAceptado = transicionesAdminDisponibles("accepted");
    const cancelar = desdeAceptado.find((o) => o.destino === "cancelled");
    expect(cancelar).toBeDefined();
    expect(cancelar?.correccion).toBe(true);
    const incidencia = desdeAceptado.find((o) => o.destino === "issue");
    expect(incidencia?.correccion).toBe(false);
  });

  it("desde issue ofrece las tres resoluciones, todas corrección", () => {
    const opciones = transicionesAdminDisponibles("issue");
    const destinos = opciones.map((o) => o.destino).sort();
    expect(destinos).toEqual(["cancelled", "delivered", "pending"]);
    expect(opciones.every((o) => o.correccion)).toBe(true);
  });

  it("los estados finales no ofrecen transiciones", () => {
    expect(transicionesAdminDisponibles("delivered")).toEqual([]);
    expect(transicionesAdminDisponibles("cancelled")).toEqual([]);
  });

  it("el repertorio completo desde estados operativos del repartidor", () => {
    expect(
      transicionesAdminDisponibles("in_transit")
        .map((o) => o.destino)
        .sort(),
    ).toEqual(["cancelled", "delivered", "issue"]);
    expect(
      transicionesAdminDisponibles("at_pickup")
        .map((o) => o.destino)
        .sort(),
    ).toEqual(["cancelled", "issue", "picked_up"]);
  });
});
