"use client";
import { useEffect, useState } from "react";

export interface SystemStatus {
  db: "available" | "error";
  ai: { state: "not_configured" | "not_available" | "loading" | "ready" | "running" | "error"; detail: string; model_version: string | null };
  generator: "running" | "paused" | "off";
  run: { id: number; status: string; tick: number; scenario: string } | null;
  real_devices_online: number;
  server_time: string;
}

/** Live module status from the server (never a static label). */
export function useSystemStatus(intervalMs = 15000) {
  const [s, setS] = useState<SystemStatus | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/system/status")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => alive && (setS(d), setError(false)))
        .catch(() => alive && setError(true));
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);
  return { status: s, error };
}
