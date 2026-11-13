import { describe, expect, it } from "vitest";
import { validarCreacionPedido, type DatosCreacionPedido } from "../src/validacion-pedido.js";

function pedidoValido(): DatosCreacionPedido {
  return {
    tipo: "delivery",
    recogidaTexto: "Avenue Jean-Paul II, junto a la farmacia",
    destinoTexto: "Rue 12, Delmas, casa azul",
    items: [{ descripcion: "Sobre de documentos", cantidad: 1 }],
  };
}

describe("validación de creación de pedidos", () => {
  it("acepta un pedido de entrega completo", () => {
    expect(validarCreacionPedido(pedidoValido())).toEqual([]);
  });

  it("exige dirección de recogida y destino con contenido útil", () => {
    const datos = { ...pedidoValido(), recogidaTexto: "abc" };
    expect(validarCreacionPedido(datos)).toHaveLength(1);
    const sinDestino = { ...pedidoValido(), destinoTexto: "" };
    expect(validarCreacionPedido(sinDestino).join(" ")).toContain("destino");
  });

  it("valida coordenadas opcionales", () => {
    const datos = { ...pedidoValido(), recogidaLat: 95 };
    expect(validarCreacionPedido(datos)).toHaveLength(1);
    const ok = { ...pedidoValido(), recogidaLat: 18.54, recogidaLon: -72.34 };
    expect(validarCreacionPedido(ok)).toEqual([]);
  });

  it("exige presupuesto total en la compra asistida", () => {
    const datos = { ...pedidoValido(), tipo: "assisted_purchase" as const };
    const errores = validarCreacionPedido(datos);
    expect(errores.join(" ")).toContain("presupuesto");
    const conPresupuesto = {
      ...datos,
      presupuestoTotal: 150000,
      items: [{ descripcion: "Arroz, 2 libras", cantidad: 2 }],
    };
    expect(validarCreacionPedido(conPresupuesto)).toEqual([]);
  });

  it("rechaza artículos sin descripción o con cantidades absurdas", () => {
    const datos = { ...pedidoValido(), items: [{ descripcion: "", cantidad: 0 }] };
    expect(validarCreacionPedido(datos)).toHaveLength(2);
  });

  it("valida el teléfono de contacto cuando se proporciona", () => {
    const datos = { ...pedidoValido(), contactoTelefono: "abc" };
    expect(validarCreacionPedido(datos)).toHaveLength(1);
    const ok = { ...pedidoValido(), contactoTelefono: "+509 3712 0000" };
    expect(validarCreacionPedido(ok)).toEqual([]);
  });
});
