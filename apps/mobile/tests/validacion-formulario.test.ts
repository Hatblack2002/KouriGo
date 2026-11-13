/**
 * Pruebas unitarias de la validación del formulario y de su consistencia
 * con las reglas compartidas de @kourigo/domain (las mismas que impone el
 * backend con CHECK y trigger SQL). Si la app valida bien pero el dominio
 * rechazaría, la prueba lo detecta: la app no envía datos que el backend
 * rechazaría.
 */
import { describe, expect, it } from "vitest";
import { validarCreacionPedido, type ArticuloPedido } from "@kourigo/domain";
import { validarFormularioPedido, type DatosFormularioPedido } from "../src/pedidos";

function datosValidos(): DatosFormularioPedido {
  return {
    tipo: "delivery",
    recogidaTexto: "Rue Geffrard 12, Port-au-Prince",
    destinoTexto: "Avenue Christophe 5, Port-au-Prince",
    comercioTexto: null,
    notas: null,
    moneda: "HTG",
    tarifaServicio: 500,
    items: [{ descripcion: "Colis de prueba", cantidad: 1 } as ArticuloPedido],
  };
}

function aDatosDominio(datos: DatosFormularioPedido) {
  return {
    tipo: datos.tipo,
    recogidaTexto: datos.recogidaTexto.trim(),
    destinoTexto: datos.destinoTexto.trim(),
    notas: datos.notas ?? undefined,
    items: datos.items,
    presupuestoTotal:
      datos.tipo === "assisted_purchase"
        ? datos.items.reduce((total, item) => total + (item.precioEstimado ?? 0) * item.cantidad, 0)
        : undefined,
  };
}

describe("validarFormularioPedido", () => {
  it("acepta un pedido de entrega válido", () => {
    expect(validarFormularioPedido(datosValidos())).toEqual([]);
  });

  it("acepta una compra asistida con comercio", () => {
    const datos = {
      ...datosValidos(),
      tipo: "assisted_purchase" as const,
      comercioTexto: "Delimart, Delmas",
      items: [{ descripcion: "Riz", cantidad: 2, precioEstimado: 15000 } as ArticuloPedido],
    };
    expect(validarFormularioPedido(datos)).toEqual([]);
  });

  it("exige comercio para la compra asistida", () => {
    const errores = validarFormularioPedido({ ...datosValidos(), tipo: "assisted_purchase" });
    expect(errores).toContain("err_comercio");
  });

  it("exige direcciones de 5 a 300 caracteres", () => {
    expect(validarFormularioPedido({ ...datosValidos(), recogidaTexto: "  " })).toContain(
      "err_recogida",
    );
    expect(validarFormularioPedido({ ...datosValidos(), destinoTexto: "abcd" })).toContain(
      "err_destino",
    );
  });

  it("exige un código de moneda de tres mayúsculas y una tarifa entera no negativa", () => {
    expect(validarFormularioPedido({ ...datosValidos(), moneda: "ht" })).toContain("err_moneda");
    expect(validarFormularioPedido({ ...datosValidos(), moneda: "HTGX" })).toContain("err_moneda");
    expect(validarFormularioPedido({ ...datosValidos(), tarifaServicio: -1 })).toContain(
      "err_tarifa",
    );
    expect(validarFormularioPedido({ ...datosValidos(), tarifaServicio: Number.NaN })).toContain(
      "err_tarifa",
    );
    expect(validarFormularioPedido({ ...datosValidos(), tarifaServicio: 12.5 })).toContain(
      "err_tarifa",
    );
  });

  it("exige al menos un artículo y cantidades entre 1 y 999", () => {
    expect(validarFormularioPedido({ ...datosValidos(), items: [] })).toContain("err_items_vacio");
    expect(
      validarFormularioPedido({
        ...datosValidos(),
        items: [{ descripcion: "X", cantidad: 1000 } as ArticuloPedido],
      }),
    ).toContain("err_item_cantidad");
  });

  it("no admite precios estimados negativos", () => {
    expect(
      validarFormularioPedido({
        ...datosValidos(),
        items: [{ descripcion: "X", cantidad: 1, precioEstimado: -2 } as ArticuloPedido],
      }),
    ).toContain("err_item_precio");
  });
});

describe("consistencia con @kourigo/domain", () => {
  it("si la app valida, el dominio también acepta (mismos límites)", () => {
    const casos: readonly DatosFormularioPedido[] = [
      datosValidos(),
      {
        ...datosValidos(),
        tipo: "assisted_purchase",
        comercioTexto: "Ti magazen",
        notas: "Nota de prueba",
        items: [{ descripcion: "Harina 5kg", cantidad: 3, precioEstimado: 9000 } as ArticuloPedido],
      },
    ];
    for (const caso of casos) {
      expect(validarFormularioPedido(caso)).toEqual([]);
      expect(validarCreacionPedido(aDatosDominio(caso))).toEqual([]);
    }
  });

  it("si el dominio rechazaría, la app tampoco debe dejar enviar", () => {
    const sinItems = { ...datosValidos(), items: [] };
    expect(validarFormularioPedido(sinItems).length).toBeGreaterThan(0);
    const direccionCorta = { ...datosValidos(), recogidaTexto: "abcd" };
    expect(validarFormularioPedido(direccionCorta).length).toBeGreaterThan(0);
  });
});
