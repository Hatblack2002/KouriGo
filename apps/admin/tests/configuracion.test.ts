/**
 * Pruebas unitarias de la configuración pública (sin red): la consola exige
 * VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY y normaliza la URL.
 */
import { afterEach, describe, expect, it } from "vitest";
import { ConfiguracionFaltanteError, leerConfiguracionPublica } from "../src/configuracion";

const ENTORNO = import.meta.env as Record<string, string | undefined>;

afterEach(() => {
  delete ENTORNO.VITE_SUPABASE_URL;
  delete ENTORNO.VITE_SUPABASE_ANON_KEY;
});

describe("leerConfiguracionPublica", () => {
  it("falla de forma explícita sin configuración", () => {
    expect(() => leerConfiguracionPublica()).toThrow(ConfiguracionFaltanteError);
    try {
      leerConfiguracionPublica();
    } catch (error) {
      expect(error instanceof Error && error.message.includes("VITE_SUPABASE_URL")).toBe(true);
    }
  });

  it("falla cuando falta solo una de las dos variables", () => {
    ENTORNO.VITE_SUPABASE_URL = "https://ejemplo.supabase.co";
    expect(() => leerConfiguracionPublica()).toThrow(ConfiguracionFaltanteError);
    delete ENTORNO.VITE_SUPABASE_URL;
    ENTORNO.VITE_SUPABASE_ANON_KEY = "clave";
    expect(() => leerConfiguracionPublica()).toThrow(ConfiguracionFaltanteError);
  });

  it("acepta cadenas vacías como ausencia", () => {
    ENTORNO.VITE_SUPABASE_URL = "";
    ENTORNO.VITE_SUPABASE_ANON_KEY = "clave";
    expect(() => leerConfiguracionPublica()).toThrow(ConfiguracionFaltanteError);
  });

  it("normaliza la barra final de la URL", () => {
    ENTORNO.VITE_SUPABASE_URL = "https://ejemplo.supabase.co///";
    ENTORNO.VITE_SUPABASE_ANON_KEY = "clave-publica";
    const configuracion = leerConfiguracionPublica();
    expect(configuracion.supabaseUrl).toBe("https://ejemplo.supabase.co");
    expect(configuracion.supabaseAnonKey).toBe("clave-publica");
  });
});
