import type { Status } from "@/lib/types";

export type DataSource = "real" | "simulated" | "test" | "external";
export type Quality = "valid" | "suspect" | "invalid";
export type RiskLevel = "low" | "moderate" | "elevated" | "severe";
/** Area-level outcome: a risk level, or an explicit "we cannot / need not assess" state. */
export type AreaRisk = RiskLevel | "no_data" | "unaffected";
export type Exposure = "critical_facility" | "residential" | "road" | "farmland";
export type Action = "monitor" | "verify" | "notify" | "escalate" | "prepare";
export type ReviewStatus = "proposed" | "under_review" | "approved" | "rejected";

/** One measurement in the unified data model (spec §4.1). */
export interface ReadingIn {
  station_id: string;
  sensor_id: string;
  hazard_type: "flood";
  parameter: "water_level" | "rainfall";
  value: number | null;
  unit: string;
  timestamp: string;
  data_source: DataSource;
  scenario_id: string | null;
}

/** All readings that belong to one tick. */
export interface Frame {
  tick: number;
  readings: ReadingIn[];
}

export interface ValidatedReading extends ReadingIn {
  quality_status: Quality;
  issues: string[];
}

export interface Indicators {
  level: number | null;
  rise_3: number | null;
  r10: number | null;
  RF: boolean;
  LR: boolean;
  LH: boolean;
  count: number;
}

export interface L1Result {
  tick: number;
  risk_level: RiskLevel | null; // null = Unavailable (no valid level)
  indicators: Indicators;
  warmup: boolean;
  receding: boolean;
  quality: Quality;
  rule: string; // which ordered rule fired, e.g. "R1 Severe"
  explanation: { en: string; ar: string };
  recommendation: { key: string; en: string; ar: string };
  confidence: "not_applicable_rule_based";
}

export interface AreaDef {
  id: string;
  name: { ar: string; en: string };
  exposure: Exposure;
  /** Ticks for the water from WTR-01 to reach the area. null = not linked to the sensor. */
  lag_ticks: number | null;
  /** How far the area sits above the WTR-01 gauge datum, in cm. */
  elevation_offset_cm: number;
  polygon: [number, number][]; // [lng, lat]
  geographic_status: "virtual";
  geographic_source: string;
}

export interface AreaResult {
  area_id: string;
  risk: AreaRisk;
  affected: boolean;
  indicators: Indicators | null;
  warmup: boolean;
  receding: boolean;
  quality: Quality | "n/a";
  reason: { en: string; ar: string };
  input_ticks: number[];
}

export interface RankRow {
  area_id: string;
  rank: number;
  tie: boolean;
  risk: AreaRisk;
  exposure: Exposure;
  lag_ticks: number;
  reason: { en: string; ar: string };
}

export interface Recommendation {
  recommendation_id: string;
  related_event_id: string;
  area_id: string;
  risk_level: AreaRisk;
  recommended_action: Action;
  priority: number;
  reason: { en: string; ar: string };
  supporting_data: Record<string, unknown>;
  created_at_tick: number;
  updated_at_tick: number;
  status: ReviewStatus;
  active: boolean;
  supersedes_id: string | null;
  superseded_by: string | null;
  requires_review: boolean;
  reviewed_by: string | null;
  scenario_id: string | null;
}

export interface PlanAction {
  key: string; // area:action
  area_id: string;
  action: Action;
  recommendation_id: string;
  status: ReviewStatus;
}
export interface PlanArea {
  area_id: string;
  risk: AreaRisk;
  priority: number;
  tie: boolean;
  actions: PlanAction[];
}
export interface PlanChange {
  kind: "added" | "withdrawn" | "priority" | "risk" | "route";
  area_id: string | null;
  action?: Action;
  from?: string | number;
  to?: string | number;
  reason: { en: string; ar: string };
}
export interface PlanVersion {
  plan_id: string;
  version: number;
  tick: number;
  related_event_id: string;
  areas: PlanArea[];
  route: RouteResult | null;
  changes: PlanChange[];
  change_reason: { en: string; ar: string };
  plan_status: "draft" | "under_review" | "partially_approved" | "approved";
}

export interface RoadNode {
  id: string;
  lng: number;
  lat: number;
  label?: { ar: string; en: string };
  area_id?: string;
}
export interface RoadEdge {
  id: string;
  a: string;
  b: string;
  name: { ar: string; en: string };
  /** Area the segment runs through (used to flag it "at risk", never to close it). */
  area_id?: string;
}
export interface RouteResult {
  target_area_id: string;
  status: "ok" | "no_route";
  nodes: string[];
  edges: string[];
  length_km: number | null;
  excluded: { edge_id: string; reason: { en: string; ar: string } }[];
  previous_edges: string[] | null;
  explanation: { en: string; ar: string };
}

export interface EngineEvent {
  event_id: string;
  seq: number;
  tick: number;
  type: string;
  source: string; // module that produced it
  area_id?: string | null;
  entity_id?: string | null;
  prev?: unknown;
  next?: unknown;
  reason?: { en: string; ar: string };
  data?: Record<string, unknown>;
}

export interface Limits {
  warning: number | null;
  danger: number | null;
  direction: "above" | "below";
  min_value: number;
  max_value: number;
}

export interface EngineConfig {
  scenario_id: string | null;
  data_source: DataSource;
  /** L0 limits snapshot for WTR-01 (water_level) and RAIN-01 (rainfall: none). */
  limits: { water_level: Limits; rainfall: Limits };
  areas: AreaDef[];
}

export interface AlertRecord {
  alert_id: string;
  tick: number;
  sensor_id: string;
  level: "warning" | "danger";
  value: number;
  threshold: number;
  acknowledged: boolean;
}

export interface EngineState {
  tick: number; // last processed tick, -1 before start
  levels: (number | null)[];
  rains: (number | null)[];
  quality: Quality[];
  l0: Status; // WTR-01 current alert status
  l0History: { tick: number; from: Status; to: Status }[];
  alerts: AlertRecord[];
  l1: L1Result | null;
  l1History: (RiskLevel | null)[];
  areas: AreaResult[];
  ranking: RankRow[];
  recs: Recommendation[];
  plan: PlanVersion[];
  closures: string[];
  routeTarget: string | null; // null = auto (top priority area)
  route: RouteResult | null;
  seq: number;
  recSeq: number;
  alertSeq: number;
  lastTimestamp: string | null;
}
