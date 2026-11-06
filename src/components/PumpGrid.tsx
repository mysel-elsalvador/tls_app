"use client";

import { useState } from "react";
import { Segmented } from "@/components/Segmented";
import { num, voxTime } from "@/lib/format";
import type { CloseSummary, CloseType } from "@/lib/types";

type Metric = "volume" | "amount";
const ALL = "all";
/** The latest n closes (or all loaded), or a fixed Desde/Hasta range by id. */
type Selection = { kind: "last"; n: number | typeof ALL } | { kind: "range"; from: string; to: string };

/**
 * Wear levels, by a pump's sales against the station's average pump (the
 * total split evenly over every pump, idle ones too). Relative, so 4 pumps
 * and 12 pumps read the same way.
 */
const HIGH = 1.25;
const VERY_HIGH = 2;
type Level = "normal" | "high" | "very-high" | "idle" | "unknown";
const LEVEL_NAME: Record<Level, string> = {
  normal: "Normal",
  high: "Alto",
  "very-high": "Muy alto",
  idle: "Sin ventas",
  unknown: "Sin dato",
};

interface Hose {
  hose: string | null;
  product: string | null;
  amount: number | null;
  volume: number | null;
}
interface Pump {
  pump: number;
  amount: number | null;
  volume: number | null;
  sold: boolean; // false: no sales row in any selected close
  hoses: Map<string, Hose>;
}

/** Null-propagating sum: an unknown part makes the total unknown. */
const add = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b);

/** Pumps over the selected closes; idle pumps count as known zeros. */
function aggregate(closes: CloseSummary[]): Map<number, Pump> {
  const out = new Map<number, Pump>();
  const get = (n: number) => {
    let p = out.get(n);
    if (!p) out.set(n, (p = { pump: n, amount: 0, volume: 0, sold: false, hoses: new Map() }));
    return p;
  };
  for (const c of closes) {
    for (const n of c.idle_pumps ?? []) get(n);
    for (const r of c.pumps ?? []) {
      const p = get(r.pump);
      p.sold = true;
      p.amount = add(p.amount, r.amount);
      p.volume = add(p.volume, r.volume);
      for (const h of r.hoses) {
        const k = `${h.hose ?? ""}|${h.product ?? ""}`;
        const prev = p.hoses.get(k);
        p.hoses.set(
          k,
          prev
            ? { ...prev, amount: add(prev.amount, h.amount), volume: add(prev.volume, h.volume) }
            : { ...h },
        );
      }
    }
  }
  return out;
}

/**
 * How busy each pump (dispenser) was: one square per pump, 6 per row, colored
 * by its share of the sales against the station's average pump. A pump with
 * no sales is its own state (it may be out of service), never "low".
 */
export function PumpGrid({ closes, type }: { closes: CloseSummary[]; type: CloseType }) {
  const [metric, setMetric] = useState<Metric>("volume");
  // Presets follow new closes and "Cargar más"; a Desde/Hasta range is fixed.
  const [sel, setSel] = useState<Selection>({ kind: "last", n: 1 });
  const [open, setOpen] = useState<number | null>(null);

  const what = type === "T" ? "turno" : "día";
  const whats = type === "T" ? "turnos" : "días";
  const n = closes.length;
  // Indexes into closes (latest first): lo = newest, hi = oldest of the range.
  // A close that left the refreshed first page falls back to the latest.
  const at = (id: string) => Math.max(0, closes.findIndex((c) => c.id === id));
  const [lo, hi] =
    sel.kind === "last"
      ? [0, Math.min(n, sel.n === ALL ? n : sel.n) - 1]
      : [Math.min(at(sel.from), at(sel.to)), Math.max(at(sel.from), at(sel.to))];
  const inRange = closes.slice(lo, hi + 1);
  const selected = inRange.filter((c) => (c.pumps?.length ?? 0) + (c.idle_pumps?.length ?? 0) > 0);
  const skipped = inRange.length - selected.length;
  const oldest = closes[hi];
  const newest = closes[lo];
  const preset = sel.kind === "last" ? String(sel.n) : "";
  const setRange = (from: number, to: number) => {
    setSel({ kind: "range", from: closes[from]!.id, to: closes[to]!.id });
    setOpen(null);
  };

  const pumps = [...aggregate(selected).values()].sort((a, b) => a.pump - b.pump);
  const value = (p: Pump) => p[metric];
  const known = pumps.map(value).filter((v): v is number => v !== null);
  const complete = known.length === pumps.length;
  // An unknown pump would understate the total: fall back to the closes' totals.
  const closeTotal = selected.reduce<number | null>(
    (a, c) => add(a, metric === "volume" ? c.total_volume : c.total_amount),
    0,
  );
  const total = complete ? known.reduce((a, b) => a + b, 0) : closeTotal;
  const avg = total !== null && pumps.length ? total / pumps.length : null;

  const level = (p: Pump): Level => {
    if (!p.sold) return "idle";
    const v = value(p);
    if (v === null || avg === null) return "unknown";
    if (v <= 0) return "idle";
    const r = avg > 0 ? v / avg : 0;
    return r >= VERY_HIGH ? "very-high" : r >= HIGH ? "high" : "normal";
  };
  const share = (p: Pump) => {
    const v = value(p);
    return v === null || !total ? null : (v / total) * 100;
  };
  const fmt = (v: number | null) => (metric === "amount" ? `$${num(v, 2)}` : `${num(v, 2)} gal`);
  const op = open === null ? undefined : pumps.find((p) => p.pump === open);

  return (
    <>
      <div className="toolbar">
        <Segmented
          label={`Rango de ${whats}`}
          value={preset}
          options={[
            ["1", `Último ${what}`],
            ...(n > 7 ? [["7", `Últimos 7`] as [string, string]] : []),
            [ALL, `Todos (${n})`],
          ]}
          onChange={(v) => {
            setSel({ kind: "last", n: v === ALL ? ALL : Number(v) });
            setOpen(null);
          }}
        />
        {/* Desde lists openings, Hasta closings; both over the loaded closes. */}
        <label className="field-inline">
          <span className="muted small">Desde</span>
          <select value={hi} onChange={(e) => setRange(Number(e.target.value), lo)}>
            {closes.map((c, i) => (
              <option key={c.id} value={i}>
                {voxTime(c.opened_at)}
              </option>
            ))}
          </select>
        </label>
        <label className="field-inline">
          <span className="muted small">Hasta</span>
          <select value={lo} onChange={(e) => setRange(hi, Number(e.target.value))}>
            {closes.map((c, i) => (
              <option key={c.id} value={i}>
                {voxTime(c.closed_at)}
              </option>
            ))}
          </select>
        </label>
        <Segmented
          label="Medida"
          value={metric}
          options={[
            ["volume", "Galones"],
            ["amount", "Monto ($)"],
          ]}
          onChange={(v) => setMetric(v as Metric)}
        />
      </div>
      <div className="card">
        <h3 className="chart-title">
          Uso de surtidores {inRange.length === 1 ? `del ${what}` : `en ${inRange.length} ${whats}`}
        </h3>
        {oldest && newest && (
          <p className="muted small">
            {voxTime(oldest.opened_at)} → {voxTime(newest.closed_at)}
          </p>
        )}
        {pumps.length === 0 ? (
          <p className="muted small chart-empty">
            {inRange.length > 1 ? "Estos cierres no tienen" : "Este cierre no tiene"} ventas por surtidor.
          </p>
        ) : (
          <>
            <div className="pump-grid" role="group" aria-label="Surtidores">
              {pumps.map((p) => {
                const l = level(p);
                const s = share(p);
                return (
                  <button
                    key={p.pump}
                    type="button"
                    className={`pump pump-${l}`}
                    aria-pressed={open === p.pump}
                    aria-label={`Surtidor ${p.pump}: ${LEVEL_NAME[l]}${s !== null && p.sold ? `, ${num(s, 0)}% de las ventas` : ""}`}
                    onClick={() => setOpen(open === p.pump ? null : p.pump)}
                  >
                    <span className="pump-num">{p.pump}</span>
                    {p.sold && s !== null && <span className="pump-share">{num(s, s < 10 ? 1 : 0)}%</span>}
                    <span className="pump-level">{LEVEL_NAME[l]}</span>
                  </button>
                );
              })}
            </div>
            <ul className="chart-legend pump-legend" aria-label="Niveles de uso">
              <li><i className="swatch pump-normal" aria-hidden="true" />Normal: menos de {num(HIGH, 2)}× el promedio</li>
              <li><i className="swatch pump-high" aria-hidden="true" />Alto: {num(HIGH, 2)}× a {num(VERY_HIGH, 0)}×</li>
              <li><i className="swatch pump-very-high" aria-hidden="true" />Muy alto: {num(VERY_HIGH, 0)}× o más</li>
              <li><i className="swatch pump-idle" aria-hidden="true" />Sin ventas</li>
            </ul>
            {op && <PumpDetail p={op} level={level(op)} share={share(op)} avg={avg} fmt={fmt} metric={metric} />}
          </>
        )}
        <p className="muted small">
          {avg !== null && pumps.length > 0 && `Promedio por surtidor: ${fmt(avg)} (total ${fmt(total)} entre ${pumps.length} surtidores). `}
          El porcentaje es la parte de las ventas del período que despachó cada surtidor. Toque un surtidor para ver sus
          mangueras.
          {skipped > 0 && ` ${skipped} cierres sin ventas por surtidor no se incluyen.`}
          {` Desde y Hasta eligen entre los ${whats} cargados; «Cargar más» agrega anteriores.`}
        </p>
      </div>
    </>
  );
}

function PumpDetail({
  p,
  level,
  share,
  avg,
  fmt,
  metric,
}: {
  p: Pump;
  level: Level;
  share: number | null;
  avg: number | null;
  fmt: (v: number | null) => string;
  metric: Metric;
}) {
  const v = p[metric];
  const ratio = v !== null && avg ? v / avg : null;
  const hoses = [...p.hoses.values()].sort((a, b) => (a.hose ?? "").localeCompare(b.hose ?? ""));
  return (
    <section className="pump-detail" aria-live="polite">
      <h4>
        Surtidor {p.pump}: {LEVEL_NAME[level]}
      </h4>
      {p.sold ? (
        <p className="small">
          {fmt(v)}
          {share !== null && ` · ${num(share, 1)}% de las ventas`}
          {ratio !== null && ` · ${num(ratio, 2)}× el promedio`}
        </p>
      ) : (
        <p className="small muted">
          No despachó en el período: aparece en los totalizadores del VOX pero no tiene ventas. Puede estar fuera de
          servicio.
        </p>
      )}
      {hoses.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Manguera</th>
                <th>Producto</th>
                <th className="right">Galones</th>
                <th className="right">Monto ($)</th>
              </tr>
            </thead>
            <tbody>
              {hoses.map((h) => (
                <tr key={`${h.hose ?? ""}|${h.product ?? ""}`}>
                  <td>{h.hose ? `${p.pump}${h.hose}` : "—"}</td>
                  <td>{h.product ?? "—"}</td>
                  <td className="num right">{num(h.volume, 2)}</td>
                  <td className="num right">{num(h.amount, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
