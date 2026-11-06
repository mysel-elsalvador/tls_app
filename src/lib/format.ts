import type { Alarm, Tank } from "./types";

const LOCALE = "es-SV";

export function num(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const UNIT_LABEL: Record<string, string> = { F: "°F", C: "°C" };

/** "4.998 gal". Without a known unit, the number alone (never a guessed unit). */
export function withUnit(
  v: number | null,
  unit: string | undefined,
  digits = 0,
): string {
  const n = num(v, digits);
  if (n === "—" || !unit) return n;
  return `${n} ${UNIT_LABEL[unit] ?? unit}`;
}

/**
 * The product as the console names it (602 label, e.g. "DIESEL"), else its
 * code: "Producto 2". product_label is missing from APIs deployed before it.
 */
export function productName(p: {
  product_label?: string | null;
  product_code: string | null;
}): string {
  if (p.product_label) return p.product_label;
  return p.product_code ? `Producto ${p.product_code}` : "Producto —";
}

/**
 * Gauge color by fuel, matched as a word anywhere in the 602 label, any case
 * and with or without a trailing number ("POWER PLUS 1" = power plus).
 * "PREMIUN" is how the real console spells it. Null = keep the default blue.
 */
const PRODUCT_COLORS: [RegExp, string][] = [
  [/\bregular\b/i, "#d13e33"],
  [/\bsuper\b/i, "#f2ec51"],
  [/\bdiesel\b/i, "#4b8e4f"],
  [/\bpower\s*plus\b/i, "#83939f"],
  [/\bpremiu[mn]\b/i, "#d1bc82"],
];

export function productColor(label: string | null | undefined): string | null {
  if (!label) return null;
  return PRODUCT_COLORS.find(([re]) => re.test(label))?.[1] ?? null;
}

/** A fuel in the close charts: products with a number add up ("POWER PLUS 1" + "2"). */
export interface Fuel {
  key: string;
  name: string;
  color: string;
  rank: number; // stacking order, bottom first
}

/**
 * Chart colors: the tank hues, re-stepped so bars stay visible on light and
 * dark surfaces (the gauge yellow and beige vanish on white, the gray reads as
 * "no data"). Checked with the dataviz palette validator for the two product
 * sets seen, stacked in rank order: Regular/Super/Diesel and Power Plus/
 * Premium/Diesel. Super and Premium are too close to stack next to each other;
 * no station sells both so far.
 */
const FUELS: [RegExp, Fuel][] = [
  [/\bregular\b/i, { key: "regular", name: "Regular", color: "#d13e33", rank: 0 }],
  [/\bsuper\b/i, { key: "super", name: "Super", color: "#ad8c00", rank: 1 }],
  [/\bdiesel\b/i, { key: "diesel", name: "Diesel", color: "#2f7d4a", rank: 4 }],
  [/\bpower\s*plus\b/i, { key: "power-plus", name: "Power Plus", color: "#4a76b5", rank: 2 }],
  [/\bpremiu[mn]\b/i, { key: "premium", name: "Premium", color: "#b8893a", rank: 3 }],
];
/** Chart color of a known fuel in a tank label or product name; null = default accent. */
export function fuelColor(label: string | null | undefined): string | null {
  if (!label) return null;
  return FUELS.find(([re]) => re.test(label))?.[1].color ?? null;
}

const OTHER_COLORS =["#8a63c9", "#2a9d9a", "#c4572a"];

/** The fuel of a VOX product name; unknown names keep their own, without the number. */
export function fuelOf(product: string | null): Fuel {
  if (!product) return { key: "?", name: "Sin producto", color: "#8d8b84", rank: 99 };
  const known = FUELS.find(([re]) => re.test(product));
  if (known) return known[1];
  const base = product.replace(/\s+\d+$/, "").trim().toLowerCase();
  const name = base.replace(/(^|\s)\S/g, (s) => s.toUpperCase());
  // Color follows the name, so it never changes with the other products shown.
  const h = [...base].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return { key: `x-${base}`, name, color: OTHER_COLORS[h % OTHER_COLORS.length]!, rank: 50 };
}

/** Capacity = volume + ullage, both from the console; null if either is unknown. */
export function fill(t: Tank): { capacity: number; ratio: number } | null {
  if (t.volume === null || t.ullage === null) return null;
  const capacity = t.volume + t.ullage;
  if (capacity <= 0) return null;
  return { capacity, ratio: Math.min(1, Math.max(0, t.volume / capacity)) };
}

/** "hace 3 min" from a UTC ISO time. */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return "nunca";
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

/** Local date and time of a UTC ISO time. */
export function localTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(LOCALE, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** "mar 20, 14:35": a chart point (local time). */
export function pointTime(ms: number): string {
  return new Date(ms).toLocaleString(LOCALE, {
    weekday: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** Chart axis tick: "mar 20" at midnight, "14:00" otherwise (local time). */
export function tickLabel(ms: number): string {
  const d = new Date(ms);
  return d.getHours() === 0 && d.getMinutes() === 0
    ? d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric" })
    : d.toLocaleTimeString(LOCALE, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
}

/** Console times are shown as the console reported them (no zone, may be skewed). */
export function consoleTime(s: string | null): string {
  return s ? s.slice(0, 16).replace("T", " ") : "—";
}

/**
 * VOX times likewise, as the controller reported them (no zone; its clock is
 * not reliable), to the second: sales can be seconds apart.
 */
export function voxTime(s: string | null): string {
  return s ? s.slice(0, 19).replace("T", " ") : "—";
}

/**
 * A VOX time as a short axis label, read from the string (never through Date:
 * it has no zone). "29/10 06:00" with the time, "29/10" without.
 */
export function voxShort(s: string | null, time: boolean): string {
  if (!s) return "—";
  const date = `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  return time ? `${date} ${s.slice(11, 16)}` : date;
}

/** VOX sale type: only "01" (contado) is known; other codes are shown as sent. */
export function saleType(code: string | null): string {
  if (code === "01") return "Contado";
  return code ? `Tipo ${code}` : "—";
}

// Documented in the TLS2 manual (Document/VR_INTERFACE_MANUAL_LLM.txt).
// Anything else is shown as its raw codes, never guessed.
const TANK_ALARM: Record<string, string> = {
  "03": "Nivel alto de agua",
  "04": "Sobrellenado",
  "05": "Nivel bajo de producto",
  // Console alarm documentation (2026-10-28): "High Product Alarm — product
  // level in tank rose above programmed limit".
  "07": "Nivel alto de producto",
  "08": "Altura de combustible inválida",
  "09": "Sonda desconectada",
  "11": "Entrega necesaria",
  "12": "Volumen máximo",
  "13": "Prueba de fuga gruesa fallida",
  "14": "Prueba periódica de fuga fallida",
  "15": "Prueba anual de fuga fallida",
  "27": "Temperatura baja",
};

export function alarmLabel(a: Alarm): { text: string; documented: boolean } {
  if (a.category === "02" && a.type && TANK_ALARM[a.type]) {
    return { text: TANK_ALARM[a.type]!, documented: true };
  }
  if (a.category === "14" && a.type === "02")
    return { text: "Fallo de autodial", documented: true };
  // From the console's alarm documentation (2026-10-22): "Fuel Alarm — fuel
  // is present in the area being monitored by the sensor".
  if (a.category === "03" && a.type === "03")
    return { text: "Combustible detectado por sensor", documented: true };
  // Console panel (2026-10-23): "SENSOR OUT ALARM".
  if (a.category === "03" && a.type === "04")
    return { text: "Sensor fuera de servicio", documented: true };
  // Console alarm documentation (2026-10-30): "Printer Error — the printing
  // function cannot continue due to a problem with the printer".
  if (a.category === "64" && a.type === "02")
    return { text: "Error de impresora", documented: true };
  return {
    text: `Categoría ${a.category ?? "?"}, tipo ${a.type ?? "?"}`,
    documented: false,
  };
}

export function alarmSubject(a: Alarm): string {
  if (a.number === null) return "—";
  if (a.category === "02") return `Tanque ${a.number}`;
  // Category 03 is a sensor alarm (see the 03/03 fuel alarm above).
  if (a.category === "03") return `Sensor ${a.number}`;
  return `N.º ${a.number}`;
}
