/**
 * Pruebas unitarias del diccionario bilingüe (README sección 9): todas las
 * claves deben existir en kreyòl y en français, y ninguna cadena puede
 * quedar vacía (criterio del MVP: los textos cambian entre ambos idiomas).
 */
import { describe, expect, it } from "vitest";
import {
  ETIQUETA_IDIOMA,
  IDIOMAS,
  TEXTOS,
  etiquetaEstado,
  texto,
  type ClaveTexto,
} from "../src/i18n.js";
import { ESTADOS_PEDIDO } from "@kourigo/domain";

describe("diccionarios i18n", () => {
  it("cubre los mismos textos en los dos idiomas", () => {
    const claves = Object.keys(TEXTOS.ht).sort() as ClaveTexto[];
    const clavesFr = Object.keys(TEXTOS.fr).sort();
    expect(claves.length).toBeGreaterThan(40);
    expect(clavesFr).toEqual(claves);
  });

  it("ningún texto está vacío", () => {
    for (const idioma of IDIOMAS) {
      for (const clave of Object.keys(TEXTOS[idioma]) as ClaveTexto[]) {
        expect(TEXTOS[idioma][clave].trim().length, `${idioma}:${clave}`).toBeGreaterThan(0);
      }
    }
  });

  it("texto devuelve la cadena del idioma pedido", () => {
    expect(texto("ht", "iniciar_sesion")).toBe("Konekte");
    expect(texto("fr", "iniciar_sesion")).toBe("Se connecter");
  });
});

describe("etiquetaEstado", () => {
  it("tiene etiqueta para cada estado real de la base de datos", () => {
    for (const estado of ESTADOS_PEDIDO) {
      expect(etiquetaEstado("ht", estado)).not.toBe(estado);
      expect(etiquetaEstado("fr", estado)).not.toBe(estado);
    }
  });

  it("devuelve el literal desconocido tal cual (sin inventar etiquetas)", () => {
    expect(etiquetaEstado("ht", "estado_inexistente")).toBe("estado_inexistente");
  });
});

describe("IDIOMAS", () => {
  it("ofrece exactamente kreyòl y français", () => {
    expect(IDIOMAS).toEqual(["ht", "fr"]);
    expect(ETIQUETA_IDIOMA.ht).toBe("Kreyòl");
    expect(ETIQUETA_IDIOMA.fr).toBe("Français");
  });
});
