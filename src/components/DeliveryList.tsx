"use client";

import { useState } from "react";
import { consoleTime, productName, withUnit } from "@/lib/format";
import type { Delivery } from "@/lib/types";

const SHOWN = 10;

/**
 * Latest deliveries. Tank deliveries whose console time windows overlap are
 * one entry (one truck dropping into several tanks); opening it shows each
 * tank before and after.
 */
export function DeliveryList({ deliveries }: { deliveries: Delivery[] }) {
  const [all, setAll] = useState(false);
  if (deliveries.length === 0)
    return <p className="muted">Sin entregas registradas.</p>;
  const groups = groupOverlapping(deliveries);
  const shown = all ? groups : groups.slice(0, SHOWN);
  return (
    <>
      <div className="deliveries">
        {shown.map((g) => {
          const unit = g[0]!.units?.volume;
          const total = sum(g.map(increase));
          // Tanks are in tank order, so the group's start is the earliest of them.
          const start = g
            .map((d) => d.start_time)
            .reduce((a, b) => (a < b ? a : b));
          const end = latestEnd(g);
          return (
            <details key={`${start}-${g[0]!.tank}`} className="delivery">
              <summary>
                <span className="num">
                  {consoleTime(start)}
                  {end ? ` – ${consoleTime(end).slice(11)}` : ""}
                </span>
                <span className="muted">
                  {g.length === 1
                    ? `Tanque ${g[0]!.tank}`
                    : `Tanques ${g.map((d) => d.tank).join(", ")}`}
                </span>
                <strong className="num">
                  {total === null ? "—" : `+${withUnit(total, unit)}`}
                </strong>
              </summary>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tanque</th>
                      <th>Producto</th>
                      <th>Hora (consola)</th>
                      <th className="right">Antes</th>
                      <th className="right">Después</th>
                      <th className="right">Aumento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withProductTotals(g).map((row, i) => {
                      if ("total" in row)
                        return (
                          <tr key={i} className="delivery-total">
                            <td colSpan={5}>TOTAL {row.product}</td>
                            <td className="num right">
                              <strong>
                                {row.total === null
                                  ? "—"
                                  : `+${withUnit(row.total, unit)}`}
                              </strong>
                            </td>
                          </tr>
                        );
                      const d = row;
                      const u = d.units ?? {};
                      const inc = increase(d);
                      return (
                        <tr key={i}>
                          <td>{d.tank}</td>
                          <td>{productName(d)}</td>
                          <td className="num">
                            {consoleTime(d.start_time).slice(11)}
                            {d.end_time
                              ? ` – ${consoleTime(d.end_time).slice(11)}`
                              : ""}
                          </td>
                          <td className="num right">
                            {withUnit(d.start_volume, u.volume)}
                            <Height v={d.start_height} unit={u.height} />
                          </td>
                          <td className="num right">
                            {withUnit(d.end_volume, u.volume)}
                            <Height v={d.end_height} unit={u.height} />
                          </td>
                          <td className="num right">
                            <strong>
                              {inc === null
                                ? "—"
                                : `+${withUnit(inc, u.volume)}`}
                            </strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>
      {groups.length > SHOWN && (
        <p>
          <button
            type="button"
            className="link-button"
            onClick={() => setAll(!all)}
          >
            {all ? "Mostrar menos" : `Mostrar todas (${groups.length})`}
          </button>
        </p>
      )}
      <p className="muted small">
        Antes y después según la consola, en hora de la consola. El aumento es
        después − antes: puede diferir de la factura si hubo ventas durante la
        descarga.
      </p>
    </>
  );
}

function Height({ v, unit }: { v: number | null; unit: string | undefined }) {
  if (v === null) return null;
  return <span className="muted small block">{withUnit(v, unit, 1)}</span>;
}

/** End volume − start volume; null if either is unknown. */
function increase(d: Delivery): number | null {
  return d.start_volume === null || d.end_volume === null
    ? null
    : d.end_volume - d.start_volume;
}

/** Sum of the known values; null if none is known. */
function sum(vs: (number | null)[]): number | null {
  const known = vs.filter((v): v is number => v !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

/**
 * The product a tank holds, ignoring the tank number in its label:
 * "POWER PLUS 1" and "power plus 2" are both "POWER PLUS". Without a label,
 * tanks with the same product code are the same product. Null = unknown.
 */
function productFamily(d: Delivery): string | null {
  const label = d.product_label?.trim().replace(/\s+\d+$/, "").replace(/\s+/g, " ");
  if (label) return label.toUpperCase();
  return d.product_code ? `Producto ${d.product_code}` : null;
}

type Row = Delivery | { product: string; total: number | null };

/**
 * The group's tanks plus, right after the last tank of each product that
 * received in more than one tank, a row with that product's total increase.
 */
export function withProductTotals(g: Delivery[]): Row[] {
  const byProduct = new Map<string, Delivery[]>();
  for (const d of g) {
    const p = productFamily(d);
    if (p) byProduct.set(p, [...(byProduct.get(p) ?? []), d]);
  }
  const rows: Row[] = [];
  for (const d of g) {
    rows.push(d);
    const p = productFamily(d);
    const same = p ? byProduct.get(p)! : [];
    if (p && same.length > 1 && same[same.length - 1] === d)
      rows.push({ product: p, total: sum(same.map(increase)) });
  }
  return rows;
}

function latestEnd(g: Delivery[]): string | null {
  const ends = g.map((d) => d.end_time).filter((e): e is string => e !== null);
  return ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null;
}

/**
 * Groups deliveries whose [start, end] overlap, latest group first, tanks in
 * order within a group. A delivery without an end time is just its start.
 * Console times are ISO-like strings without a zone, so they compare as text.
 */
export function groupOverlapping(deliveries: Delivery[]): Delivery[][] {
  const sorted = [...deliveries].sort((a, b) =>
    a.start_time < b.start_time
      ? -1
      : a.start_time > b.start_time
        ? 1
        : a.tank - b.tank,
  );
  const groups: Delivery[][] = [];
  let groupEnd = "";
  for (const d of sorted) {
    const end =
      d.end_time && d.end_time > d.start_time ? d.end_time : d.start_time;
    if (groups.length && d.start_time <= groupEnd) {
      groups[groups.length - 1]!.push(d);
      if (end > groupEnd) groupEnd = end;
    } else {
      groups.push([d]);
      groupEnd = end;
    }
  }
  for (const g of groups) g.sort((a, b) => a.tank - b.tank);
  return groups.reverse();
}
