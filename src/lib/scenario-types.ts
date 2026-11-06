import type { EngineEvent, EngineState, Limits, PlanVersion } from "@/engine/types";
import type { ParamSegment, ScenarioKind } from "@/engine/scenarios";

export type RunStatus = "running" | "paused" | "completed" | "stopped" | "interrupted";

/** What clients see of the active run. Plan history is fetched separately (/api/plans). */
export interface RunView {
  run_id: number;
  scenario_id: string;
  kind: ScenarioKind;
  segments: ParamSegment[];
  status: RunStatus;
  tick: number;
  length: number;
  speed: number;
  t0: string;
  started_by: string;
  started_at: string;
  engine_version: string;
  ruleset: Record<string, string>;
  limits: Limits;
  /** True when the L0 limits used match the 60/80 cm values the F-03 expected tables assume. */
  limits_match_f03: boolean;
  state: Omit<EngineState, "plan">;
  plan_head: PlanVersion | null;
  plan_count: number;
  processing_ms: number;
  last_tick_at: string | null;
}

export interface LoggedEvent extends EngineEvent {
  id: number;
  run_id: number | null;
  scenario_id: string | null;
  data_source: string;
  created_at: string;
}
