/**
 * Pruebas unitarias de la configuración pública (sin red).
 */
import { describe, expect, it } from "vitest";
import { ConfiguracionFaltanteError, leerConfiguracionPublica } from "../src/configuracion.js";

function fijarEntorno(clave: string, valor: string | undefined): void {
  const env = process.env as Record<string, string | undefined>;
  if (valor === undefined) {
    delete env[clave];
  } else {
    env[clave] = valor;
  }
}

describe("leerConfiguracionPublica", () => {
  it("devuelve la configuración cuando las dos variables existen", () => {
    fijarEntorno("EXPO_PUBLIC_SUPABASE_URL", "https://proyecto.supabase.co/");
    fijarEntorno("EXPO_PUBLIC_SUPABASE_ANON_KEY", "clave-anon");
    try {
      const config = leerConfiguracionPublica();
      expect(config.supabaseUrl).toBe("https://proyecto.supabase.co");
      expect(config.supabaseAnonKey).toBe("clave-anon");
    } finally {
      fijarEntorno("EXPO_PUBLIC_SUPABASE_URL", undefined);
      fijarEntorno("EXPO_PUBLIC_SUPABASE_ANON_KEY", undefined);
    }
  });

  it("rechaza un bundle sin configuración con un error claro", () => {
    fijarEntorno("EXPO_PUBLIC_SUPABASE_URL", undefined);
    fijarEntorno("EXPO_PUBLIC_SUPABASE_ANON_KEY", undefined);
    expect(() => leerConfiguracionPublica()).toThrow(ConfiguracionFaltanteError);
    expect(() => leerConfiguracionPublica()).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
  });

  it("rechaza una clave anon vacía", () => {
    fijarEntorno("EXPO_PUBLIC_SUPABASE_URL", "https://proyecto.supabase.co");
    fijarEntorno("EXPO_PUBLIC_SUPABASE_ANON_KEY", "");
    try {
      expect(() => leerConfiguracionPublica()).toThrow(ConfiguracionFaltanteError);
    } finally {
      fijarEntorno("EXPO_PUBLIC_SUPABASE_URL", undefined);
      fijarEntorno("EXPO_PUBLIC_SUPABASE_ANON_KEY", undefined);
    }
  });
});
