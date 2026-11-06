"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CloseChart } from "@/components/CloseChart";
import { PumpGrid } from "@/components/PumpGrid";
import { Segmented } from "@/components/Segmented";
import { ApiFailure, apiGet, useApi } from "@/lib/api";
import { num, saleType, voxTime } from "@/lib/format";
import type {
  CloseDetail,
  ClosePage,
  CloseSummary,
  CloseTotal,
  CloseType,
  Sale,
  Totalizer,
} from "@/lib/types";

type View = "lista" | "graficas" | "surtidores";

/**
 * The station's VOX controller: latest sales and shift closes. Volumes are
 * gallons (the only unit seen at the stations so far, labeled so by the VOX).
 */
export function VoxPanel({ id }: { id: string }) {
  // Close type and view live in the URL (?cierre=dia, ?cierres=graficas|surtidores).
  const params = useSearchParams();
  const router = useRouter();
  const type: CloseType = params.get("cierre") === "dia" ? "D" : "T";
  const cierres = params.get("cierres");
  const view: View = cierres === "graficas" || cierres === "surtidores" ? cierres : "lista";
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.replace(`/station/?${next}`, { scroll: false });
  };
  return (
    <>
      <h2>Cierres</h2>
      <div className="toolbar">
        <Segmented
          label="Tipo de cierre"
          value={type}
          options={[
            ["T", "Turnos"],
            ["D", "Días"],
          ]}
          onChange={(v) => setParam("cierre", v === "D" ? "dia" : null)}
        />
        <Segmented
          label="Vista de cierres"
          value={view}
          options={[
            ["lista", "Lista"],
            ["graficas", "Gráficas"],
            ["surtidores", "Surtidores"],
          ]}
          onChange={(v) => setParam("cierres", v === "lista" ? null : v)}
        />
      </div>
      {/* Keyed by type: the pages loaded with "Cargar más" belong to one type. */}
      <CloseList key={type} id={id} type={type} view={view} />
      <p className="muted small">
        Horas del controlador VOX tal como las reporta (sin zona; su reloj puede
        no estar en hora).
      </p>
      <h2>Ventas recientes</h2>
      <SaleTable id={id} />
    </>
  );
}

function SaleTable({ id }: { id: string }) {
  const { data, error } = useApi<{ sales: Sale[] }>(`/v1/stations/${id}/sales`);
  if (!data) return <Loading error={error} what="las ventas" />;
  if (data.sales.length === 0)
    return <p className="muted">Aún no hay ventas registradas.</p>;
  return (
    <>
      {error && (
        <p className="notice">
          No se pudieron actualizar las ventas ({error.message}).
        </p>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha/hora</th>
              <th>Surtidor</th>
              <th>Manguera</th>
              <th>Producto</th>
              <th className="right">Galones</th>
              <th className="right">Monto ($)</th>
              <th className="right">Precio (PPU)</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {data.sales.map((s) => (
              <tr key={s.id}>
                <td className="num nowrap">{voxTime(s.sale_time)}</td>
                <td>{s.pump}</td>
                <td>{s.hose ?? s.hose_letter ?? "—"}</td>
                <td>
                  {s.product_name ??
                    (s.product_code ? `Producto ${s.product_code}` : "—")}
                </td>
                <td className="num right">{num(s.volume, 3)}</td>
                <td className="num right">{num(s.amount, 2)}</td>
                <td className="num right">{num(s.ppu, 3)}</td>
                <td>{saleType(s.sale_type)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Closes of one type (T shift, D day), latest first, as a table or as a
 * chart of the same closes. The first page refreshes; "Cargar más" adds
 * older pages. Once it is used, the first page it followed is kept too, so a
 * close pushed off the refreshed first page is not lost between pages.
 */
function CloseList({
  id,
  type,
  view,
}: {
  id: string;
  type: CloseType;
  view: View;
}) {
  const router = useRouter();
  const path = `/v1/stations/${id}/closes?type=${type}`;
  const first = useApi<ClosePage>(path);
  const [older, setOlder] = useState<{
    rows: CloseSummary[];
    next: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [moreError, setMoreError] = useState<ApiFailure | null>(null);

  if (!first.data) return <Loading error={first.error} what="los cierres" />;
  const page = first.data;
  const rows = merge(page.closes, older?.rows ?? []);
  if (rows.length === 0)
    return (
      <p className="muted">
        Aún no hay cierres de {type === "T" ? "turno" : "día"}.
      </p>
    );
  const next = older ? older.next : page.next;

  const loadMore = async () => {
    if (!next) return;
    setLoading(true);
    setMoreError(null);
    try {
      const more = await apiGet<ClosePage>(
        `${path}&before=${encodeURIComponent(next)}`,
      );
      setOlder((o) => ({
        rows: [...(o?.rows ?? page.closes), ...more.closes],
        next: more.next,
      }));
    } catch (e) {
      const err = e instanceof ApiFailure ? e : new ApiFailure(0, "network");
      if (err.code === "signed_out") router.replace("/login/");
      else setMoreError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {first.error && (
        <p className="notice">
          No se pudieron actualizar los cierres ({first.error.message}).
        </p>
      )}
      {view === "graficas" ? (
        <CloseChart closes={rows} type={type} />
      ) : view === "surtidores" ? (
        <PumpGrid closes={rows} type={type} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Desde</th>
                <th>Hasta</th>
                <th className="right">Despachos</th>
                <th className="right">Total ($)</th>
                <th className="right">Galones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <CloseRow key={c.id} stationId={id} c={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {moreError && (
        <p className="notice">
          No se pudieron cargar más cierres ({moreError.message}).
        </p>
      )}
      {next && (
        <p>
          <button
            type="button"
            className="link-button"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? "Cargando…" : "Cargar más"}
          </button>
        </p>
      )}
    </>
  );
}

/** Both lists without repeats, latest closed_at first (then id, as the API). */
function merge(a: CloseSummary[], b: CloseSummary[]): CloseSummary[] {
  const byId = new Map([...a, ...b].map((c) => [c.id, c]));
  return [...byId.values()].sort((x, y) =>
    x.closed_at !== y.closed_at
      ? x.closed_at < y.closed_at
        ? 1
        : -1
      : Number(y.id) - Number(x.id),
  );
}

function CloseRow({ stationId, c }: { stationId: string; c: CloseSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr>
        <td>
          <button
            type="button"
            className="close-toggle num"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {voxTime(c.opened_at)}
          </button>
        </td>
        <td className="num nowrap">{voxTime(c.closed_at)}</td>
        <td className="num right">{c.dispatch_count ?? "—"}</td>
        <td className="num right">{num(c.total_amount, 2)}</td>
        <td className="num right">{num(c.total_volume, 2)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="close-detail">
            <CloseDetailView stationId={stationId} closeId={c.id} />
          </td>
        </tr>
      )}
    </>
  );
}

/** A close does not change once closed: loaded once when opened (hourly refresh). */
function CloseDetailView({
  stationId,
  closeId,
}: {
  stationId: string;
  closeId: string;
}) {
  const { data, error } = useApi<CloseDetail>(
    `/v1/stations/${stationId}/closes/${closeId}`,
    3600_000,
  );
  if (!data) return <Loading error={error} what="el detalle" />;
  return (
    <div className="close-detail-grid">
      <section>
        <h3>Ventas por producto</h3>
        <TotalsTable
          rows={data.by_product}
          first={["Producto", (t) => t.product ?? "—"]}
          ppu
        />
      </section>
      <section>
        <h3>Ventas y totalizadores electrónicos por surtidor (galones)</h3>
        <PumpTable sales={data.by_pump} totalizers={data.totalizers} />
      </section>
      {/* <section>
        <h3>Pruebas de surtidor</h3>
        {data.pump_tests.length === 0 ? (
          <p className="muted">Sin pruebas</p>
        ) : (
          <TotalsTable
            rows={data.pump_tests}
            first={["Surtidor", (t) => (t.pump == null ? (t.name ?? "—") : `${t.pump}${t.hose ?? ""}`)]}
            product
          />
        )}
      </section> */}
    </div>
  );
}

/** A pump (or hose) row: its sales in the period next to its volume totalizer. */
interface PumpRow {
  pump?: number | null;
  hose?: string;
  product?: string;
  sale?: CloseTotal;
  tot?: Totalizer;
}

/**
 * Joins the close's sales per pump with its totalizers, which are per hose.
 * A sale row matches the totalizer with the same pump and hose; a row without
 * a hose letter (VOXes that report per pump) matches only when that pump has a
 * single totalizer. The VOX lists only pumps that sold, so hoses without sales
 * keep their totalizer with empty sales; unmatched sale rows go last.
 */
function joinPumps(sales: CloseTotal[], totalizers: Totalizer[]): PumpRow[] {
  const used = new Set<CloseTotal>();
  const rows: PumpRow[] = totalizers.map((t) => {
    const hoses = totalizers.filter((o) => o.pump === t.pump).length;
    const sale = sales.find(
      (s) =>
        !used.has(s) &&
        s.pump === t.pump &&
        (s.hose ? s.hose === t.hose : hoses === 1),
    );
    if (sale) used.add(sale);
    return {
      pump: t.pump,
      hose: t.hose,
      product: sale?.product || t.product,
      sale,
      tot: t,
    };
  });
  for (const s of sales)
    if (!used.has(s))
      rows.push({ pump: s.pump, hose: s.hose, product: s.product, sale: s });
  return rows;
}

function PumpTable({
  sales,
  totalizers,
}: {
  sales: CloseTotal[];
  totalizers: Totalizer[];
}) {
  const rows = joinPumps(sales, totalizers);
  if (rows.length === 0) return <p className="muted">Sin ventas</p>;
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Surtidor</th>
          <th>Producto</th>
          <th className="right">Galones</th>
          <th className="right">Monto ($)</th>
          <th className="right">Tot. Inicial</th>
          <th className="right">Tot. Final</th>
          <th className="right">Tot. Diferencia</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const start = r.tot?.start_volume ?? null;
          const end = r.tot?.end_volume ?? null;
          return (
            <tr key={i}>
              <td>{r.pump == null ? "—" : `${r.pump}${r.hose ?? ""}`}</td>
              <td>{r.product || "—"}</td>
              <td className="num right">{num(r.sale?.volume, 2)}</td>
              <td className="num right">{num(r.sale?.amount, 2)}</td>
              <td className="num right">{num(start, 2)}</td>
              <td className="num right">{num(end, 2)}</td>
              <td className="num right">
                {start === null || end === null ? "—" : num(end - start, 2)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** One section of a close: one row per total, as the VOX lists them. */
function TotalsTable({
  rows,
  first,
  ppu = false,
  product = false,
}: {
  rows: CloseTotal[];
  first: [string, (t: CloseTotal) => React.ReactNode];
  ppu?: boolean;
  product?: boolean;
}) {
  if (rows.length === 0) return <p className="muted">Sin ventas</p>;
  return (
    <table className="table">
      <thead>
        <tr>
          <th>{first[0]}</th>
          {product && <th>Producto</th>}
          {ppu && <th className="right">Precio</th>}
          <th className="right">Galones</th>
          <th className="right">Monto ($)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t, i) => (
          <tr key={i}>
            <td>{first[1](t)}</td>
            {product && <td>{t.product || "—"}</td>}
            {ppu && <td className="num right">{num(t.ppu ?? null, 3)}</td>}
            <td className="num right">{num(t.volume, 2)}</td>
            <td className="num right">{num(t.amount, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Loading({ error, what }: { error?: ApiFailure; what: string }) {
  return (
    <p className="muted">
      {error
        ? `No se pudo cargar ${what} (${error.message}). Reintentando…`
        : "Cargando…"}
    </p>
  );
}
