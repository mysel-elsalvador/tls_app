"use client";

import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { niceTicks, useWidth } from "@/components/ChartCard";
import { Segmented } from "@/components/Segmented";
import { num, voxShort, voxTime } from "@/lib/format";
import type { CloseSummary, CloseType } from "@/lib/types";

// Plot geometry, in px. Width follows the container; height is fixed.
const HEIGHT = 220;
const M = { top: 12, right: 12, bottom: 26, left: 64 };
const MAX_BAR = 32;

type Metric = "amount" | "volume";

/**
 * One bar per close, oldest on the left, so consecutive shifts (or days) can
 * be compared. One measure at a time: amount and gallons never share an axis.
 * A close without the total has no bar (never drawn as 0).
 */
export function CloseChart({ closes, type }: { closes: CloseSummary[]; type: CloseType }) {
  const [metric, setMetric] = useState<Metric>("amount");
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const [hover, setHover] = useState<number | null>(null);

  const rows = [...closes].reverse();
  const value = (c: CloseSummary) => (metric === "amount" ? c.total_amount : c.total_volume);
  const vals = rows.map(value).filter((v): v is number => v !== null);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

  const yTicks = niceTicks(Math.max(0, ...vals));
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
  const what = type === "T" ? "turno" : "día";

  const hp = hover === null ? undefined : rows[hover];

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
      </div>
      <div className="card">
        <h3 className="chart-title">
          {metric === "amount" ? "Monto vendido" : "Galones vendidos"} por {what}
        </h3>
        <div className="chart" ref={wrap}>
          {vals.length === 0 ? (
            <p className="muted small chart-empty">Estos cierres no tienen totales.</p>
          ) : (
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              tabIndex={0}
              aria-label={`${metric === "amount" ? "Monto" : "Galones"} por ${what}, ${rows.length} cierres del ${label(rows[0]!)} al ${label(rows[rows.length - 1]!)}${avg !== null ? `, promedio ${fmt(avg)}` : ""}. Use las flechas para recorrer los cierres.`}
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
              {rows.map((c, i) => {
                const v = value(c);
                if (v === null || v <= 0) return null;
                return (
                  <path
                    key={c.id}
                    className={`chart-bar${hover !== null && hover !== i ? " chart-bar-dim" : ""}`}
                    d={bar(cx(i) - barW / 2, cx(i) + barW / 2, y(v), base)}
                  />
                );
              })}
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
              <strong>{value(hp) === null ? "Sin total" : fmt(value(hp))}</strong>
              <span>
                {metric === "amount" ? `${num(hp.total_volume, 2)} gal` : `$${num(hp.total_amount, 2)}`}
                {hp.dispatch_count !== null && ` · ${hp.dispatch_count} despachos`}
              </span>
              <span className="muted">
                {voxTime(hp.opened_at)} → {voxTime(hp.closed_at)}
              </span>
            </div>
          )}
        </div>
        <p className="muted small">
          {rows.length} cierres, del más antiguo (izquierda) al más reciente, por fecha de apertura del VOX ({unit}).
          «Cargar más» agrega cierres anteriores.
        </p>
      </div>
    </>
  );
}

/** A bar from the baseline up to `top`, its data end rounded (4px). */
function bar(x0: number, x1: number, top: number, base: number): string {
  const r = Math.min(4, (x1 - x0) / 2, base - top);
  return `M${x0},${base}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x1 - r}Q${x1},${top} ${x1},${top + r}V${base}Z`;
}
