import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./estilos.css";

const raiz = document.getElementById("raiz");
if (raiz === null) {
  throw new Error("El HTML no contiene el contenedor #raiz de la consola.");
}

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
