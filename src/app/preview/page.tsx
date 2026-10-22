"use client";
// TEMPORARY visual check of DeliveryList with fake data. Delete.
import { useEffect } from "react";
import { DeliveryList } from "@/components/DeliveryList";
import type { Delivery } from "@/lib/types";

const u = { volume: "gal", height: "in", temp: "F" };
const d = (tank: number, p: string, s: string, e: string | null, sv: number, ev: number | null, sh: number, eh: number | null): Delivery => ({
  console_id: "tls2-1", tank, product_code: p, start_time: s, end_time: e, start_volume: sv, end_volume: ev,
  start_height: sh, end_height: eh, start_temp: 81, end_temp: 79, start_water: 0, end_water: 0, units: u,
});
const deliveries: Delivery[] = [
  d(2, "2", "2026-10-22T14:36:00", "2026-10-22T15:01:00", 2100.5, 7050, 25.1, 62.3),
  d(1, "1", "2026-10-22T14:50:00", "2026-10-22T15:20:00", 3000, 8100, 30.2, 66),
  d(3, "3", "2026-10-22T15:10:00", null, 900, null, 12, null),
  d(2, "2", "2026-10-15T09:00:00", "2026-10-15T09:20:00", 1000, 6000, 15, 50),
  d(1, "1", "2026-10-10T08:00:00", "2026-10-10T08:30:00", 2000, 6500, 22, 55),
];

export default function Preview() {
  useEffect(() => {
    document.querySelector("details")?.setAttribute("open", "");
  }, []);
  return (
    <div style={{ maxWidth: 360, padding: 16, border: "1px solid red" }}>
      <h2>Entregas recientes</h2>
      <DeliveryList deliveries={deliveries} />
    </div>
  );
}
