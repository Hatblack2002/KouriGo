import { describe, expect, it } from "vitest";
import {
  ESTADOS_FINALES_PEDIDO,
  ESTADOS_PEDIDO,
  esEstadoFinal,
  esEstadoPedido,
} from "../src/estados-pedido.js";

describe("estados de pedido", () => {
  it("contiene los diez estados definidos en el README", () => {
    expect(ESTADOS_PEDIDO).toHaveLength(10);
    expect([...ESTADOS_PEDIDO]).toEqual([
      "draft",
      "pending",
      "offered",
      "accepted",
      "at_pickup",
      "picked_up",
      "in_transit",
      "delivered",
      "cancelled",
      "issue",
    ]);
  });

  it("valida estados conocidos y rechaza desconocidos", () => {
    expect(esEstadoPedido("in_transit")).toBe(true);
    expect(esEstadoPedido("entregado")).toBe(false);
    expect(esEstadoPedido(42)).toBe(false);
  });

  it("identifica los estados finales", () => {
    expect(ESTADOS_FINALES_PEDIDO).toEqual(["delivered", "cancelled"]);
    expect(esEstadoFinal("delivered")).toBe(true);
    expect(esEstadoFinal("cancelled")).toBe(true);
    expect(esEstadoFinal("in_transit")).toBe(false);
  });
});
