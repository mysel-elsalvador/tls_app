import type { Alarm, Tank } from "./types";

const LOCALE = "es-SV";

export function num(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const UNIT_LABEL: Record<string, string> = { F: "°F", C: "°C" };

/** "4.998 gal". Without a known unit, the number alone (never a guessed unit). */
export function withUnit(v: number | null, unit: string | undefined, digits = 0): string {
  const n = num(v, digits);
  if (n === "—" || !unit) return n;
  return `${n} ${UNIT_LABEL[unit] ?? unit}`;
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
  return new Date(iso).toLocaleString(LOCALE, { dateStyle: "short", timeStyle: "short" });
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
  if (a.category === "14" && a.type === "02") return { text: "Fallo de autodial", documented: true };
  return { text: `Categoría ${a.category ?? "?"}, tipo ${a.type ?? "?"}`, documented: false };
}

export function alarmSubject(a: Alarm): string {
  if (a.number === null) return "—";
  return a.category === "02" ? `Tanque ${a.number}` : `N.º ${a.number}`;
}
