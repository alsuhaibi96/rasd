import type { EngineConfig, Frame, ReadingIn, ValidatedReading } from "./types";

const UNITS: Record<ReadingIn["parameter"], string> = { water_level: "cm", rainfall: "mm/min" };
const REQUIRED: (keyof ReadingIn)[] = ["station_id", "sensor_id", "hazard_type", "parameter", "unit", "timestamp", "data_source"];

export interface FrameCheck {
  readings: ValidatedReading[];
  /** Frame-level issues (duplicate / out-of-order / gap). A rejected frame is not processed. */
  rejected: string | null;
  missingTicks: number[];
}

/** Spec §4.2: completeness, type, unit, timestamp, duplicates, missing, range and source identity. */
export function validateFrame(frame: Frame, cfg: EngineConfig, lastTick: number, lastTimestamp: string | null): FrameCheck {
  if (!Number.isInteger(frame.tick) || frame.tick < 0) return { readings: [], rejected: "invalid tick", missingTicks: [] };
  if (frame.tick <= lastTick) return { readings: [], rejected: `duplicate tick T${pad(frame.tick)}`, missingTicks: [] };
  const missingTicks: number[] = [];
  for (let t = lastTick + 1; t < frame.tick; t++) missingTicks.push(t);

  const readings = frame.readings.map((r): ValidatedReading => {
    const issues: string[] = [];
    for (const k of REQUIRED) if (r[k] == null || r[k] === "") issues.push(`missing ${k}`);
    if (typeof r.value !== "number" || !Number.isFinite(r.value)) issues.push("value is not a finite number");
    if (UNITS[r.parameter] && r.unit !== UNITS[r.parameter]) issues.push(`unit ${r.unit} ≠ ${UNITS[r.parameter]}`);
    const ts = Date.parse(r.timestamp);
    if (Number.isNaN(ts)) issues.push("invalid timestamp");
    else if (lastTimestamp && ts <= Date.parse(lastTimestamp)) issues.push("timestamp not after previous reading");
    if (r.data_source !== cfg.data_source) issues.push(`data_source ${r.data_source} ≠ ${cfg.data_source}`);
    if (r.scenario_id !== cfg.scenario_id) issues.push("scenario_id mismatch");
    const lim = cfg.limits[r.parameter];
    if (typeof r.value === "number" && lim && (r.value < lim.min_value || r.value > lim.max_value))
      issues.push(`out of range [${lim.min_value}, ${lim.max_value}]`);
    return { ...r, quality_status: issues.length ? "invalid" : "valid", issues };
  });
  // Two readings for the same sensor in one frame → keep the first, reject the rest.
  const seen = new Set<string>();
  for (const r of readings) {
    if (seen.has(r.sensor_id)) {
      r.quality_status = "invalid";
      r.issues.push("duplicate reading for sensor in tick");
    }
    seen.add(r.sensor_id);
  }
  return { readings, rejected: null, missingTicks };
}

export const pad = (t: number) => String(t).padStart(2, "0");
