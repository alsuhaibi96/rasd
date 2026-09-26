import { STALE_MS } from "./format";
import { STATUS_RANK, worstStatus } from "./severity";
import type { Alert, Sensor, Station, Status } from "./types";

export const DEVICE_ONLINE_MS = 2 * 60_000;

export function indexBy<T extends { id: number }>(rows: T[]) {
  return new Map(rows.map((r) => [r.id, r]));
}

export function kpis(sensors: Sensor[], now: number) {
  const deviceOnline = sensors.filter(
    (s) => s.last_source === "device" && s.last_seen_at && now - Date.parse(s.last_seen_at) < DEVICE_ONLINE_MS,
  ).length;
  const lastSeen = sensors.reduce<string | null>(
    (m, s) => (s.last_seen_at && (!m || s.last_seen_at > m) ? s.last_seen_at : m),
    null,
  );
  return {
    deviceOnline,
    total: sensors.length,
    danger: sensors.filter((s) => s.last_status === "danger").length,
    warning: sensors.filter((s) => s.last_status === "warning").length,
    normal: sensors.filter((s) => s.last_status === "normal").length,
    lastSeen,
    live: !!lastSeen && now - Date.parse(lastSeen) < STALE_MS,
  };
}

export function stationStatus(stationId: number, sensors: Sensor[]): Status {
  return worstStatus(sensors.filter((s) => s.station_id === stationId).map((s) => s.last_status));
}

export function regionStatuses(stations: Station[], sensors: Sensor[]) {
  const out: Record<string, Status> = {};
  for (const st of stations) out[st.region_code] = worstStatus([out[st.region_code] ?? "unknown", stationStatus(st.id, sensors)]);
  return out;
}

/** Most important open alert: danger before warning, newest first. */
export function priorityAlert(alerts: Alert[]): Alert | null {
  const open = alerts.filter((a) => !a.acknowledged_at);
  open.sort((a, b) => STATUS_RANK[b.level] - STATUS_RANK[a.level] || b.created_at.localeCompare(a.created_at));
  return open[0] ?? null;
}

export function bySeverity(a: Sensor, b: Sensor) {
  return STATUS_RANK[b.last_status] - STATUS_RANK[a.last_status] || a.id - b.id;
}

export function dataSource(sensors: Sensor[], now: number): "simulator" | "device" | "mixed" {
  const live = sensors.filter((s) => s.last_source === "device" && s.last_seen_at && now - Date.parse(s.last_seen_at) < DEVICE_ONLINE_MS);
  if (!live.length) return "simulator";
  return live.length === sensors.length ? "device" : "mixed";
}
