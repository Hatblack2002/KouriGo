/**
 * Componentes compartidos de la consola: piezas mínimas de trabajo diario
 * (README sección 14: «priorizar el trabajo diario, no la decoración»). Las
 * etiquetas de estado salen del diccionario de idiomas (README sección 9);
 * los literales reales de la base de datos se mantienen como respaldo.
 */
import type { ReactNode } from "react";
import { etiquetaEstadoExpediente, etiquetaEstadoPedido, useIdioma } from "./idiomas";

export function Tarjeta({
  titulo,
  children,
}: {
  readonly titulo: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="tarjeta">
      <h2>{titulo}</h2>
      {children}
    </section>
  );
}

export function Cargando({ texto }: { readonly texto: string }) {
  return <p className="cargando">{texto}</p>;
}

export function MensajeError({ mensaje }: { readonly mensaje: string | null }) {
  if (mensaje === null || mensaje.length === 0) {
    return null;
  }
  return (
    <p className="mensaje-error" role="alert">
      {mensaje}
    </p>
  );
}

export function MensajeOk({ mensaje }: { readonly mensaje: string | null }) {
  if (mensaje === null || mensaje.length === 0) {
    return null;
  }
  return (
    <p className="mensaje-ok" role="status">
      {mensaje}
    </p>
  );
}

const CLASES_ESTADO_PEDIDO: Record<string, string> = {
  draft: "estado-neutro",
  pending: "estado-activo",
  offered: "estado-activo",
  accepted: "estado-activo",
  at_pickup: "estado-activo",
  picked_up: "estado-activo",
  in_transit: "estado-activo",
  delivered: "estado-exito",
  cancelled: "estado-malo",
  issue: "estado-malo",
};

export function InsigniaEstado({ estado }: { readonly estado: string }) {
  const { idioma } = useIdioma();
  const clase = CLASES_ESTADO_PEDIDO[estado] ?? "estado-neutro";
  return <span className={`insignia ${clase}`}>{etiquetaEstadoPedido(idioma, estado)}</span>;
}

export function InsigniaExpediente({ estado }: { readonly estado: string }) {
  const { idioma } = useIdioma();
  const clase =
    estado === "approved"
      ? "estado-exito"
      : estado === "rejected" || estado === "suspended"
        ? "estado-malo"
        : estado === "draft" || estado === "expired"
          ? "estado-neutro"
          : "estado-activo";
  return <span className={`insignia ${clase}`}>{etiquetaEstadoExpediente(idioma, estado)}</span>;
}

export function SinDatos({ texto }: { readonly texto: string }) {
  return <p className="sin-datos">{texto}</p>;
}
