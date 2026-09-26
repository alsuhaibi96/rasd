"use client";
import { create } from "zustand";
import type { Alert, Reading, RealtimeEvent, Snapshot } from "./types";

const HISTORY_CAP = 240;

interface State extends Snapshot {
  user: string;
  connected: boolean;
  lastEventAt: number | null;
  history: Record<number, Reading[]>;
  flash: Record<number, number>;
  selectedSensorId: number | null;
  hydrate: (s: Snapshot, user: string) => void;
  apply: (e: RealtimeEvent) => void;
  setConnected: (c: boolean) => void;
  select: (sensorId: number | null) => void;
  loadHistory: (sensorId: number, limit?: number) => Promise<void>;
  acknowledge: (alertId: number) => Promise<void>;
}

const upsertAlert = (alerts: Alert[], a: Alert) =>
  alerts.some((x) => x.id === a.id) ? alerts.map((x) => (x.id === a.id ? a : x)) : [a, ...alerts];

export const useRasd = create<State>((set, get) => ({
  stations: [],
  sensors: [],
  thresholds: [],
  alerts: [],
  simulator: false,
  serverTime: new Date(0).toISOString(),
  user: "",
  connected: false,
  lastEventAt: null,
  history: {},
  flash: {},
  selectedSensorId: null,

  hydrate: (s, user) => set({ ...s, user }),

  apply: (e) =>
    set((st) => {
      const lastEventAt = Date.now();
      switch (e.type) {
        case "reading": {
          const h = st.history[e.sensor.id];
          return {
            lastEventAt,
            sensors: st.sensors.map((s) => (s.id === e.sensor.id ? e.sensor : s)),
            flash: { ...st.flash, [e.sensor.id]: lastEventAt },
            history: h ? { ...st.history, [e.sensor.id]: [...h, e.reading].slice(-HISTORY_CAP) } : st.history,
          };
        }
        case "alert":
        case "ack":
          return { lastEventAt, alerts: upsertAlert(st.alerts, e.alert) };
        case "thresholds":
          return { lastEventAt, thresholds: e.thresholds, sensors: e.sensors };
      }
    }),

  setConnected: (connected) => set({ connected }),
  select: (selectedSensorId) => set({ selectedSensorId }),

  loadHistory: async (sensorId, limit = 90) => {
    const res = await fetch(`/api/sensors/${sensorId}/readings?limit=${limit}`);
    if (!res.ok) return;
    const rows: Reading[] = await res.json();
    set((st) => {
      // Merge with anything that streamed in while the request was in flight.
      const live = (st.history[sensorId] ?? []).filter((r) => r.id > (rows.at(-1)?.id ?? 0));
      return { history: { ...st.history, [sensorId]: [...rows, ...live].slice(-HISTORY_CAP) } };
    });
  },

  acknowledge: async (alertId) => {
    const res = await fetch(`/api/alerts/${alertId}/ack`, { method: "POST" });
    if (res.ok) get().apply({ type: "ack", alert: await res.json() });
    else throw new Error((await res.json()).error ?? "تعذر تأكيد الاطلاع");
  },
}));
