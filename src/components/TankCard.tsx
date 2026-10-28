import { ago, consoleTime, fill, productName, withUnit } from "@/lib/format";
import type { Tank } from "@/lib/types";

/**
 * Liquid level (0..1 of the diameter) at which a circle is filled to `ratio`
 * of its area, so the gauge looks like the cross-section of a horizontal
 * cylindrical tank. Solved by bisection; the area fraction of a segment of
 * height h is (θ − sin θ) / 2π with θ = 2·acos(1 − 2h).
 */
function levelForArea(ratio: number): number {
  const r = Math.min(1, Math.max(0, ratio));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const h = (lo + hi) / 2;
    const theta = 2 * Math.acos(1 - 2 * h);
    if ((theta - Math.sin(theta)) / (2 * Math.PI) < r) lo = h;
    else hi = h;
  }
  return (lo + hi) / 2;
}

export function TankCard({ t }: { t: Tank }) {
  const u = t.units ?? {};
  const f = fill(t);
  const pct = f ? Math.round(f.ratio * 100) : null;
  return (
    <article className="card tank">
      <header className="tank-head">
        <h3>Tanque {t.tank}</h3>
        <span className="muted">
          {productName(t)}
        </span>
      </header>

      <p className="tank-volume">{withUnit(t.volume, u.volume)}</p>
      {f && pct !== null ? (
        <div className="tank-gauge">
          <div
            className="meter"
            role="meter"
            aria-label={`Tanque ${t.tank} lleno`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div className="meter-fill" style={{ height: `${levelForArea(f.ratio) * 100}%` }} />
            <span className="meter-label" aria-hidden="true">
              {pct} %
            </span>
          </div>
          <p className="muted small">
            {pct} % de {withUnit(f.capacity, u.volume)} · vacío {withUnit(t.ullage, u.volume)}
          </p>
        </div>
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
