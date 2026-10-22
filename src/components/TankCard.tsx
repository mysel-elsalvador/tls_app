import { ago, consoleTime, fill, withUnit } from "@/lib/format";
import type { Tank } from "@/lib/types";

export function TankCard({ t }: { t: Tank }) {
  const u = t.units ?? {};
  const f = fill(t);
  const pct = f ? Math.round(f.ratio * 100) : null;
  return (
    <article className="card tank">
      <header className="tank-head">
        <h3>Tanque {t.tank}</h3>
        <span className="muted">
          {t.product_code ? `Producto ${t.product_code}` : "Producto —"}
        </span>
      </header>

      <p className="tank-volume">{withUnit(t.volume, u.volume)}</p>
      {f && pct !== null ? (
        <>
          <div
            className="meter"
            role="meter"
            aria-label={`Tanque ${t.tank} lleno`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div className="meter-fill" style={{ width: `${f.ratio * 100}%` }} />
          </div>
          <p className="muted small">
            {pct} % de {withUnit(f.capacity, u.volume)} · vacío {withUnit(t.ullage, u.volume)}
          </p>
        </>
      ) : (
        <p className="muted small">Capacidad desconocida</p>
      )}

      <dl className="facts">
        <dt>Altura</dt>
        <dd>{withUnit(t.height, u.height, 1)}</dd>
        <dt>Temperatura</dt>
        <dd>{withUnit(t.temperature, u.temp, 1)}</dd>
        <dt>Agua (altura)</dt>
        <dd>{withUnit(t.water, u.height, 1)}</dd>
        <dt>Agua (volumen)</dt>
        <dd>{withUnit(t.water_volume, u.volume)}</dd>
        <dt>Volumen TC</dt>
        <dd>{withUnit(t.tc_volume, u.volume)}</dd>
      </dl>

      <footer className="muted small">
        Lectura {ago(t.collected_at)} · hora consola {consoleTime(t.console_time)}
        {/* Raw status word from 201; its bits are not interpreted. */}
        {t.status ? ` · estado ${t.status}` : ""}
      </footer>
    </article>
  );
}
