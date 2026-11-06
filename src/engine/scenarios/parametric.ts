import { F03 } from "./f03";

export interface ParametricParams {
  /** Scales rainfall and the level excess above the 22 cm base (0.5–2.0). */
  intensity: number;
  /** Development speed: >1 compresses the event, <1 stretches it (0.5–2.0). */
  rate: number;
  /** 0 = no noise; any other integer seeds a reproducible noise stream (F-03-N style). */
  seed: number;
}
export const DEFAULT_PARAMS: ParametricParams = { intensity: 1, rate: 1, seed: 0 };

/** mulberry32 — tiny deterministic PRNG so seeded runs are reproducible. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE = 22;
const lerp = (arr: number[], x: number) => {
  if (x >= arr.length - 1) return arr[arr.length - 1];
  const i = Math.floor(x);
  return arr[i] + (arr[i + 1] - arr[i]) * (x - i);
};

export function parametricLength(p: ParametricParams) {
  return Math.min(64, Math.ceil(31 / p.rate) + 1);
}

/** Deterministic value for tick t: the F-03 shape, time-scaled by rate and amplitude-scaled by intensity. */
export function parametricValues(p: ParametricParams, t: number): { level: number; rain: number } {
  const x = t * p.rate;
  let level = BASE + (lerp(F03.level, x) - BASE) * p.intensity;
  let rain = lerp(F03.rain, x) * p.intensity;
  if (p.seed) {
    const r = prng(p.seed * 1000 + t);
    level += (r() - 0.5) * 3;
    rain += (r() - 0.5) * 0.1;
  }
  return { level: Math.round(Math.min(200, Math.max(0, level))), rain: Math.max(0, Math.round(rain * 10) / 10) };
}
