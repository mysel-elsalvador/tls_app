"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AlarmTable } from "@/components/AlarmTable";
import { AuthGate } from "@/components/AuthGate";
import { StationStatus } from "@/components/Status";
import { TankCard } from "@/components/TankCard";
import { useApi } from "@/lib/api";
import { ago, localTime } from "@/lib/format";
import type { StationDetail } from "@/lib/types";

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
  const id = useSearchParams().get("id");
  const valid = id !== null && /^[1-9][0-9]*$/.test(id);
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
        <div className="grid">
          {tanks.map((t) => (
            <TankCard key={t.tank} t={t} />
          ))}
        </div>
      )}
    </>
  );
}
