import type { DataSource, Frame } from "../types";
import { F03 } from "./f03";
import { type ParametricParams, parametricLength, parametricValues } from "./parametric";

export type ScenarioKind = "scripted" | "parametric";
/** A run may change parameters mid-way; each entry applies from its tick onward. */
export interface ParamSegment {
  from_tick: number;
  params: ParametricParams;
}

export interface ScenarioSpec {
  kind: ScenarioKind;
  scenario_id: string;
  segments: ParamSegment[]; // empty for scripted
}

export const SCRIPTED_F03: ScenarioSpec = { kind: "scripted", scenario_id: F03.id, segments: [] };

export function scenarioLength(s: ScenarioSpec): number {
  if (s.kind === "scripted") return F03.level.length;
  return Math.max(...s.segments.map((g) => parametricLength(g.params)));
}

function paramsAt(s: ScenarioSpec, t: number) {
  let p = s.segments[0].params;
  for (const g of s.segments) if (g.from_tick <= t) p = g.params;
  return p;
}

/** Simulated timestamp of tick t: T00 + t minutes. */
export function simTime(t0: string, t: number) {
  return new Date(Date.parse(t0) + t * 60_000).toISOString();
}

/** The readings of tick t, tagged per spec §4.1 / F-03 §0 rule 1. */
export function frameAt(s: ScenarioSpec, t: number, t0: string, source: DataSource = "simulated"): Frame {
  const v = s.kind === "scripted" ? { level: F03.level[t], rain: F03.rain[t] } : parametricValues(paramsAt(s, t), t);
  const common = { station_id: F03.station, hazard_type: "flood" as const, timestamp: simTime(t0, t), data_source: source, scenario_id: s.scenario_id };
  return {
    tick: t,
    readings: [
      { ...common, sensor_id: F03.sensors.level, parameter: "water_level", value: v.level, unit: "cm" },
      { ...common, sensor_id: F03.sensors.rain, parameter: "rainfall", value: v.rain, unit: "mm/min" },
    ],
  };
}

export { F03 };
export type { ParametricParams };
