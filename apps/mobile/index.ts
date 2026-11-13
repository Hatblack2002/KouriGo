/**
 * Punto de entrada de la app móvil: registra el componente raíz en el
 * runtime de React Native de Expo.
 */
import { registerRootComponent } from "expo";
import App from "./App.js";

registerRootComponent(App);
