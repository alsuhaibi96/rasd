"use client";
import { toast } from "sonner";
import { useRasd } from "./store";

/** POST JSON; surfaces server messages as toasts and applies a returned run view immediately. */
export async function post<T = unknown>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? `HTTP ${res.status}`);
      return null;
    }
    if (data && typeof data === "object" && "run_id" in data && "state" in data) useRasd.getState().apply({ type: "run", run: data });
    return data as T;
  } catch {
    toast.error(useRasd.getState().lang === "en" ? "Server unreachable" : "تعذر الوصول إلى الخادم");
    return null;
  }
}
