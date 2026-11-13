/**
 * Pruebas unitarias del diccionario de idiomas (README sección 9): los tres
 * idiomas (kreyòl, français y español adicional) comparten EXACTAMENTE las
 * mismas claves, el kreyòl es el idioma por defecto y las etiquetas de
 * estados/documentos mantienen el literal real de la base de datos como
 * respaldo cuando no hay traducción.
 */
import { describe, expect, it } from "vitest";
import {
  CLAVES_TEXTOS,
  ETIQUETA_IDIOMA,
  IDIOMA_POR_DEFECTO,
  IDIOMAS,
  etiquetaDocumento,
  etiquetaEstadoExpediente,
  etiquetaEstadoPedido,
  texto,
  type Idioma,
} from "../src/idiomas";

describe("diccionario de idiomas", () => {
  it("tiene las mismas claves y valores no vacíos en los tres idiomas", () => {
    expect(IDIOMAS).toEqual(["ht", "fr", "es"]);
    expect(CLAVES_TEXTOS.length).toBeGreaterThan(150);
    for (const clave of CLAVES_TEXTOS) {
      for (const idioma of IDIOMAS) {
        const valor = texto(idioma, clave);
        expect(
          typeof valor === "string" && valor.length > 0,
          `${idioma}:${clave} debe tener texto`,
        ).toBe(true);
      }
    }
  });

  it("el kreyòl es el idioma por defecto y el prioritario", () => {
    expect(IDIOMA_POR_DEFECTO).toBe("ht");
    expect(IDIOMAS[0]).toBe("ht");
    expect(ETIQUETA_IDIOMA.ht).toBe("Kreyòl");
    expect(ETIQUETA_IDIOMA.fr).toBe("Français");
    expect(ETIQUETA_IDIOMA.es).toBe("Español");
  });

  it("la terminología coincide con la app móvil (ADR-0006)", () => {
    expect(texto("ht", "correo")).toBe("Imèl");
    expect(texto("ht", "contrasena")).toBe("Modpas");
    expect(texto("ht", "iniciar_sesion")).toBe("Konekte");
    expect(texto("ht", "credenciales_invalidas")).toBe("Imèl oswa modpas la pa bon.");
    expect(texto("ht", "tipo_compra_asistida")).toBe("Achte pou mwen + livre");
    expect(texto("fr", "iniciar_sesion")).toBe("Se connecter");
    expect(texto("fr", "contrasena")).toBe("Mot de passe");
    expect(texto("es", "credenciales_invalidas")).toBe("Correo o contraseña incorrectos.");
  });

  it("las etiquetas de estados salen del diccionario por idioma", () => {
    expect(etiquetaEstadoPedido("ht", "in_transit")).toBe("Nan wout");
    expect(etiquetaEstadoPedido("fr", "in_transit")).toBe("En transit");
    expect(etiquetaEstadoPedido("es", "in_transit")).toBe("en tránsito");
    expect(etiquetaEstadoExpediente("ht", "approved")).toBe("Apwouve");
    expect(etiquetaEstadoExpediente("fr", "under_review")).toBe("En cours d'examen");
    expect(etiquetaEstadoExpediente("es", "under_review")).toBe("en revisión");
  });

  it("un literal desconocido de la base de datos se mantiene tal cual", () => {
    const estados: Idioma[] = ["ht", "fr", "es"];
    for (const idioma of estados) {
      expect(etiquetaEstadoPedido(idioma, "estado_futuro")).toBe("estado_futuro");
      expect(etiquetaEstadoExpediente(idioma, "estado_futuro")).toBe("estado_futuro");
      expect(etiquetaDocumento(idioma, "documento_futuro")).toBe("documento_futuro");
    }
  });
});
