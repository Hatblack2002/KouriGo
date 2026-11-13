/**
 * Pruebas unitarias del adaptador de almacenamiento de sesión en memoria.
 * Solo guarda/recupera la cadena de sesión: ninguna operación del backend
 * se simula aquí.
 */
import { describe, expect, it } from "vitest";
import { almacenMemoria } from "../src/almacen-memoria.js";

describe("almacenMemoria", () => {
  it("guarda y recupera una cadena", async () => {
    const almacen = almacenMemoria();
    await almacen.setItem("sb-xx-auth-token", "contenido-de-sesion");
    expect(await almacen.getItem("sb-xx-auth-token")).toBe("contenido-de-sesion");
  });

  it("devuelve null para claves inexistentes", async () => {
    const almacen = almacenMemoria();
    expect(await almacen.getItem("inexistente")).toBeNull();
  });

  it("elimina y sobrescribe valores", async () => {
    const almacen = almacenMemoria();
    await almacen.setItem("k", "a");
    await almacen.setItem("k", "b");
    expect(await almacen.getItem("k")).toBe("b");
    await almacen.removeItem("k");
    expect(await almacen.getItem("k")).toBeNull();
  });
});
