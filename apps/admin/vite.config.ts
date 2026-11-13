import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// La consola administrativa se compila como bundle estático (sin servidor
// propio): el build es la evidencia real de compilación y el resultado se
// puede servir desde cualquier alojamiento estático. `base: "./"` permite
// servirlo desde cualquier ruta.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // La prueba E2E contra el proyecto real hace varios viajes de red por
    // paso (usuarios por Admin API, funciones del runtime): 60 s por prueba
    // y por hook, frente a los 5 s por defecto de vitest.
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
