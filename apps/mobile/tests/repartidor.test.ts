/**
 * Tests unitarios de los helpers puros del servicio de repartidor
 * (apps/mobile/src/repartidor.ts). Sin red: solo lógica de clasificación,
 * KPI y matriz de transiciones, que debe coincidir con @kourigo/domain.
 */
import { describe, expect, it } from "vitest";
import {
  calcularKpisCourier,
  clasificarAsignaciones,
  courierOperativo,
  siguienteTransicionCourier,
  type FilaAsignacion,
} from "../src/repartidor";

function asignacion(cambios: Partial<FilaAsignacion>): FilaAsignacion {
  return {
    id: "a1",
    order_id: "o1",
    status: "offered",
    offered_at: "2026-11-14T10:00:00Z",
    accepted_at: null,
    completed_at: null,
    orders: {
      id: "o1",
      status: "offered",
      order_type: "delivery",
      pickup_address_text: "Rue 1, Port-au-Prince",
      dropoff_address_text: "Rue 2, Pétion-Ville",
      store_address_text: null,
      currency: "HTG",
      service_fee_amount: 150,
      created_at: "2026-11-14T09:00:00Z",
    },
    ...cambios,
  };
}

describe("clasificarAsignaciones", () => {
  it("separa oferta, curso activo, terminado y descarta lo no visible", () => {
    const resultado = clasificarAsignaciones([
      asignacion({ id: "oferta", status: "offered", orders: { status: "offered" } as never }),
      // El sistema devolvió el pedido a la cola: la oferta ya no es válida.
      asignacion({
        id: "oferta_muerta",
        status: "offered",
        orders: { status: "pending" } as never,
      }),
      asignacion({
        id: "activo",
        status: "accepted",
        accepted_at: "2026-11-14T11:00:00Z",
        orders: { status: "at_pickup" } as never,
      }),
      asignacion({
        id: "terminado",
        status: "completed",
        completed_at: "2026-11-14T12:00:00Z",
        orders: { status: "delivered" } as never,
      }),
      asignacion({ id: "rechazado", status: "rejected" }),
    ]);
    expect(resultado.ofertas.map((fila) => fila.id)).toEqual(["oferta"]);
    expect(resultado.activos.map((fila) => fila.id)).toEqual(["activo"]);
    expect(resultado.terminados.map((fila) => fila.id)).toEqual(["terminado"]);
  });

  it("oculta la oferta cuyo pedido dejó de estar offered (RLS puede no traer el pedido)", () => {
    const resultado = clasificarAsignaciones([
      asignacion({ id: "sin_pedido", status: "offered", orders: null }),
    ]);
    expect(resultado.ofertas).toHaveLength(0);
    expect(resultado.activos).toHaveLength(0);
    expect(resultado.terminados).toHaveLength(0);
  });
});

describe("siguienteTransicionCourier", () => {
  it("recorre el ciclo operativo de la matriz de @kourigo/domain", () => {
    expect(siguienteTransicionCourier("offered")).toBe("accepted");
    expect(siguienteTransicionCourier("accepted")).toBe("at_pickup");
    expect(siguienteTransicionCourier("at_pickup")).toBe("picked_up");
    expect(siguienteTransicionCourier("picked_up")).toBe("in_transit");
    expect(siguienteTransicionCourier("in_transit")).toBe("delivered");
  });

  it("devuelve null fuera del ciclo (estados del cliente o del sistema)", () => {
    expect(siguienteTransicionCourier("draft")).toBeNull();
    expect(siguienteTransicionCourier("pending")).toBeNull();
    expect(siguienteTransicionCourier("delivered")).toBeNull();
    expect(siguienteTransicionCourier("cancelled")).toBeNull();
  });
});

describe("calcularKpisCourier", () => {
  const ahora = new Date("2026-11-14T15:00:00Z");

  it("cuenta entregas de hoy y totales solo de asignaciones completed", () => {
    const kpis = calcularKpisCourier(
      [
        asignacion({ id: "hoy", status: "completed", completed_at: "2026-11-14T13:00:00Z" }),
        asignacion({ id: "ayer", status: "completed", completed_at: "2026-11-13T13:00:00Z" }),
        asignacion({ id: "activo", status: "accepted" }),
      ],
      ahora,
    );
    expect(kpis.entregasHoy).toBe(1);
    expect(kpis.entregasTotales).toBe(2);
  });

  it("no inventa nota ni cuenta asignaciones sin completed_at", () => {
    const kpis = calcularKpisCourier(
      [asignacion({ id: "raro", status: "completed", completed_at: null })],
      ahora,
    );
    expect(kpis.entregasHoy).toBe(0);
    expect(kpis.entregasTotales).toBe(1);
  });
});

describe("courierOperativo", () => {
  it("aplica la misma regla que repartidor_aprobado() del backend", () => {
    expect(
      courierOperativo({
        verification_status: "approved",
        account_active: true,
        work_zone: null,
        available: false,
      }),
    ).toBe(true);
    expect(
      courierOperativo({
        verification_status: "under_review",
        account_active: true,
        work_zone: null,
        available: false,
      }),
    ).toBe(false);
    expect(
      courierOperativo({
        verification_status: "approved",
        account_active: false,
        work_zone: null,
        available: false,
      }),
    ).toBe(false);
    expect(courierOperativo(null)).toBe(false);
  });
});
