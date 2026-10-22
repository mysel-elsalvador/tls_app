"use client";

import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { Badge, StationStatus } from "@/components/Status";
import { useApi } from "@/lib/api";
import { ago } from "@/lib/format";
import type { Me, StationSummary } from "@/lib/types";

export default function Home() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}

function Dashboard() {
  const me = useApi<Me>("/v1/me", 5 * 60_000);
  const list = useApi<{ stations: StationSummary[] }>("/v1/stations");

  const inactive = me.data?.orgs.filter((o) => !o.active) ?? [];
  const stations = list.data?.stations;

  return (
    <>
      <h1>Estaciones</h1>

      {me.data && me.data.orgs.length === 0 && (
        <p className="notice">Su usuario no está asociado a ninguna organización. Contacte a soporte.</p>
      )}
      {inactive.map((o) => (
        <p key={o.id} className="notice">
          La suscripción de <strong>{o.name}</strong> está inactiva; sus estaciones no se muestran. Contacte a soporte.
        </p>
      ))}
      {list.error && <p className="notice">No se pudo actualizar ({list.error.message}). Reintentando…</p>}

      {!stations && !list.error && <p className="muted">Cargando…</p>}
      {stations?.length === 0 &&
        me.data &&
        me.data.orgs.some((o) => o.active) &&
        (me.data.orgs.some((o) => o.active && o.stations === "all") ? (
          <p className="muted">No hay estaciones registradas.</p>
        ) : (
          <p className="notice">
            Su usuario no tiene estaciones asignadas. Contacte al administrador de su organización.
          </p>
        ))}

      <div className="grid">
        {stations?.map((s) => (
          <Link key={s.id} href={`/station/?id=${s.id}`} className="card station-card">
            <header>
              <h2>{s.name}</h2>
              <span className="muted small">
                {s.org.name}
                {s.address ? ` · ${s.address}` : ""}
              </span>
            </header>
            <StationStatus s={s} />
            <div className="stats">
              <div>
                <span className="stat-value">{s.tanks}</span>
                <span className="muted small">tanques</span>
              </div>
              <div>
                <span className="stat-value">{s.active_alarms}</span>
                <span className="muted small">alarmas activas</span>
              </div>
            </div>
            <footer className="muted small">
              {s.active_alarms > 0 && <Badge tone="critical">Revisar alarmas</Badge>} Última lectura{" "}
              {ago(s.last_reading_at)}
            </footer>
          </Link>
        ))}
      </div>
    </>
  );
}
