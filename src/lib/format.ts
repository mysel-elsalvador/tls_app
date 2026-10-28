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
