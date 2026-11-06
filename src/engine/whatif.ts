import { assessArea } from "./geo";
import { l0Status } from "./l0";
import { assessL1, L1_PARAMS } from "./l1";
import type { AreaRisk, EngineConfig, EngineState, RiskLevel } from "./types";
import { RULESET } from "./version";

export type RainAssumption = "persist" | "taper" | "stop";
export interface WhatIfInput {
  horizon: 15 | 30;
  rain: RainAssumption;
  /** Fraction of the current per-minute level change carried into the next minute (0–1). */
  damping: number;
}

/**
 * WHATIF-v0.1 assumptions (illustrative, NOT hydrology):
 *  rain(k+1)  = persist: rain(k) · taper: max(0, rain(k) − 0.1) · stop: 0
 *  Δ(k+1)     = damping·Δ(k) + RESPONSE·(rain(k+1) − STEADY_RAIN)
 *  level      = clamp(level + Δ, BASE_FLOOR, 200)
 * Δ(0) is the observed mean change per minute over the last 3 minutes.
 */
export const WHATIF_PARAMS = { RESPONSE: 4, STEADY_RAIN: 0.5, BASE_FLOOR: 22, MAX: 200 } as const;

export interface WhatIfTick {
  tick: number;
  offset: number; // minutes after projection start
  level: number;
  rain: number;
  l0_hypothetical: string;
  l1: RiskLevel | null;
  areas: Record<string, AreaRisk>;
}
export interface WhatIfResult {
  label: "What-if Projection – Simulation";
  disclaimer: { en: string; ar: string };
  ruleset: string;
  start_tick: number;
  horizon: number;
  assumptions: WhatIfInput & typeof WHATIF_PARAMS;
  inputs: { level: number | null; rise_3: number | null; r10: number | null; rain: number | null };
  ticks: WhatIfTick[];
  areas: { area_id: string; current: AreaRisk; peak: AreaRisk; first_affected_offset: number | null; currently_affected: boolean; reason: { en: string; ar: string } }[];
}

const ORDER: Record<string, number> = { unaffected: -1, no_data: 0, low: 1, moderate: 2, elevated: 3, severe: 4 };

/**
 * Pure: never mutates engine state, never emits L0/L1 changes or alerts (spec §13.4).
 * Runs the same L1 and area rules on a hypothetical continuation of the readings.
 */
export function project(state: EngineState, cfg: EngineConfig, input: WhatIfInput): WhatIfResult | null {
  const t = state.tick;
  if (t < 0) return null;
  const levels = [...state.levels];
  const rains = [...state.rains];
  const last = levels[t];
  if (last == null) return null;
  const back = t >= 3 ? levels[t - 3] : null;
  let delta = back != null ? (last - back) / 3 : 0;
  let level = last;
  let rain = rains[t] ?? 0;
  const ticks: WhatIfTick[] = [];
  for (let k = 1; k <= input.horizon; k++) {
    rain = input.rain === "persist" ? rain : input.rain === "taper" ? Math.max(0, Math.round((rain - 0.1) * 10) / 10) : 0;
    delta = input.damping * delta + WHATIF_PARAMS.RESPONSE * (rain - WHATIF_PARAMS.STEADY_RAIN);
    level = Math.min(WHATIF_PARAMS.MAX, Math.max(WHATIF_PARAMS.BASE_FLOOR, level + delta));
    const i = t + k;
    levels[i] = Math.round(level);
    rains[i] = rain;
    const l1 = assessL1(levels, rains, i, null, true, "valid");
    const areas: Record<string, AreaRisk> = {};
    for (const a of cfg.areas) areas[a.id] = assessArea(a, levels, rains, i, undefined, true).risk;
    ticks.push({ tick: i, offset: k, level: Math.round(level), rain, l0_hypothetical: l0Status(Math.round(level), cfg.limits.water_level), l1: l1.risk_level, areas });
  }
  const current = new Map(state.areas.map((a) => [a.area_id, a]));
  const areas = cfg.areas.map((a) => {
    const cur = current.get(a.id);
    const series = ticks.map((x) => x.areas[a.id]);
    const peak = series.reduce<AreaRisk>((m, r) => (ORDER[r] > ORDER[m] ? r : m), cur?.risk ?? "no_data");
    const eff = (k: number) => (a.lag_ticks == null ? null : (levels[t + k - a.lag_ticks] ?? null));
    let first: number | null = null;
    for (let k = 1; k <= input.horizon; k++) {
      const v = eff(k);
      if (v != null && v - a.elevation_offset_cm > L1_PARAMS.baselineMax) {
        first = k;
        break;
      }
    }
    const reason =
      a.lag_ticks == null
        ? { en: "Not linked to WTR-01 in the virtual basin", ar: "غير مرتبطة بالحساس WTR-01 في الحوض الافتراضي" }
        : first != null
          ? { en: `Hypothetical effective level would exceed the 30 cm baseline maximum at +${first} min under these assumptions`, ar: `قد يتجاوز المستوى الفعّال الافتراضي 30 سم بعد ${first} دقيقة وفق هذه الافتراضات` }
          : { en: "Hypothetical effective level stays within baseline over the horizon", ar: "يبقى المستوى الفعّال الافتراضي ضمن الوضع الاعتيادي خلال الفترة" };
    return { area_id: a.id, current: cur?.risk ?? "no_data", peak, first_affected_offset: first, currently_affected: !!cur?.affected, reason };
  });
  return {
    label: "What-if Projection – Simulation",
    disclaimer: {
      en: "Hypothetical projection under simulation assumptions. Not an actual forecast. Does not change L0 or L1 and creates no alerts.",
      ar: "إسقاط افتراضي وفق افتراضات المحاكاة. ليس توقعًا فعليًا. لا يغيّر L0 أو L1 ولا يُصدر تنبيهات.",
    },
    ruleset: RULESET.whatif,
    start_tick: t,
    horizon: input.horizon,
    assumptions: { ...input, ...WHATIF_PARAMS },
    inputs: { level: last, rise_3: state.l1?.indicators.rise_3 ?? null, r10: state.l1?.indicators.r10 ?? null, rain: state.rains[t] ?? null },
    ticks,
    areas,
  };
}
