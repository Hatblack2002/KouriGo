/**
 * Directorio real de repartidores registrados en `courier_profiles` bajo RLS.
 * Muestra contadores reales (0 si todavía no hay repartidores registrados o
 * aprobados) y tabla sin datos simulados.
 */
import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listarPerfiles,
  listarTodosPerfilesCourier,
  type FilaCourierDirectorio,
  type FilaPerfil,
} from "../api/perfiles";
import { Cargando, InsigniaExpediente, MensajeError } from "../componentes";
import { formatearFecha } from "../formato";
import { IconoAprobado, IconoBuscar, IconoEnCurso, IconoLivreurs } from "../iconos";
import { useIdioma } from "../idiomas";

export function PantallaLivreurs({ cliente }: { readonly cliente: SupabaseClient }) {
  const { t, idioma } = useIdioma();
  const [couriers, setCouriers] = useState<FilaCourierDirectorio[]>([]);
  const [perfiles, setPerfiles] = useState<FilaPerfil[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let montado = true;
    async function cargar() {
      setCargando(true);
      setError(null);
      const [resCouriers, resPerfiles] = await Promise.all([
        listarTodosPerfilesCourier(cliente),
        listarPerfiles(cliente),
      ]);
      if (!montado) {
        return;
      }
      if (resCouriers.error !== null) {
        setError(resCouriers.error);
        setCouriers([]);
      } else {
        setCouriers(resCouriers.filas);
        setPerfiles(resPerfiles.filas);
        setError(resPerfiles.error);
      }
      setCargando(false);
    }
    void cargar();
    return () => {
      montado = false;
    };
  }, [cliente]);

  function nombreDe(usuarioId: string): string {
    const perfil = perfiles.find((p) => p.id === usuarioId);
    if (perfil !== undefined && perfil.full_name !== null && perfil.full_name.trim().length > 0) {
      return perfil.full_name;
    }
    return `${usuarioId.slice(0, 8)}…`;
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (q.length === 0) {
      return couriers;
    }
    return couriers.filter((c) => {
      const perfil = perfiles.find((p) => p.id === c.user_id);
      const nombre = (perfil?.full_name ?? "").toLowerCase();
      const zona = (c.work_zone ?? "").toLowerCase();
      return nombre.includes(q) || zona.includes(q) || c.user_id.toLowerCase().includes(q);
    });
  }, [couriers, perfiles, busqueda]);

  const aprobados = couriers.filter((c) => c.verification_status === "approved").length;
  const enLinea = couriers.filter((c) => c.available && c.account_active).length;

  return (
    <div className="verificacion-vista">
      <div className="kpi-fila-3">
        <article className="kpi-tarjeta acento-verde">
          <div className="kpi-icono fondo-menta">
            <IconoLivreurs />
          </div>
          <div className="kpi-datos">
            <span className="kpi-etiqueta">{t("nav_livreurs")}</span>
            <strong className="kpi-valor">{couriers.length}</strong>
          </div>
        </article>

        <article className="kpi-tarjeta acento-azul">
          <div className="kpi-icono fondo-azul">
            <IconoEnCurso />
          </div>
          <div className="kpi-datos">
            <span className="kpi-etiqueta">{t("disponible_si")}</span>
            <strong className="kpi-valor">{enLinea}</strong>
          </div>
        </article>

        <article className="kpi-tarjeta acento-verde-fuerte">
          <div className="kpi-icono fondo-menta">
            <IconoAprobado />
          </div>
          <div className="kpi-datos">
            <span className="kpi-etiqueta">{t("kpi_apwouve")}</span>
            <strong className="kpi-valor">{aprobados}</strong>
          </div>
        </article>
      </div>

      <MensajeError mensaje={error} />

      <section className="tarjeta">
        <div className="tarjeta-cabecera-barra">
          <h2>{t("nav_livreurs")}</h2>
          <div className="campo-busqueda-admin compacto">
            <IconoBuscar />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={t("buscar_livreur")}
              aria-label={t("buscar_livreur")}
            />
          </div>
        </div>

        {cargando ? (
          <Cargando texto={t("cargando")} />
        ) : filtrados.length === 0 ? (
          <div className="estado-vacio-panel">
            <div className="estado-vacio-icono">
              <IconoLivreurs />
            </div>
            <p className="estado-vacio-titulo">{t("nav_livreurs")}</p>
            <p className="estado-vacio-sub">{t("sin_couriers_registrados")}</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("th_repartidor")}</th>
                <th>{t("th_estado")}</th>
                <th>{t("col_zona")}</th>
                <th>{t("col_disponible")}</th>
                <th>{t("col_cuenta")}</th>
                <th>{t("th_actualizado")}</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.user_id}>
                  <td>{nombreDe(c.user_id)}</td>
                  <td>
                    <InsigniaExpediente estado={c.verification_status} />
                  </td>
                  <td>{c.work_zone ?? "—"}</td>
                  <td>
                    <span
                      className={c.available ? "insignia estado-exito" : "insignia estado-neutro"}
                    >
                      {c.available ? t("disponible_si") : t("disponible_no")}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        c.account_active ? "insignia estado-exito" : "insignia estado-malo"
                      }
                    >
                      {c.account_active ? t("cuenta_activa") : t("cuenta_inactiva")}
                    </span>
                  </td>
                  <td>{formatearFecha(c.updated_at, idioma)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
