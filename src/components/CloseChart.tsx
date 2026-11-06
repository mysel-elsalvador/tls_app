"use client";

import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { niceTicks, useWidth } from "@/components/ChartCard";
import { Segmented } from "@/components/Segmented";
import { type Fuel, fuelOf, num, voxShort, voxTime } from "@/lib/format";
import type { CloseSummary, CloseType } from "@/lib/types";

// Plot geometry, in px. Width follows the container; height is fixed.
const HEIGHT = 220;
const M = { top: 12, right: 12, bottom: 26, left: 64 };
const MAX_BAR = 32;
const GAP = 2; // surface gap between stacked segments

type Metric = "amount" | "volume";
const ALL = "all";

/** One close's sales per fuel (Power Plus 1 + 2 = Power Plus); null: unknown. */
function byFuel(c: CloseSummary, metric: Metric): Map<string, number | null> {
  const m = new Map<string, number | null>();
  for (const p of c.products ?? []) {
    const k = fuelOf(p.product).key;
    const v = p[metric];
    const prev = m.get(k);
    m.set(k, prev === undefined ? v : prev === null || v === null ? null : prev + v);
  }
  return m;
}

/**
 * One bar per close, oldest on the left, so consecutive shifts (or days) can
 * be compared. One measure at a time: amount and gallons never share an axis.
 * "Todo" stacks the fuels sold (from the close's sales by product), one fuel
 * shows only its bars. A close without the value has no bar (never drawn as
 * 0); one without a breakdown by product is drawn whole, in gray.
 */
export function CloseChart({ closes, type }: { closes: CloseSummary[]; type: CloseType }) {
  const [metric, setMetric] = useState<Metric>("amount");
  const [product, setProduct] = useState<string>(ALL);
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const [hover, setHover] = useState<number | null>(null);

  const rows = [...closes].reverse();
  const per = rows.map((c) => byFuel(c, metric));
  // Fuels of all loaded closes, so a fuel keeps its place and color.
  const found = new Map<string, Fuel>();
  for (const c of rows) for (const p of c.products ?? []) {
    const f = fuelOf(p.product);
    found.set(f.key, f);
  }
  const fuels = [...found.values()].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  const sel = fuels.find((f) => f.key === product) ?? null; // null: all

  const total = (c: CloseSummary) => (metric === "amount" ? c.total_amount : c.total_volume);
  /** Stacked segments, bottom first; null when the breakdown is missing or incomplete. */
  const segs = (i: number) => {
    const m = per[i]!;
    if (m.size === 0) return null;
    const out: { f: Fuel; v: number }[] = [];
    for (const f of fuels) {
      if (!m.has(f.key)) continue;
      const v = m.get(f.key)!;
      if (v === null) return null;
      out.push({ f, v });
    }
    return out;
  };
  const value = (i: number): number | null =>
    sel ? (per[i]!.get(sel.key) ?? null) : total(rows[i]!);
  const top = (i: number): number | null => {
    if (sel) return value(i);
    const s = segs(i);
    const sum = s ? s.reduce((a, x) => a + x.v, 0) : null;
    const t = total(rows[i]!);
    return t === null ? sum : sum === null ? t : Math.max(t, sum);
  };

  const vals = rows.map((_, i) => value(i)).filter((v): v is number => v !== null);
  const tops = rows.map((_, i) => top(i)).filter((v): v is number => v !== null);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

  const yTicks = niceTicks(Math.max(0, ...tops));
  const yMax = yTicks[yTicks.length - 1]!;
  const plotW = Math.max(1, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;
  const band = plotW / Math.max(1, rows.length);
  const barW = Math.max(1, Math.min(MAX_BAR, band * 0.7, band - 2));
  const y = (v: number) => M.top + plotH - (v / yMax) * plotH;
  const cx = (i: number) => M.left + band * (i + 0.5);
  const base = y(0);
  // Every k-th label, counted from the latest close so it is always labeled.
  const labelW = type === "T" ? 74 : 42;
  const k = Math.max(1, Math.ceil(labelW / band));
  const label = (c: CloseSummary) => voxShort(c.opened_at, type === "T");
  const unit = metric === "amount" ? "$" : "gal";
  const fmt = (v: number | null) => (metric === "amount" ? `$${num(v, 2)}` : `${num(v, 2)} gal`);
  const pct = (v: number, of: number) => (of > 0 ? ` · ${Math.round((v / of) * 100)}%` : "");
  const what = type === "T" ? "turno" : "día";
  const measure = metric === "amount" ? "Monto vendido" : "Galones vendidos";

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - M.left) / band);
    setHover(i >= 0 && i < rows.length ? i : null);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const n = rows.length - 1;
    const i = hover ?? n;
    const next =
      e.key === "ArrowLeft" ? Math.max(0, i - 1)
      : e.key === "ArrowRight" ? Math.min(n, i + 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? n
      : null;
    if (next === null) return;
    e.preventDefault();
    setHover(next);
  };

  /** The bar of close i: stacked fuels, one fuel, or the whole total in gray. */
  const drawBar = (i: number) => {
    const x0 = cx(i) - barW / 2;
    const x1 = cx(i) + barW / 2;
    const dim = hover !== null && hover !== i ? " chart-bar-dim" : "";
    if (sel) {
      const v = value(i);
      if (v === null || v <= 0) return null;
      return <path key={i} className={`chart-bar${dim}`} style={{ fill: sel.color }} d={bar(x0, x1, y(v), base)} />;
    }
    const s = segs(i)?.filter((x) => x.v > 0);
    if (!s || s.length === 0) {
      const v = total(rows[i]!);
      if (v === null || v <= 0) return null;
      return <path key={i} className={`chart-bar chart-bar-unsplit${dim}`} d={bar(x0, x1, y(v), base)} />;
    }
    let cum = 0;
    return (
      <g key={i}>
        {s.map(({ f, v }, j) => {
          const b = y(cum);
          cum += v;
          const t = y(cum);
          // The gap sits under every segment but the first, when there is room.
          const bb = j > 0 && b - t > GAP + 1 ? b - GAP : b;
          const d = j === s.length - 1 ? bar(x0, x1, t, bb) : `M${x0},${bb}V${t}H${x1}V${bb}Z`;
          return <path key={f.key} className={`chart-bar${dim}`} style={{ fill: f.color }} d={d} />;
        })}
      </g>
    );
  };

  const tip = (i: number) => {
    const c = rows[i]!;
    const t = total(c);
    const when = (
      <span className="muted">
        {voxTime(c.opened_at)} → {voxTime(c.closed_at)}
      </span>
    );
    if (sel) {
      const v = value(i);
      return (
        <>
          <strong>{v === null ? `Sin dato de ${sel.name}` : fmt(v)}</strong>
          <span>
            {sel.name}
            {v !== null && t !== null && pct(v, t)} del total {fmt(t)}
          </span>
          {when}
        </>
      );
    }
    const s = segs(i);
    return (
      <>
        <strong>{t === null ? "Sin total" : fmt(t)}</strong>
        <span>
          {metric === "amount" ? `${num(c.total_volume, 2)} gal` : `$${num(c.total_amount, 2)}`}
          {c.dispatch_count !== null && ` · ${c.dispatch_count} despachos`}
        </span>
        {s && s.length > 1
          ? [...s].reverse().map(({ f, v }) => (
              <span key={f.key} className="chart-tip-row">
                <i className="swatch" style={{ background: f.color }} aria-hidden="true" />
                {f.name}: {fmt(v)}
                {pct(v, s.reduce((a, x) => a + x.v, 0))}
              </span>
            ))
          : !s && <span className="muted">Sin desglose por producto</span>}
        {when}
      </>
    );
  };

  const hp = hover === null ? undefined : rows[hover];
  const stacked = !sel && fuels.length > 1;

  return (
    <>
      <div className="toolbar">
        <Segmented
          label="Medida"
          value={metric}
          options={[
            ["amount", "Monto ($)"],
            ["volume", "Galones"],
          ]}
          onChange={(v) => setMetric(v as Metric)}
        />
        {fuels.length > 1 && (
          <Segmented
            label="Producto"
            value={sel ? sel.key : ALL}
            options={[[ALL, "Todo"], ...fuels.map((f): [string, string] => [f.key, f.name])]}
            onChange={setProduct}
          />
        )}
      </div>
      <div className="card">
        <h3 className="chart-title">
          {measure}
          {sel && ` de ${sel.name}`} por {what}
        </h3>
        {stacked && (
          <ul className="chart-legend" aria-label="Productos">
            {[...fuels].reverse().map((f) => (
              <li key={f.key}>
                <i className="swatch" style={{ background: f.color }} aria-hidden="true" />
                {f.name}
              </li>
            ))}
          </ul>
        )}
        <div className="chart" ref={wrap}>
          {vals.length === 0 ? (
            <p className="muted small chart-empty">
              {sel ? `Estos cierres no tienen ventas de ${sel.name}.` : "Estos cierres no tienen totales."}
            </p>
          ) : (
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              tabIndex={0}
              aria-label={`${measure}${sel ? ` de ${sel.name}` : stacked ? `, por producto (${fuels.map((f) => f.name).join(", ")})` : ""} por ${what}, ${rows.length} cierres del ${label(rows[0]!)} al ${label(rows[rows.length - 1]!)}${avg !== null ? `, promedio ${fmt(avg)}` : ""}. Use las flechas para recorrer los cierres.`}
              onPointerMove={onPointer}
              onPointerLeave={() => setHover(null)}
              onKeyDown={onKey}
              onFocus={() => setHover(rows.length - 1)}
              onBlur={() => setHover(null)}
            >
              {yTicks.map((v) => (
                <g key={v}>
                  <line className="chart-grid" x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} />
                  <text className="chart-tick" x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end">
                    {v.toLocaleString("es-SV")}
                  </text>
                </g>
              ))}
              {rows.map((c, i) =>
                (rows.length - 1 - i) % k === 0 ? (
                  <text key={c.id} className="chart-tick" x={cx(i)} y={HEIGHT - 6} textAnchor="middle">
                    {label(c)}
                  </text>
                ) : null,
              )}
              {rows.map((_, i) => drawBar(i))}
              {avg !== null && vals.length > 1 && (
                <g>
                  <line className="chart-avg" x1={M.left} x2={M.left + plotW} y1={y(avg)} y2={y(avg)} />
                  <text className="chart-tick" x={M.left + plotW} y={y(avg) - 4} textAnchor="end">
                    Promedio {fmt(avg)}
                  </text>
                </g>
              )}
            </svg>
          )}
          {hp && (
            <div
              className="chart-tip"
              style={cx(hover!) > width / 2 ? { right: width - cx(hover!) + barW / 2 + 6 } : { left: cx(hover!) + barW / 2 + 6 }}
              aria-live="polite"
            >
              {tip(hover!)}
            </div>
          )}
        </div>
        <p className="muted small">
          {rows.length} cierres, del más antiguo (izquierda) al más reciente, por fecha de apertura del VOX ({unit}).
          {stacked && " Cada barra suma las ventas por producto del cierre."}
          {" «Cargar más» agrega cierres anteriores."}
        </p>
      </div>
    </>
  );
}

/** A bar from the baseline up to `top`, its data end rounded (4px). */
function bar(x0: number, x1: number, top: number, base: number): string {
  const r = Math.max(0, Math.min(4, (x1 - x0) / 2, base - top));
  return `M${x0},${base}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x1 - r}Q${x1},${top} ${x1},${top + r}V${base}Z`;
}
