import { describe, expect, it } from "vitest";

import {
  ACTORES_EXPEDIENTE,
  ESTADOS_EXPEDIENTE,
  METODOS_VERIFICACION,
  TIPOS_DOCUMENTO_EXPEDIENTE,
  TRANSICIONES_EXPEDIENTE_POR_ACTOR,
  esEstadoExpediente,
  esTransicionExpedienteValida,
  repartidorOperativo,
  validarTransicionExpediente,
  type EstadoExpediente,
} from "../src/expediente.js";

describe("estados del expediente", () => {
  it("contiene exactamente los 10 estados de la especificación", () => {
    expect(ESTADOS_EXPEDIENTE).toHaveLength(10);
    expect(new Set(ESTADOS_EXPEDIENTE).size).toBe(10);
  });

  it("reconoce estados válidos y rechaza valores desconocidos", () => {
    expect(esEstadoExpediente("approved")).toBe(true);
    expect(esEstadoExpediente("reverification_required")).toBe(true);
    expect(esEstadoExpediente("aprobado")).toBe(false);
    expect(esEstadoExpediente(42)).toBe(false);
  });

  it("define los tres métodos de comprobación y los tipos de documento", () => {
    expect(METODOS_VERIFICACION).toEqual(["documental", "videoconferencia", "presencial"]);
    expect(TIPOS_DOCUMENTO_EXPEDIENTE).toContain("certificate_good_conduct");
    expect(TIPOS_DOCUMENTO_EXPEDIENTE).toContain("driver_license");
    expect(TIPOS_DOCUMENTO_EXPEDIENTE).toHaveLength(6);
  });

  it("define los tres actores del expediente", () => {
    expect(ACTORES_EXPEDIENTE).toEqual(["candidato", "administrador", "sistema"]);
  });
});

describe("transiciones del candidato", () => {
  it("permite presentar desde draft, needs_information y reverification_required", () => {
    expect(esTransicionExpedienteValida("draft", "submitted", "candidato")).toBe(true);
    expect(esTransicionExpedienteValida("needs_information", "submitted", "candidato")).toBe(true);
    expect(esTransicionExpedienteValida("reverification_required", "submitted", "candidato")).toBe(
      true,
    );
  });

  it("no permite estados privilegiados ni saltos", () => {
    expect(esTransicionExpedienteValida("submitted", "approved", "candidato")).toBe(false);
    expect(esTransicionExpedienteValida("submitted", "under_review", "candidato")).toBe(false);
    expect(esTransicionExpedienteValida("draft", "approved", "candidato")).toBe(false);
    expect(esTransicionExpedienteValida("rejected", "submitted", "candidato")).toBe(false);
  });

  it("exige al menos un documento para presentar", () => {
    const sinDocumentos = validarTransicionExpediente("draft", "submitted", "candidato", {
      tieneDocumentos: false,
    });
    expect(sinDocumentos.valida).toBe(false);
    expect(sinDocumentos.razon).toContain("documento");

    const conDocumentos = validarTransicionExpediente("draft", "submitted", "candidato", {
      tieneDocumentos: true,
    });
    expect(conDocumentos.valida).toBe(true);
  });
});

describe("transiciones administrativas", () => {
  it("cubre el ciclo de revisión completo", () => {
    const ciclo: Array<[EstadoExpediente, EstadoExpediente]> = [
      ["submitted", "under_review"],
      ["under_review", "needs_information"],
      ["needs_information", "under_review"],
      ["under_review", "verification_scheduled"],
      ["verification_scheduled", "under_review"],
      ["under_review", "approved"],
      ["approved", "suspended"],
      ["suspended", "under_review"],
      ["under_review", "rejected"],
    ];
    for (const [de, a] of ciclo) {
      expect(esTransicionExpedienteValida(de, a, "administrador")).toBe(true);
    }
  });

  it("permite reabrir expirados y reverificar aprobados", () => {
    expect(esTransicionExpedienteValida("expired", "under_review", "administrador")).toBe(true);
    expect(
      esTransicionExpedienteValida("approved", "reverification_required", "administrador"),
    ).toBe(true);
    expect(esTransicionExpedienteValida("approved", "expired", "administrador")).toBe(true);
  });

  it("exige motivo en decisiones y método en habilitaciones", () => {
    const sinMotivo = validarTransicionExpediente("under_review", "rejected", "administrador");
    expect(sinMotivo.valida).toBe(false);
    expect(sinMotivo.razon).toContain("motivo");

    const sinMetodo = validarTransicionExpediente("under_review", "approved", "administrador", {
      motivo: "Documentación consistente",
    });
    expect(sinMetodo.valida).toBe(false);
    expect(sinMetodo.razon).toContain("método");

    const completa = validarTransicionExpediente("under_review", "approved", "administrador", {
      motivo: "Documentación consistente",
      metodo: "documental",
    });
    expect(completa.valida).toBe(true);

    const programacion = validarTransicionExpediente(
      "under_review",
      "verification_scheduled",
      "administrador",
      { metodo: "videoconferencia" },
    );
    expect(programacion.valida).toBe(true);
  });
});

describe("transiciones del sistema", () => {
  it("solo puede expirar expedientes aprobados por vigencia", () => {
    expect(esTransicionExpedienteValida("approved", "expired", "sistema")).toBe(true);
    expect(esTransicionExpedienteValida("approved", "suspended", "sistema")).toBe(false);
    expect(esTransicionExpedienteValida("submitted", "under_review", "sistema")).toBe(false);
  });

  it("la expiración exige motivo", () => {
    const resultado = validarTransicionExpediente("approved", "expired", "sistema");
    expect(resultado.valida).toBe(false);
    expect(
      validarTransicionExpediente("approved", "expired", "sistema", {
        motivo: "Política de vigencia anual",
      }).valida,
    ).toBe(true);
  });
});

describe("consistencia de la matriz de transiciones", () => {
  it("no repite pares dentro del mismo actor sin unión", () => {
    const actoresSinUnion = ACTORES_EXPEDIENTE.filter((a) => a !== "administrador");
    for (const actor of actoresSinUnion) {
      const claves = TRANSICIONES_EXPEDIENTE_POR_ACTOR[actor].map((t) => `${t.de}->${t.a}`);
      expect(new Set(claves).size).toBe(claves.length);
    }
  });

  it("la administración puede ejecutar todas las transiciones de los demás actores", () => {
    const deAdmin = new Set(
      TRANSICIONES_EXPEDIENTE_POR_ACTOR.administrador.map((t) => `${t.de}->${t.a}`),
    );
    for (const actor of ACTORES_EXPEDIENTE) {
      for (const transicion of TRANSICIONES_EXPEDIENTE_POR_ACTOR[actor]) {
        expect(deAdmin.has(`${transicion.de}->${transicion.a}`)).toBe(true);
      }
    }
  });

  it("solo usa estados conocidos en ambos extremos", () => {
    for (const actor of ACTORES_EXPEDIENTE) {
      for (const transicion of TRANSICIONES_EXPEDIENTE_POR_ACTOR[actor]) {
        expect(esEstadoExpediente(transicion.de)).toBe(true);
        expect(esEstadoExpediente(transicion.a)).toBe(true);
      }
    }
  });

  it("ninguna transición deja el estado inalterado", () => {
    for (const actor of ACTORES_EXPEDIENTE) {
      for (const transicion of TRANSICIONES_EXPEDIENTE_POR_ACTOR[actor]) {
        expect(transicion.de).not.toBe(transicion.a);
      }
    }
  });
});

describe("regla de habilitación operativa", () => {
  it("solo un expediente aprobado con cuenta activa habilita", () => {
    expect(repartidorOperativo("approved", true)).toBe(true);
    expect(repartidorOperativo("approved", false)).toBe(false);
    expect(repartidorOperativo("suspended", true)).toBe(false);
    expect(repartidorOperativo("expired", true)).toBe(false);
    expect(repartidorOperativo("submitted", true)).toBe(false);
  });
});
