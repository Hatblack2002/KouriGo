/**
 * Componentes compartidos de la consola: piezas mínimas de trabajo diario
 * (README sección 14: «priorizar el trabajo diario, no la decoración»).
 */
import type { ReactNode } from "react";

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

const NOMBRES_ESTADO_PEDIDO: Record<string, string> = {
  draft: "borrador",
  pending: "pendiente",
  offered: "ofrecido",
  accepted: "aceptado",
  at_pickup: "en recogida",
  picked_up: "recogido",
  in_transit: "en tránsito",
  delivered: "entregado",
  cancelled: "cancelado",
  issue: "incidencia",
};

export function nombreEstadoPedido(estado: string): string {
  return NOMBRES_ESTADO_PEDIDO[estado] ?? estado;
}

export function InsigniaEstado({ estado }: { readonly estado: string }) {
  const clase = CLASES_ESTADO_PEDIDO[estado] ?? "estado-neutro";
  return <span className={`insignia ${clase}`}>{nombreEstadoPedido(estado)}</span>;
}

const NOMBRES_ESTADO_EXPEDIENTE: Record<string, string> = {
  draft: "borrador",
  submitted: "presentado",
  under_review: "en revisión",
  needs_information: "pide información",
  verification_scheduled: "verificación programada",
  approved: "aprobado",
  rejected: "rechazado",
  suspended: "suspendido",
  expired: "expirado",
  reverification_required: "reverificación requerida",
};

export function nombreEstadoExpediente(estado: string): string {
  return NOMBRES_ESTADO_EXPEDIENTE[estado] ?? estado;
}

export function InsigniaExpediente({ estado }: { readonly estado: string }) {
  const clase =
    estado === "approved"
      ? "estado-exito"
      : estado === "rejected" || estado === "suspended"
        ? "estado-malo"
        : estado === "draft" || estado === "expired"
          ? "estado-neutro"
          : "estado-activo";
  return (
    <span className={`insignia ${clase}`}>{nombreEstadoExpediente(estado)}</span>
  );
}

export function SinDatos({ texto }: { readonly texto: string }) {
  return <p className="sin-datos">{texto}</p>;
}
