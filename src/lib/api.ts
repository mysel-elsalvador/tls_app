"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { accessToken, config } from "./auth";
import type { ApiError } from "./types";

export class ApiFailure extends Error {
  constructor(
    readonly status: number, // 0: network error
    readonly code: ApiError["error"] | "network" | "signed_out",
  ) {
    super(`${status} ${code}`);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = await accessToken();
  if (!token) throw new ApiFailure(401, "signed_out");
  let res: Response;
  try {
    res = await fetch(config.apiUrl + path, { headers: { authorization: `Bearer ${token}` } });
  } catch {
    throw new ApiFailure(0, "network");
  }
  if (res.ok) return (await res.json()) as T;
  // 401 comes from the API Gateway authorizer (no JSON body of ours).
  if (res.status === 401) throw new ApiFailure(401, "signed_out");
  const body = (await res.json().catch(() => ({}))) as Partial<ApiError>;
  throw new ApiFailure(res.status, body.error ?? "internal");
}

export interface Loaded<T> {
  data?: T;
  error?: ApiFailure;
  /** When data was last loaded successfully. */
  at?: Date;
}

/**
 * GETs `path` now and every `refreshMs` while the tab is visible. On a
 * failed refresh the last data is kept alongside the error. Signed-out
 * users are sent to /login/.
 */
export function useApi<T>(path: string | null, refreshMs = 30_000): Loaded<T> {
  const router = useRouter();
  const [state, setState] = useState<Loaded<T>>({});
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const data = await apiGet<T>(path);
        if (!cancelled) setState({ data, at: new Date() });
      } catch (e) {
        const error = e instanceof ApiFailure ? e : new ApiFailure(0, "network");
        if (error.code === "signed_out") {
          router.replace("/login/");
          return;
        }
        if (!cancelled) setState((s) => ({ ...s, error }));
      }
    };
    void load();
    const timer = setInterval(load, refreshMs);
    const onVisible = () => void (document.hidden || load());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [path, refreshMs, router]);
  return state;
}
