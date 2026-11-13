import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "database/**",
      "docs/**",
      // Configuración CJS consumida por Babel, no por Node/TS.
      "**/babel.config.js",
    ],
  },
  {
    ignores: ["supabase/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // `declare var` es la única sintaxis correcta para declaraciones
    // ambientales en archivos de definición de tipos.
    files: ["**/*.d.ts"],
    rules: {
      "no-var": "off",
    },
  },
);
