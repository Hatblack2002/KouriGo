/**
 * Pruebas unitarias del módulo de perfil (migración 0006, decisión del
 * fundador 2026-11-15): teléfono SOLO formato Haití +509 con 8 dígitos,
 * validación del formulario de edición y dirección de entrega compuesta a
 * partir del perfil. Funciones puras: sin red.
 */
import { describe, expect, it } from "vitest";
import {
  DEPARTAMENTOS_HAITI,
  componerDireccionEntrega,
  normalizarTelefonoHaiti,
  validarPerfilEdicion,
  type DatosPerfilEdicion,
} from "../src/perfil";

function datosValidos(): DatosPerfilEdicion {
  return {
    nombreCompleto: "Cliente de Prueba",
    telefono: "37141234",
    departamento: "Ouest",
    ville: "Delmas",
    codigoPostal: "6110",
    numeroCasa: "#113",
  };
}

describe("normalizarTelefonoHaiti", () => {
  it("acepta 8 dígitos locales y devuelve +509 con el número completo", () => {
    expect(normalizarTelefonoHaiti("37141234")).toBe("+50937141234");
  });

  it("acepta el prefijo 509 con espacios y separadores", () => {
    expect(normalizarTelefonoHaiti("509 3714 1234")).toBe("+50937141234");
    expect(normalizarTelefonoHaiti("+50937141234")).toBe("+50937141234");
    expect(normalizarTelefonoHaiti("0050937141234")).toBe("+50937141234");
    expect(normalizarTelefonoHaiti("+509 37-14-12-34")).toBe("+50937141234");
  });

  it("acepta móviles que empiezan por 2, 3 o 4", () => {
    expect(normalizarTelefonoHaiti("31101234")).toBe("+50931101234");
    expect(normalizarTelefonoHaiti("42101234")).toBe("+50942101234");
    expect(normalizarTelefonoHaiti("28101234")).toBe("+50928101234");
  });

  it("rechaza lo que no es un número haitiano válido", () => {
    expect(normalizarTelefonoHaiti("")).toBeNull();
    expect(normalizarTelefonoHaiti("3714123")).toBeNull();
    expect(normalizarTelefonoHaiti("371412345")).toBeNull();
    expect(normalizarTelefonoHaiti("17141234")).toBeNull();
    expect(normalizarTelefonoHaiti("51412345")).toBeNull();
    expect(normalizarTelefonoHaiti("1809 3714 1234")).toBeNull();
    expect(normalizarTelefonoHaiti("abcd")).toBeNull();
  });
});

describe("validarPerfilEdicion", () => {
  it("acepta el formulario completo y correcto", () => {
    expect(validarPerfilEdicion(datosValidos())).toEqual([]);
  });

  it("exige nombre completo", () => {
    const datos = { ...datosValidos(), nombreCompleto: "   " };
    expect(validarPerfilEdicion(datos)).toContain("err_nombre_vacio");
  });

  it("exige el teléfono en formato Haití", () => {
    const datos = { ...datosValidos(), telefono: "123456" };
    expect(validarPerfilEdicion(datos)).toContain("err_telefono_509");
    const vacio = { ...datosValidos(), telefono: "" };
    expect(validarPerfilEdicion(vacio)).toContain("err_telefono_509");
  });

  it("exige departamento, ville y número de casa", () => {
    expect(
      validarPerfilEdicion({ ...datosValidos(), departamento: "" }),
    ).toContain("err_departamento_vacio");
    expect(validarPerfilEdicion({ ...datosValidos(), ville: "" })).toContain("err_ville_vacio");
    expect(validarPerfilEdicion({ ...datosValidos(), numeroCasa: "" })).toContain(
      "err_casa_vacio",
    );
  });
});

describe("componerDireccionEntrega", () => {
  it("une número de casa, ville y departamento en orden", () => {
    expect(
      componerDireccionEntrega({
        numero_casa: "#113",
        ville: "Delmas",
        departamento: "Ouest",
      }),
    ).toBe("#113, Delmas, Ouest");
  });

  it("omite las partes vacías sin separadores colgantes", () => {
    expect(componerDireccionEntrega({ numero_casa: null, ville: "Delmas", departamento: null })).toBe(
      "Delmas",
    );
    expect(componerDireccionEntrega({ numero_casa: null, ville: null, departamento: null })).toBe(
      "",
    );
  });
});

describe("DEPARTAMENTOS_HAITI", () => {
  it("contiene exactamente los 10 departamentos de Haití", () => {
    expect(DEPARTAMENTOS_HAITI).toHaveLength(10);
    expect(DEPARTAMENTOS_HAITI).toContain("Ouest");
    expect(DEPARTAMENTOS_HAITI).toContain("Artibonite");
    expect(DEPARTAMENTOS_HAITI).toContain("Nord-Est");
    expect(DEPARTAMENTOS_HAITI).toContain("Sud-Est");
  });
});
