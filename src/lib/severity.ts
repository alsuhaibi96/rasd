import type { Status, Threshold } from "./types";

type Limits = Pick<Threshold, "warning" | "danger" | "direction">;

/** Classifies a reading. A level starts when the value reaches its limit (≥ for "above", ≤ for "below"). */
export function classify(value: number, t: Limits | undefined): Status {
  if (!t || (t.warning == null && t.danger == null)) return "unknown";
  const reached = (limit: number | null) =>
    limit != null && (t.direction === "below" ? value <= limit : value >= limit);
  if (reached(t.danger)) return "danger";
  if (reached(t.warning)) return "warning";
  return "normal";
}

export const STATUS_RANK: Record<Status, number> = { unknown: 0, normal: 1, warning: 2, danger: 3 };

export function worstStatus(statuses: Status[]): Status {
  return statuses.reduce<Status>((w, s) => (STATUS_RANK[s] > STATUS_RANK[w] ? s : w), "unknown");
}

/** True when the new status should raise an alert: it is a warning/danger level above the previous one. */
export function isEscalation(prev: Status, next: Status): next is "warning" | "danger" {
  return (next === "warning" || next === "danger") && STATUS_RANK[next] > STATUS_RANK[prev];
}

export function validateLimits(t: Limits): string | null {
  if (t.warning == null || t.danger == null) return null;
  if (t.direction === "above" && t.danger <= t.warning) return "حد الخطر يجب أن يكون أعلى من حد التحذير";
  if (t.direction === "below" && t.danger >= t.warning) return "حد الخطر يجب أن يكون أقل من حد التحذير";
  return null;
}
