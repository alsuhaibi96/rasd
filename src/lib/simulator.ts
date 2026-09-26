import { pool } from "./db";
import { ingestReading } from "./ingest";
import type { Sensor, SensorType } from "./types";

interface Profile {
  base: number;
  noise: number;
  surge: [number, number];
  min: number;
  max: number;
}

/** Baseline behaviour per sensor type; a "surge" pulls the value toward a hazardous level for a while. */
export const PROFILES: Record<SensorType, Profile> = {
  water_level: { base: 24, noise: 1.2, surge: [66, 96], min: 0, max: 200 },
  smoke_gas: { base: 170, noise: 12, surge: [330, 760], min: 0, max: 4095 },
  temperature: { base: 36, noise: 0.35, surge: [45.5, 52], min: -10, max: 60 },
  humidity: { base: 42, noise: 1.2, surge: [82, 96], min: 0, max: 100 },
  pressure: { base: 1011, noise: 0.5, surge: [984, 999], min: 950, max: 1050 },
  vibration: { base: 0.03, noise: 0.01, surge: [0.32, 0.85], min: 0, max: 2 },
};

const SURGE_CHANCE = 0.004;
const DEVICE_GRACE_MS = 2 * 60_000;

interface SimState {
  value: number;
  target: number;
  surgeTicks: number;
}

interface Sim {
  timer?: NodeJS.Timeout;
  state: Map<number, SimState>;
  ticks: number;
}
const g = globalThis as unknown as { __rasdSim?: Sim };
const sim: Sim = (g.__rasdSim ??= { state: new Map(), ticks: 0 });

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, p: Profile) => Math.min(p.max, Math.max(p.min, v));

function nextValue(s: Sensor): number {
  const p = PROFILES[s.type];
  let st = sim.state.get(s.id);
  if (!st) {
    st = { value: s.last_value ?? p.base, target: p.base, surgeTicks: 0 };
    sim.state.set(s.id, st);
  }
  if (st.surgeTicks > 0) {
    if (--st.surgeTicks === 0) st.target = p.base;
  } else if (Math.random() < SURGE_CHANCE) {
    st.target = rand(...p.surge);
    st.surgeTicks = Math.round(rand(18, 45));
  }
  st.value = clamp(st.value + (st.target - st.value) * 0.18 + (Math.random() - 0.5) * 2 * p.noise, p);
  return st.value;
}

/** A sensor is simulated unless a real device reported for it recently. */
function isSimulated(s: Sensor) {
  return !(s.last_source === "device" && s.last_seen_at && Date.now() - Date.parse(s.last_seen_at) < DEVICE_GRACE_MS);
}

export async function simulateTick() {
  const { rows } = await pool.query<Sensor>("SELECT * FROM sensors ORDER BY id");
  for (const s of rows.filter(isSimulated)) {
    const decimals = s.type === "vibration" ? 3 : 1;
    await ingestReading(s.code, Number(nextValue(s).toFixed(decimals)), "simulator");
  }
  // Keep the demo database small: hourly prune of old simulated readings.
  if (++sim.ticks % 900 === 0) {
    await pool.query("DELETE FROM readings WHERE source = 'simulator' AND created_at < now() - interval '2 days'");
  }
}

/** Force a surge on a sensor now (used by the "simulate reading" button with a target level). */
export function forceSurge(sensorId: number, type: SensorType, target: number) {
  const st = sim.state.get(sensorId) ?? { value: PROFILES[type].base, target, surgeTicks: 0 };
  st.target = target;
  st.surgeTicks = 25;
  sim.state.set(sensorId, st);
}

export function startSimulator() {
  if (sim.timer || process.env.SIMULATOR === "off") return;
  const every = Number(process.env.SIMULATOR_INTERVAL_MS) || 4000;
  let busy = false;
  sim.timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await simulateTick();
    } catch (e) {
      console.error("[simulator]", (e as Error).message);
    } finally {
      busy = false;
    }
  }, every);
  console.log(`[simulator] running every ${every}ms`);
}
