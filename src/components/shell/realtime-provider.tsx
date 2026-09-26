"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { indexBy } from "@/lib/derive";
import { SENSOR_META, formatValue } from "@/lib/sensor-meta";
import { useRasd } from "@/lib/store";
import type { RealtimeEvent, Snapshot } from "@/lib/types";

function beep(level: "warning" | "danger") {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = level === "danger" ? 880 : 660;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    o.onended = () => ctx.close();
  } catch {}
}

/** Hydrates the store from the server snapshot and keeps it live over SSE. */
export function RealtimeProvider({ snapshot, user, children }: { snapshot: Snapshot; user: string; children: React.ReactNode }) {
  const hydrated = useRef(false);
  if (!hydrated.current) {
    useRasd.getState().hydrate(snapshot, user);
    hydrated.current = true;
  }

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let everConnected = false;
    const { apply, setConnected, hydrate } = useRasd.getState();

    const connect = () => {
      es = new EventSource("/api/stream");
      es.onopen = async () => {
        setConnected(true);
        // After a reconnect, resync anything missed while offline.
        if (everConnected) {
          const res = await fetch("/api/snapshot");
          if (res.ok) hydrate(await res.json(), useRasd.getState().user);
        }
        everConnected = true;
      };
      es.onmessage = (m) => {
        const e = JSON.parse(m.data) as RealtimeEvent;
        apply(e);
        if (e.type === "alert") {
          const { sensors, stations } = useRasd.getState();
          const s = indexBy(sensors).get(e.alert.sensor_id);
          const st = s && indexBy(stations).get(s.station_id);
          if (!s || !st) return;
          const meta = SENSOR_META[s.type];
          const text = `${st.name_ar}، ${st.city_ar} · ${formatValue(s.type, e.alert.value)} ${meta.unitLabel}`;
          (e.alert.level === "danger" ? toast.error : toast.warning)(
            `${e.alert.level === "danger" ? "خطر" : "تحذير"}: ${meta.hazard}`,
            { description: text },
          );
          beep(e.alert.level);
        }
      };
      es.onerror = () => {
        setConnected(false);
        es?.close();
        retry = setTimeout(connect, 2500);
      };
    };
    connect();
    return () => {
      clearTimeout(retry);
      es?.close();
    };
  }, []);

  return <>{children}</>;
}
