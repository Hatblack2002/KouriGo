import { describe, expect, it } from "vitest";
import {
  explicarTransicionInvalida,
  esTransicionValida,
  TRANSICIONES_POR_ACTOR,
  type Actor,
} from "../src/transiciones.js";

const ACTORES = Object.keys(TRANSICIONES_POR_ACTOR) as Actor[];

describe("transiciones de pedidos", () => {
  it("el cliente puede confirmar y cancelar sus solicitudes", () => {
    expect(esTransicionValida("draft", "pending", "cliente")).toBe(true);
    expect(esTransicionValida("draft", "cancelled", "cliente")).toBe(true);
    expect(esTransicionValida("pending", "cancelled", "cliente")).toBe(true);
    expect(esTransicionValida("offered", "cancelled", "cliente")).toBe(true);
  });

  it("el cliente no puede marcar un pedido como entregado ni asignarlo", () => {
    expect(esTransicionValida("pending", "in_transit", "cliente")).toBe(false);
    expect(esTransicionValida("in_transit", "delivered", "cliente")).toBe(false);
    expect(esTransicionValida("pending", "offered", "cliente")).toBe(false);
  });

  it("el repartidor recorre el ciclo operativo completo", () => {
    expect(esTransicionValida("offered", "accepted", "repartidor")).toBe(true);
    expect(esTransicionValida("accepted", "at_pickup", "repartidor")).toBe(true);
    expect(esTransicionValida("at_pickup", "picked_up", "repartidor")).toBe(true);
    expect(esTransicionValida("picked_up", "in_transit", "repartidor")).toBe(true);
    expect(esTransicionValida("in_transit", "delivered", "repartidor")).toBe(true);
    expect(esTransicionValida("in_transit", "issue", "repartidor")).toBe(true);
  });

  it("el repartidor no puede aceptar un pedido no ofrecido", () => {
    expect(esTransicionValida("draft", "accepted", "repartidor")).toBe(false);
    expect(esTransicionValida("pending", "accepted", "repartidor")).toBe(false);
  });

  it("el administrador puede resolver incidencias y cancelar con justificación", () => {
    expect(esTransicionValida("issue", "pending", "administrador")).toBe(true);
    expect(esTransicionValida("issue", "delivered", "administrador")).toBe(true);
    expect(esTransicionValida("issue", "cancelled", "administrador")).toBe(true);
    expect(esTransicionValida("in_transit", "cancelled", "administrador")).toBe(true);
    expect(esTransicionValida("pending", "offered", "administrador")).toBe(true);
  });

  it("ningún actor puede reabrir un pedido en estado final", () => {
    for (const actor of ACTORES) {
      expect(esTransicionValida("delivered", "pending", actor), `delivered->pending por ${actor}`).toBe(
        false,
      );
      expect(esTransicionValida("cancelled", "pending", actor), `cancelled->pending por ${actor}`).toBe(
        false,
      );
    }
  });

  it("el sistema solo ofrece y devuelve pedidos a la cola", () => {
    expect(esTransicionValida("pending", "offered", "sistema")).toBe(true);
    expect(esTransicionValida("offered", "pending", "sistema")).toBe(true);
    expect(esTransicionValida("pending", "cancelled", "sistema")).toBe(false);
  });

  it("no permite transiciones al mismo estado", () => {
    for (const actor of ACTORES) {
      expect(esTransicionValida("pending", "pending", actor), `pending->pending por ${actor}`).toBe(
        false,
      );
    }
  });

  it("explica el motivo de una transición inválida", () => {
    const motivo = explicarTransicionInvalida("pending", "in_transit", "cliente");
    expect(motivo).toContain("pending");
    expect(motivo).toContain("in_transit");
    expect(motivo).toContain("cliente");
  });
});
