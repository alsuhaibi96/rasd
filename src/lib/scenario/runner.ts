import type { PoolClient } from "pg";
import {
  acknowledgeAlert as engineAck,
  DEFAULT_WATER_LIMITS,
  ENGINE_VERSION,
  type EngineConfig,
  type EngineEvent,
  type EngineState,
  frameAt,
  initState,
  logEvent,
  makeConfig,
  review as engineReview,
  RULESET,
  type ReviewStatus,
  setClosure as engineClosure,
  setRouteTarget as engineTarget,
  scenarioLength,
  type ScenarioSpec,
  SCRIPTED_F03,
  step,
  type ParametricParams,
  type Limits,
} from "@/engine";
import { pool } from "../db";
import { emitLocal, publish } from "../realtime";
import { SENSOR_COLS } from "../repo";
import type { LoggedEvent, RunStatus, RunView } from "../scenario-types";
import { setGeneratorPaused } from "../simulator";
import type { Alert, Reading, Sensor } from "../types";

interface Active {
  runId: number;
  spec: ScenarioSpec;
  cfg: EngineConfig;
  state: EngineState;
  status: RunStatus;
  speed: number;
  length: number;
  t0: string;
  startedBy: string;
  startedAt: string;
  timer?: NodeJS.Timeout;
  busy: boolean;
  readingIds: Record<number, { level?: number; rain?: number }>;
  alertDbIds: Record<string, number>;
  sensorIds: Record<string, number>;
  processingMs: number;
  lastTickAt: string | null;
}

const g = globalThis as unknown as { __rasdRun?: Active | null };
const active = () => g.__rasdRun ?? null;

export class RunError extends Error {
  constructor(message: string, public status = 400, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

function sameLimits(l: Limits) {
  return l.warning === DEFAULT_WATER_LIMITS.warning && l.danger === DEFAULT_WATER_LIMITS.danger && l.direction === "above";
}

export function currentRunView(): RunView | null {
  const a = active();
  if (!a) return null;
  const { plan, ...rest } = a.state;
  return {
    run_id: a.runId,
    scenario_id: a.spec.scenario_id,
    kind: a.spec.kind,
    segments: a.spec.segments,
    status: a.status,
    tick: a.state.tick,
    length: a.length,
    speed: a.speed,
    t0: a.t0,
    started_by: a.startedBy,
    started_at: a.startedAt,
    engine_version: ENGINE_VERSION,
    ruleset: { ...RULESET },
    limits: a.cfg.limits.water_level,
    limits_match_f03: sameLimits(a.cfg.limits.water_level),
    state: rest,
    plan_head: plan[plan.length - 1] ?? null,
    plan_count: plan.length,
    processing_ms: a.processingMs,
    last_tick_at: a.lastTickAt,
  };
}

export function activeRunConfig() {
  const a = active();
  return a ? { cfg: a.cfg, state: a.state, spec: a.spec, runId: a.runId } : null;
}

async function insertEvents(db: PoolClient | typeof pool, a: Active, events: EngineEvent[]): Promise<LoggedEvent[]> {
  const out: LoggedEvent[] = [];
  for (const e of events) {
    const { rows } = await db.query(
      `INSERT INTO events (run_id, event_id, seq, scenario_id, tick, type, source, area_id, entity_id, prev, next, reason, data, data_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'simulated') RETURNING id, created_at`,
      [a.runId, e.event_id, e.seq, a.spec.scenario_id, e.tick, e.type, e.source, e.area_id ?? null, e.entity_id ?? null, json(e.prev), json(e.next), json(e.reason), json(e.data)],
    );
    out.push({ ...e, id: rows[0].id, run_id: a.runId, scenario_id: a.spec.scenario_id, data_source: "simulated", created_at: rows[0].created_at });
  }
  return out;
}
const json = (v: unknown) => (v === undefined ? null : JSON.stringify(v));

async function persistRecsAndPlan(db: PoolClient, a: Active, prev: EngineState, next: EngineState) {
  const before = new Map(prev.recs.map((r) => [r.recommendation_id, JSON.stringify(r)]));
  for (const r of next.recs) {
    if (before.get(r.recommendation_id) === JSON.stringify(r)) continue;
    await db.query(
      `INSERT INTO recommendations (run_id, recommendation_id, related_event_id, scenario_id, area_id, risk_level, recommended_action, priority, reason, supporting_data, status, active, supersedes_id, superseded_by, requires_review, reviewed_by, created_tick, updated_tick)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (run_id, recommendation_id) DO UPDATE SET priority = EXCLUDED.priority, status = EXCLUDED.status, active = EXCLUDED.active,
         superseded_by = EXCLUDED.superseded_by, reviewed_by = EXCLUDED.reviewed_by, updated_tick = EXCLUDED.updated_tick, updated_at = now()`,
      [a.runId, r.recommendation_id, r.related_event_id, r.scenario_id, r.area_id, r.risk_level, r.recommended_action, r.priority, json(r.reason), json(r.supporting_data), r.status, r.active, r.supersedes_id, r.superseded_by, r.requires_review, r.reviewed_by, r.created_at_tick, r.updated_at_tick],
    );
  }
  for (const v of next.plan.slice(prev.plan.length)) {
    await db.query(
      `INSERT INTO plan_versions (run_id, plan_id, version, tick, related_event_id, snapshot, changes, change_reason, plan_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [a.runId, v.plan_id, v.version, v.tick, v.related_event_id, json({ areas: v.areas, route: v.route }), json(v.changes), json(v.change_reason), v.plan_status],
    );
  }
  // Approval status lives on the current version too.
  const head = next.plan[next.plan.length - 1];
  const prevHead = prev.plan[prev.plan.length - 1];
  if (head && prevHead && head.version === prevHead.version && JSON.stringify(head) !== JSON.stringify(prevHead))
    await db.query("UPDATE plan_versions SET snapshot = $4, plan_status = $5 WHERE run_id = $1 AND plan_id = $2 AND version = $3", [a.runId, head.plan_id, head.version, json({ areas: head.areas, route: head.route }), head.plan_status]);
}

function broadcast(events: LoggedEvent[]) {
  if (events.length) emitLocal({ type: "events", events });
  emitLocal({ type: "run", run: currentRunView() });
}

/** One replay tick through the engine, persisted atomically, then broadcast. */
async function tick(a: Active) {
  if (a.busy || a.status !== "running") return;
  const t = a.state.tick + 1;
  if (t >= a.length) return complete(a);
  a.busy = true;
  const started = performance.now();
  const db = await pool.connect();
  let logged: LoggedEvent[] = [];
  const out: { sensor: Sensor; reading: Reading }[] = [];
  const newAlerts: Alert[] = [];
  try {
    const frame = frameAt(a.spec, t, a.t0);
    const prev = a.state;
    const r = step(prev, frame, a.cfg);
    await db.query("BEGIN");
    a.readingIds[t] = {};
    for (const v of r.readings) {
      if (v.value == null || !Number.isFinite(v.value)) continue;
      const isLevel = v.parameter === "water_level";
      const status = isLevel ? (v.quality_status === "valid" ? r.state.l0 : "unknown") : "unknown";
      const ins = await db.query(
        `INSERT INTO readings (sensor_id, value, status, source, data_source, scenario_id, run_id, tick, quality_status)
         VALUES ($1,$2,$3,'simulator',$4,$5,$6,$7,$8) RETURNING *`,
        [a.sensorIds[v.sensor_id], v.value, status, v.data_source, v.scenario_id, a.runId, t, v.quality_status],
      );
      const reading: Reading = ins.rows[0];
      a.readingIds[t][isLevel ? "level" : "rain"] = reading.id;
      if (v.quality_status !== "valid") continue;
      const upd = await db.query(
        `UPDATE sensors SET last_value=$2, last_status=$3, last_source='simulator', last_seen_at=$4, last_data_source=$5, last_scenario_id=$6
          WHERE id=$1 RETURNING ${SENSOR_COLS}`,
        [a.sensorIds[v.sensor_id], v.value, status, reading.created_at, v.data_source, v.scenario_id],
      );
      out.push({ sensor: upd.rows[0], reading });
    }
    for (const h of r.state.l0History.slice(prev.l0History.length))
      await db.query("INSERT INTO alert_transitions (run_id, sensor_code, tick, from_status, to_status, value) VALUES ($1,'WTR-01',$2,$3,$4,$5)", [a.runId, h.tick, h.from, h.to, r.state.levels[h.tick]]);
    for (const al of r.state.alerts.slice(prev.alerts.length)) {
      const ins = await db.query(
        `INSERT INTO alerts (sensor_id, reading_id, level, value, threshold, source, data_source, scenario_id, run_id, tick)
         VALUES ($1,$2,$3,$4,$5,'simulator','simulated',$6,$7,$8) RETURNING *`,
        [a.sensorIds[al.sensor_id], a.readingIds[t].level ?? null, al.level, al.value, al.threshold, a.spec.scenario_id, a.runId, al.tick],
      );
      a.alertDbIds[al.alert_id] = ins.rows[0].id;
      newAlerts.push(ins.rows[0]);
    }
    const l1 = r.state.l1!;
    const ids: number[] = [];
    for (const k of [t, t - 3]) if (a.readingIds[k]?.level) ids.push(a.readingIds[k].level!);
    for (let k = Math.max(0, t - 9); k <= t; k++) if (a.readingIds[k]?.rain) ids.push(a.readingIds[k].rain!);
    await db.query(
      `INSERT INTO assessments (run_id, scenario_id, tick, stage, station_code, risk_level, indicators, warmup, receding, quality_status, rule, explanation, recommendation, ruleset, input_reading_ids)
       VALUES ($1,$2,$3,'L1','ST-01',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [a.runId, a.spec.scenario_id, t, l1.risk_level, json(l1.indicators), l1.warmup, l1.receding, l1.quality, l1.rule, json(l1.explanation), json(l1.recommendation), RULESET.l1, ids],
    );
    const rank = new Map(r.state.ranking.map((x) => [x.area_id, x]));
    for (const ar of r.state.areas)
      await db.query(
        `INSERT INTO area_assessments (run_id, tick, area_id, risk, affected, rank, tie, reason, indicators, input_ticks) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [a.runId, t, ar.area_id, ar.risk, ar.affected, rank.get(ar.area_id)?.rank ?? null, rank.get(ar.area_id)?.tie ?? false, json(ar.reason), json(ar.indicators), ar.input_ticks],
      );
    await persistRecsAndPlan(db, a, prev, r.state);
    logged = await insertEvents(db, a, r.events);
    await db.query("UPDATE scenario_runs SET tick = $2 WHERE id = $1", [a.runId, t]);
    await db.query("COMMIT");
    a.state = r.state;
    a.processingMs = Math.round((performance.now() - started) * 10) / 10;
    a.lastTickAt = new Date().toISOString();
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    console.error("[scenario] tick failed", e);
    const ev = logEvent(a.state, { tick: a.state.tick, type: "system_error", source: "runner", reason: { en: (e as Error).message, ar: (e as Error).message } });
    a.state = ev.state;
    logged = await insertEvents(pool, a, ev.events).catch(() => []);
    a.status = "paused";
    clearTimeout(a.timer);
  } finally {
    db.release();
    a.busy = false;
  }
  for (const o of out) await publish({ type: "reading", ...o });
  for (const al of newAlerts) await publish({ type: "alert", alert: al });
  broadcast(logged);
}

function schedule(a: Active) {
  clearTimeout(a.timer);
  if (a.status !== "running") return;
  a.timer = setTimeout(async () => {
    await tick(a);
    if (active() === a) schedule(a);
  }, 1000 / a.speed);
}

async function control(a: Active, type: string, reason: { en: string; ar: string }, data: Record<string, unknown> = {}) {
  const r = logEvent(a.state, { tick: a.state.tick, type, source: "control", reason, data });
  a.state = r.state;
  const logged = await insertEvents(pool, a, r.events);
  await pool.query("UPDATE scenario_runs SET status = $2, speed = $3, segments = $4, length = $5 WHERE id = $1", [a.runId, a.status, a.speed, json(a.spec.segments), a.length]);
  broadcast(logged);
}

async function complete(a: Active) {
  a.status = "completed";
  clearTimeout(a.timer);
  await pool.query("UPDATE scenario_runs SET ended_at = now(), final_state = $2 WHERE id = $1", [a.runId, json(a.state)]);
  await control(a, "scenario_completed", { en: `Scenario completed at T${String(a.state.tick).padStart(2, "0")}`, ar: `اكتمل السيناريو عند T${String(a.state.tick).padStart(2, "0")}` });
}

export interface StartInput {
  kind: "scripted" | "parametric";
  params?: ParametricParams;
  speed?: number;
  by: string;
}

export async function startRun(input: StartInput): Promise<RunView> {
  const prev = active();
  if (prev) await stopRun(prev.startedBy, true);
  const spec: ScenarioSpec =
    input.kind === "scripted" ? SCRIPTED_F03 : { kind: "parametric", scenario_id: "FLOOD-PARAM", segments: [{ from_tick: 0, params: clampParams(input.params) }] };
  const th = await pool.query("SELECT warning, danger, direction, min_value, max_value FROM thresholds WHERE sensor_type = 'water_level'");
  const limits: Limits = th.rows[0] ?? DEFAULT_WATER_LIMITS;
  const cfg = makeConfig(limits, spec.scenario_id);
  const sensors = await pool.query("SELECT id, code FROM sensors WHERE code = ANY($1)", [["WTR-01", "RAIN-01"]]);
  if (sensors.rowCount !== 2) throw new RunError("WTR-01 / RAIN-01 sensors are missing — run db:setup", 500);
  const t0 = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const length = scenarioLength(spec);
  const speed = clampSpeed(input.speed ?? 1);
  const { rows } = await pool.query(
    `INSERT INTO scenario_runs (scenario_id, kind, segments, engine_version, ruleset, limits, t0, status, length, speed, started_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'running',$8,$9,$10) RETURNING id, started_at`,
    [spec.scenario_id, spec.kind, json(spec.segments), ENGINE_VERSION, json(RULESET), json(limits), t0, length, speed, input.by],
  );
  const a: Active = {
    runId: rows[0].id,
    spec,
    cfg,
    state: initState(),
    status: "running",
    speed,
    length,
    t0,
    startedBy: input.by,
    startedAt: rows[0].started_at,
    busy: false,
    readingIds: {},
    alertDbIds: {},
    sensorIds: Object.fromEntries(sensors.rows.map((s) => [s.code, s.id])),
    processingMs: 0,
    lastTickAt: null,
  };
  g.__rasdRun = a;
  setGeneratorPaused(true);
  await control(a, "scenario_started", { en: `${spec.kind === "scripted" ? "Scripted" : "Parametric"} scenario ${spec.scenario_id} started by ${input.by}`, ar: `بدأ سيناريو ${spec.scenario_id} (${spec.kind === "scripted" ? "مُعدّ مسبقًا" : "بارامتري"}) بواسطة ${input.by}` }, {
    kind: spec.kind,
    segments: spec.segments,
    limits,
    engine_version: ENGINE_VERSION,
    generator: "paused (replay isolation)",
  });
  schedule(a);
  return currentRunView()!;
}

const clampSpeed = (s: number) => ([0.5, 1, 2, 4, 8].includes(s) ? s : 1);
function clampParams(p?: Partial<ParametricParams>): ParametricParams {
  const c = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  return { intensity: c(p?.intensity, 0.5, 2, 1), rate: c(p?.rate, 0.5, 2, 1), seed: Math.round(c(p?.seed, 0, 99999, 0)) };
}

function need(runId?: number) {
  const a = active();
  if (!a || (runId != null && a.runId !== runId)) throw new RunError("No active run with this id", 404);
  return a;
}

export async function pauseRun(runId: number, by: string) {
  const a = need(runId);
  if (a.status !== "running") throw new RunError("Run is not running", 409);
  a.status = "paused";
  clearTimeout(a.timer);
  await control(a, "scenario_paused", { en: `Paused by ${by}`, ar: `أُوقف مؤقتًا بواسطة ${by}` });
}
export async function resumeRun(runId: number, by: string) {
  const a = need(runId);
  if (a.status !== "paused") throw new RunError("Run is not paused", 409);
  a.status = "running";
  await control(a, "scenario_resumed", { en: `Resumed by ${by}`, ar: `استُؤنف بواسطة ${by}` });
  schedule(a);
}
export async function restartRun(runId: number, by: string) {
  const a = need(runId);
  const params = a.spec.kind === "parametric" ? a.spec.segments[0].params : undefined;
  await control(a, "scenario_restarted", { en: `Restarted by ${by} as a new run (history preserved)`, ar: `أُعيد التشغيل بواسطة ${by} كتشغيل جديد (السجل محفوظ)` });
  return startRun({ kind: a.spec.kind, params, speed: a.speed, by });
}
export async function setSpeed(runId: number, speed: number, by: string) {
  const a = need(runId);
  const before = a.speed;
  a.speed = clampSpeed(speed);
  await control(a, "scenario_speed_changed", { en: `Playback speed ${before}× → ${a.speed}× (${by})`, ar: `سرعة التشغيل ${before}× ← ${a.speed}× (${by})` }, { from: before, to: a.speed });
  schedule(a);
}
/** Parametric only: new parameters apply from the next tick; earlier readings are kept as they were. */
export async function setParams(runId: number, params: Partial<ParametricParams>, by: string) {
  const a = need(runId);
  if (a.spec.kind !== "parametric") throw new RunError("Scripted scenarios have locked parameters", 409);
  if (a.status === "completed") throw new RunError("Run already completed", 409);
  const prev = a.spec.segments[a.spec.segments.length - 1].params;
  const next = clampParams({ ...prev, ...params });
  const from = a.state.tick + 1;
  a.spec = { ...a.spec, segments: [...a.spec.segments.filter((s) => s.from_tick < from), { from_tick: from, params: next }] };
  a.length = Math.max(a.state.tick + 2, scenarioLength(a.spec));
  await control(a, "scenario_params_changed", { en: `Parameters changed from T${String(from).padStart(2, "0")}: intensity ${prev.intensity}→${next.intensity}, rate ${prev.rate}→${next.rate}, seed ${prev.seed}→${next.seed}`, ar: `تغيّرت المعاملات اعتبارًا من T${String(from).padStart(2, "0")}: الشدة ${prev.intensity}←${next.intensity}، المعدل ${prev.rate}←${next.rate}، البذرة ${prev.seed}←${next.seed}` }, { from_tick: from, prev, next, by });
}

/** Leave simulation mode: the background generator resumes and the dashboard returns to normal scope. */
export async function stopRun(by: string, replaced = false) {
  const a = active();
  if (!a) return;
  clearTimeout(a.timer);
  const wasDone = a.status === "completed";
  if (!wasDone) a.status = "stopped";
  await pool.query("UPDATE scenario_runs SET ended_at = COALESCE(ended_at, now()), final_state = COALESCE(final_state, $2) WHERE id = $1", [a.runId, json(a.state)]);
  await control(a, "scenario_session_ended", { en: replaced ? `Session ended (new run started by ${by})` : `Simulation session ended by ${by}; generator resumed`, ar: replaced ? `انتهت الجلسة (بدأ تشغيل جديد بواسطة ${by})` : `أنهى ${by} جلسة المحاكاة؛ استُؤنف المولّد` });
  g.__rasdRun = null;
  setGeneratorPaused(false);
  emitLocal({ type: "run", run: null });
}

async function applyHuman(a: Active, next: EngineState, events: EngineEvent[]) {
  const db = await pool.connect();
  let logged: LoggedEvent[] = [];
  try {
    await db.query("BEGIN");
    await persistRecsAndPlan(db, a, a.state, next);
    logged = await insertEvents(db, a, events);
    await db.query("COMMIT");
    a.state = next;
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    db.release();
  }
  broadcast(logged);
}

export async function reviewRecommendation(runId: number, recId: string, status: ReviewStatus, by: string, planVersion?: number) {
  const a = need(runId);
  const r = engineReview(a.state, a.cfg, recId, status, by, planVersion);
  if ("error" in r) {
    if (r.error === "stale_plan_version") throw new RunError("The response plan changed while you were reviewing. Review the new version.", 409, { current: r.current });
    throw new RunError(r.error === "superseded" ? "This recommendation was superseded" : "Recommendation not found", r.error === "superseded" ? 409 : 404);
  }
  await applyHuman(a, r.state!, r.events!);
}

export async function setRoadClosure(runId: number, edgeId: string, closed: boolean, by: string) {
  const a = need(runId);
  const r = engineClosure(a.state, a.cfg, edgeId, closed, by);
  await applyHuman(a, r.state, r.events);
}

export async function setRouteTargetArea(runId: number, areaId: string | null, by: string) {
  const a = need(runId);
  const r = engineTarget(a.state, a.cfg, areaId);
  const tagged = r.events.map((e) => ({ ...e, data: { ...e.data, by } }));
  await applyHuman(a, r.state, tagged);
}

/** Called after a DB alert is acknowledged, to keep the engine's copy in step. */
export async function onAlertAcknowledged(alert: Alert, by: string) {
  const a = active();
  if (!a || alert.run_id !== a.runId) return;
  const engineId = Object.entries(a.alertDbIds).find(([, id]) => id === alert.id)?.[0];
  if (!engineId) return;
  const r = engineAck(a.state, engineId, by);
  await applyHuman(a, r.state, r.events);
}

export async function logWhatIf(data: Record<string, unknown>, by: string) {
  const a = active();
  if (!a) return;
  const r = logEvent(a.state, { tick: a.state.tick, type: "whatif_executed", source: "whatif", data: { ...data, by }, reason: { en: "What-if Projection – Simulation executed (no effect on L0/L1)", ar: "نُفّذ إسقاط «ماذا لو» – محاكاة (دون أثر على L0/L1)" } });
  a.state = r.state;
  broadcast(await insertEvents(pool, a, r.events));
}

/** Mark runs that were live when the process stopped (called at boot). */
export async function markInterrupted() {
  await pool.query("UPDATE scenario_runs SET status = 'interrupted', ended_at = now() WHERE status IN ('running', 'paused')").catch(() => {});
}
