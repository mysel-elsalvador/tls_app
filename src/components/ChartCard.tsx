"use client";

import { type KeyboardEvent, type PointerEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { fill, pointTime, productName, tickLabel, withUnit } from "@/lib/format";
import type { Tank, TankHistory } from "@/lib/types";

// Plot geometry, in px. Width follows the card; height is fixed.
const HEIGHT = 200;
const M = { top: 10, right: 14, bottom: 24, left: 52 };
// Readings closer than this never break the line, whatever the interval.
const MIN_GAP_MS = 15 * 60_000;

interface Point {
  at: number;
  volume: number;
  height: number | null;
}

/** Product volume of one tank over the window [from, to] (agent time). */
export function ChartCard({
  t,
  h,
  from,
  to,
}: {
  t: Tank;
  h: TankHistory | undefined;
  from: string;
  to: string;
}) {
  const u = h?.units ?? t.units ?? {};
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const [hover, setHover] = useState<number | null>(null);

  // Readings without a volume are left out; the gap they leave breaks the line.
  const points = useMemo<Point[]>(
    () =>
      (h?.points ?? []).flatMap(([at, height, volume]) =>
        volume === null ? [] : [{ at: Date.parse(at), volume, height }],
      ),
    [h],
  );
  // Top of the tank from the latest reading (volume + ullage); null if unknown.
  const capacity = fill(t)?.capacity ?? null;

  const x0 = Date.parse(from);
  const x1 = Date.parse(to);
  const plotW = Math.max(1, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;
  const yTicks = niceTicks(Math.max(0, capacity ?? 0, ...points.map((p) => p.volume)));
  const yMax = yTicks[yTicks.length - 1]!;
  const x = (ms: number) => M.left + ((ms - x0) / (x1 - x0)) * plotW;
  const y = (v: number) => M.top + plotH - (v / yMax) * plotH;

  const segments = splitAtGaps(points);
  const base = y(0);
  const line = segments.map((s) => s.map((p, i) => `${i ? "L" : "M"}${x(p.at)},${y(p.volume)}`).join("")).join("");
  const area = segments
    .filter((s) => s.length > 1)
    .map((s) => `M${x(s[0]!.at)},${base}` + s.map((p) => `L${x(p.at)},${y(p.volume)}`).join("") + `L${x(s[s.length - 1]!.at)},${base}Z`)
    .join("");

  const last = points[points.length - 1];
  const hp = hover === null ? undefined : points[hover];
  const min = points.length ? Math.min(...points.map((p) => p.volume)) : null;
  const max = points.length ? Math.max(...points.map((p) => p.volume)) : null;

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ms = x0 + ((e.clientX - r.left - M.left) / plotW) * (x1 - x0);
    setHover(nearest(points, ms));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const n = points.length - 1;
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
    <article className="card tank">
      <header className="tank-head">
        <h3>Tanque {t.tank}</h3>
        <span className="muted">
          {productName(t)}
        </span>
      </header>
      <p className="tank-volume">
        {withUnit(t.volume, u.volume)} <span className="muted small">volumen actual</span>
      </p>

      <div className="chart" ref={wrap}>
        {points.length === 0 ? (
          <p className="muted small chart-empty">Sin lecturas de volumen en este período.</p>
        ) : (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            tabIndex={0}
            aria-label={`Volumen del producto, tanque ${t.tank}: de ${withUnit(points[0]!.volume, u.volume)} a ${withUnit(last!.volume, u.volume)}${capacity !== null ? `, capacidad ${withUnit(capacity, u.volume)}` : ""}. Use las flechas para recorrer las lecturas.`}
            onPointerMove={onPointer}
            onPointerLeave={() => setHover(null)}
            onKeyDown={onKey}
            onFocus={() => setHover(points.length - 1)}
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
            {timeTicks(x0, x1).map((ms) => (
              <text key={ms} className="chart-tick" x={x(ms)} y={HEIGHT - 6} textAnchor="middle">
                {tickLabel(ms)}
              </text>
            ))}
            {capacity !== null && (
              <g>
                <line className="chart-capacity" x1={M.left} x2={M.left + plotW} y1={y(capacity)} y2={y(capacity)} />
                <text className="chart-tick" x={M.left + plotW} y={y(capacity) - 4} textAnchor="end">
                  Capacidad {withUnit(capacity, u.volume)}
                </text>
              </g>
            )}
            <path className="chart-area" d={area} />
            <path className="chart-line" d={line} />
            {/* Readings with no neighbour on either side would be invisible as a line. */}
            {segments
              .filter((s) => s.length === 1)
              .map((s) => (
                <circle key={s[0]!.at} className="chart-lone" cx={x(s[0]!.at)} cy={y(s[0]!.volume)} r={2} />
              ))}
            {hp ? (
              <>
                <line className="chart-cross" x1={x(hp.at)} x2={x(hp.at)} y1={M.top} y2={base} />
                <circle className="chart-dot" cx={x(hp.at)} cy={y(hp.volume)} r={4} />
              </>
            ) : (
              <circle className="chart-dot" cx={x(last!.at)} cy={y(last!.volume)} r={4} />
            )}
          </svg>
        )}
        {hp && (
          <div
            className="chart-tip"
            style={x(hp.at) > width / 2 ? { right: width - x(hp.at) + 8 } : { left: x(hp.at) + 8 }}
            aria-live="polite"
          >
            <strong>{withUnit(hp.volume, u.volume)}</strong>
            <span>{withUnit(hp.height, u.height, 1)}</span>
            <span className="muted">{pointTime(hp.at)}</span>
          </div>
        )}
      </div>

      {min !== null && max !== null && (
        <p className="muted small">
          Volumen del producto ({u.volume ?? "sin unidad"}) · mín {withUnit(min, u.volume)} · máx{" "}
          {withUnit(max, u.volume)} · {points.length.toLocaleString("es-SV")} lecturas
        </p>
      )}
    </article>
  );
}

export function useWidth(ref: RefObject<HTMLDivElement | null>): number {
  const [w, setW] = useState(400);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/**
 * Splits where readings are missing: a gap longer than 3× the usual interval
 * (the median, so a few gaps do not raise it), never less than MIN_GAP_MS.
 * A line across an outage would invent the level in between.
 */
function splitAtGaps(points: Point[]): Point[][] {
  if (!points.length) return [];
  const diffs = points.slice(1).map((p, i) => p.at - points[i]!.at).sort((a, b) => a - b);
  const median = diffs.length ? diffs[Math.floor(diffs.length / 2)]! : 0;
  const gap = Math.max(MIN_GAP_MS, 3 * median);
  const out: Point[][] = [[points[0]!]];
  for (let i = 1; i < points.length; i++) {
    if (points[i]!.at - points[i - 1]!.at > gap) out.push([]);
    out[out.length - 1]!.push(points[i]!);
  }
  return out;
}

/** Index of the point closest in time to `ms` (points are sorted). */
function nearest(points: Point[], ms: number): number {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.at < ms) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 && ms - points[lo - 1]!.at < points[lo]!.at - ms ? lo - 1 : lo;
}

/**
 * 0 up to a round value at or above `max`, in 4-6 round steps
 * (10,170 -> 0, 2,500 … 12,500).
 */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
  const ticks: number[] = [];
  for (let v = 0; v < max && ticks.length < 12; v += step) ticks.push(Number(v.toFixed(6)));
  ticks.push(Number((ticks.length * step).toFixed(6)));
  return ticks;
}

/** Local-time ticks on whole hours: every 4 h up to a day, 8 h up to two, else midnights. */
function timeTicks(from: number, to: number): number[] {
  const hours = (to - from) / 3600_000;
  const step = hours <= 24 ? 4 : hours <= 48 ? 8 : 24;
  const d = new Date(from);
  d.setMinutes(0, 0, 0);
  while (d.getTime() < from || d.getHours() % step !== 0) d.setHours(d.getHours() + 1);
  const out: number[] = [];
  // Skip ticks too close to the edges for their label to fit.
  const margin = (to - from) * 0.03;
  for (; d.getTime() <= to; d.setHours(d.getHours() + step)) {
    if (d.getTime() - from >= margin && to - d.getTime() >= margin) out.push(d.getTime());
  }
  return out;
}
