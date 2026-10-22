"use client";

import { useEffect } from "react";

/** Registers public/sw.js (needed to install the app and for push). */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
