/**
 * Pruebas unitarias de las decisiones del expediente disponibles para la
 * consola (sin red): deben coincidir EXACTAMENTE con la matriz de
 * @kourigo/domain y con las claves de DECISIONES_EXPEDIENTE que acepta la
 * Edge Function `decision-verificacion`.
 */
import { describe, expect, it } from "vitest";
import { decisionesAdminDisponibles, metodosVerificacion } from "../src/api/expediente";

describe("decisionesAdminDisponibles", () => {
  it("desde submitted solo permite iniciar la revisión", () => {
    const opciones = decisionesAdminDisponibles("submitted");
    expect(opciones.map((o) => o.decision)).toEqual(["iniciar_revision"]);
    expect(opciones[0]?.destino).toBe("under_review");
    expect(opciones[0]?.requiereMotivo).toBe(false);
    expect(opciones[0]?.requiereMetodo).toBe(false);
  });

  it("desde under_review ofrece pedir información, programar, aprobar y rechazar", () => {
    const opciones = decisionesAdminDisponibles("under_review");
    const porDecision = new Map(opciones.map((o) => [o.decision, o]));
    expect([...porDecision.keys()].sort()).toEqual([
      "aprobar",
      "pedir_informacion",
      "programar_verificacion",
      "rechazar",
    ]);
    const aprobar = porDecision.get("aprobar");
    expect(aprobar?.destino).toBe("approved");
    expect(aprobar?.requiereMotivo).toBe(true);
    expect(aprobar?.requiereMetodo).toBe(true);
    const rechazar = porDecision.get("rechazar");
    expect(rechazar?.requiereMotivo).toBe(true);
    expect(rechazar?.requiereMetodo).toBe(false);
    const programar = porDecision.get("programar_verificacion");
    expect(programar?.requiereMotivo).toBe(false);
    expect(programar?.requiereMetodo).toBe(true);
    const pedir = porDecision.get("pedir_informacion");
    expect(pedir?.requiereMotivo).toBe(true);
  });

  it("desde approved ofrece suspender, reverificación y expiración, todas con motivo", () => {
    const opciones = decisionesAdminDisponibles("approved");
    expect(opciones.map((o) => o.decision).sort()).toEqual([
      "expirar",
      "solicitar_reverificacion",
      "suspender",
    ]);
    expect(opciones.every((o) => o.requiereMotivo)).toBe(true);
  });

  it("los estados históricos (rejected) no ofrecen decisiones", () => {
    expect(decisionesAdminDisponibles("rejected")).toEqual([]);
  });

  it("los estados de reanudación vuelven a revisión sin motivo", () => {
    const desdeSuspendido = decisionesAdminDisponibles("suspended");
    expect(desdeSuspendido.map((o) => o.decision)).toEqual(["iniciar_revision"]);
    const desdeExpirado = decisionesAdminDisponibles("expired");
    expect(desdeExpirado.map((o) => o.decision)).toEqual(["iniciar_revision"]);
  });
});

describe("metodosVerificacion", () => {
  it("expone exactamente los tres métodos de la especificación", () => {
    expect(metodosVerificacion()).toEqual(["documental", "videoconferencia", "presencial"]);
  });
});
