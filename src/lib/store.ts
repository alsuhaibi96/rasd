"use client";
import { create } from "zustand";
import type { Lang } from "./i18n";
import type { LoggedEvent } from "./scenario-types";
import type { Alert, Reading, RealtimeEvent, Snapshot } from "./types";

const HISTORY_CAP = 240;
const EVENTS_CAP = 400;

interface State extends Snapshot {
  user: string;
  lang: Lang;
  events: LoggedEvent[];
  connected: boolean;
  lastEventAt: number | null;
  history: Record<number, Reading[]>;
  flash: Record<number, number>;
  selectedSensorId: number | null;
  hydrate: (s: Snapshot, user: string, lang?: Lang) => void;
  loadEvents: (runId: number) => Promise<void>;
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
  run: null,
  alertTotal: 0,
  user: "",
  lang: "ar",
  events: [],
  connected: false,
  lastEventAt: null,
  history: {},
  flash: {},
  selectedSensorId: null,

  hydrate: (s, user, lang) => set((st) => ({ ...s, user, lang: lang ?? st.lang, events: s.run && st.events[0]?.run_id === s.run.run_id ? st.events : [] })),

  loadEvents: async (runId) => {
    const res = await fetch(`/api/events?run=${runId}&limit=${EVENTS_CAP}`);
    if (!res.ok) return;
    const rows: LoggedEvent[] = await res.json();
    set({ events: rows });
  },

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
          return { lastEventAt, alerts: upsertAlert(st.alerts, e.alert), alertTotal: st.alertTotal + (st.alerts.some((x) => x.id === e.alert.id) ? 0 : 1) };
        case "ack":
          return { lastEventAt, alerts: upsertAlert(st.alerts, e.alert) };
        case "thresholds":
          return { lastEventAt, thresholds: e.thresholds, sensors: e.sensors };
        case "run": {
          const sameRun = e.run && st.run && e.run.run_id === st.run.run_id;
          return { run: e.run, events: sameRun ? st.events : [] };
        }
        case "events": {
          const runId = e.events[0]?.run_id;
          const base = st.events.length && st.events[0].run_id !== runId ? [] : st.events;
          return { events: [...base, ...e.events].slice(-EVENTS_CAP) };
        }
        default:
          return {};
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
