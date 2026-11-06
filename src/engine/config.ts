import { ADIREA_AREAS } from "./geo";
import type { EngineConfig, Limits } from "./types";

export const RAINFALL_LIMITS: Limits = { warning: null, danger: null, direction: "above", min_value: 0, max_value: 50 };
/** 60/80 cm: verified in the website configuration (db seed / thresholds table) — NOT hydrologically validated. */
export const DEFAULT_WATER_LIMITS: Limits = { warning: 60, danger: 80, direction: "above", min_value: 0, max_value: 200 };

export function makeConfig(water: Limits = DEFAULT_WATER_LIMITS, scenarioId = "FLOOD-F03"): EngineConfig {
  return { scenario_id: scenarioId, data_source: "simulated", limits: { water_level: water, rainfall: RAINFALL_LIMITS }, areas: ADIREA_AREAS };
}
