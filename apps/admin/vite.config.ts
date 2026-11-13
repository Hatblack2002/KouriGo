/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
  },
});
