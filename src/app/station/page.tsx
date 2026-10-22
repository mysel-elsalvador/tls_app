"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AlarmTable } from "@/components/AlarmTable";
import { AuthGate } from "@/components/AuthGate";
import { ChartCard } from "@/components/ChartCard";
import { StationStatus } from "@/components/Status";
import { TankCard } from "@/components/TankCard";
import { useApi } from "@/lib/api";
import { ago, localTime } from "@/lib/format";
import type { History, StationDetail, Tank } from "@/lib/types";

// /station/?id=7: a query string, because a static export cannot have
// dynamic routes for stations created after the build.
export default function StationPage() {
  return (
    <AuthGate>
      <Suspense fallback={<p className="muted">Cargando…</p>}>
        <Station />
      </Suspense>
    </AuthGate>
  );
}

function Station() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const valid = id !== null && /^[1-9][0-9]*$/.test(id);
  // View and range live in the URL (?vista=graficas&h=48), so a reload or a
  // shared link keeps them.
  const charts = params.get("vista") === "graficas";
  const hours = RANGES.find(([h]) => String(h) === params.get("h"))?.[0] ?? 24;
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.replace(`/station/?${next}`, { scroll: false });
  };
  const { data, error, at } = useApi<StationDetail>(valid ? `/v1/stations/${id}` : null);

  const back = (
    <p>
      <Link href="/">← Estaciones</Link>
    </p>
  );

  if (!valid || error?.code === "not_found") {
    return (
      <>
        {back}
        <p className="notice">Estación no encontrada.</p>
      </>
    );
  }
  if (error?.code === "organization_inactive") {
    return (
      <>
        {back}
        <p className="notice">La suscripción de esta organización está inactiva. Contacte a soporte.</p>
      </>
    );
  }
  if (!data) {
    return (
      <>
        {back}
        <p className="muted">{error ? `No se pudo cargar (${error.message}). Reintentando…` : "Cargando…"}</p>
      </>
    );
  }

  const { station: s, tanks, alarms } = data;
  return (
    <>
      {back}
      <h1>{s.name}</h1>
      <p className="muted">
        {s.org.name}
        {s.address ? ` · ${s.address}` : ""} · agente {s.agent.id}
        {s.agent.version ? ` v${s.agent.version}` : ""} · consola {s.console.id ?? "sin asignar"}
      </p>
      <StationStatus s={s} />
      {s.agent.state !== "online" && (
        <p className="notice">
          Sin conexión con el agente desde {localTime(s.agent.last_heartbeat_at)}. Los datos son de la última conexión.
        </p>
      )}
      {error && <p className="notice">No se pudo actualizar ({error.message}). Mostrando datos de {ago(at?.toISOString() ?? null)}.</p>}

      <h2>Alarmas activas ({alarms.length})</h2>
      <AlarmTable alarms={alarms} />

      <h2>Tanques</h2>
      {tanks.length === 0 ? (
        <p className="muted">Aún no hay lecturas de inventario.</p>
      ) : (
        <>
          <div className="toolbar">
            <Segmented
              label="Vista"
              value={charts ? "graficas" : "tanques"}
              options={[
                ["tanques", "Tanques"],
                ["graficas", "Gráficas"],
              ]}
              onChange={(v) => setParam("vista", v === "graficas" ? v : null)}
            />
            {charts && (
              <Segmented
                label="Período"
                value={String(hours)}
                options={RANGES.map(([h, text]) => [String(h), text])}
                onChange={(v) => setParam("h", v === "24" ? null : v)}
              />
            )}
          </div>
          {charts ? (
            <TankCharts id={id} tanks={tanks} hours={hours} />
          ) : (
            <div className="grid">
              {tanks.map((t) => (
                <TankCard key={t.tank} t={t} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

const RANGES: [number, string][] = [
  [24, "24 h"],
  [48, "48 h"],
  [168, "7 días"],
];

/** Height of every tank over the last `hours`, by agent time. */
function TankCharts({ id, tanks, hours }: { id: string; tanks: Tank[]; hours: number }) {
  const path = `/v1/stations/${id}/history?hours=${hours}`;
  const { data, error } = useApi<History>(path, 60_000);
  // useApi keeps the previous range until the new one loads: show it dimmed
  // instead of a blank frame.
  const stale = !data || Date.parse(data.to) - Date.parse(data.from) !== hours * 3600_000;
  if (!data) {
    return <p className="muted">{error ? `No se pudo cargar el historial (${error.message}). Reintentando…` : "Cargando historial…"}</p>;
  }
  return (
    <>
      {error && <p className="notice">No se pudo actualizar el historial ({error.message}).</p>}
      <div className={`grid grid-wide${stale ? " stale" : ""}`} aria-busy={stale}>
        {tanks.map((t) => (
          <ChartCard key={t.tank} t={t} h={data.tanks.find((x) => x.tank === t.tank)} from={data.from} to={data.to} />
        ))}
      </div>
      <p className="muted small">Hora de recepción del agente (hora local), no la de la consola.</p>
    </>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}
