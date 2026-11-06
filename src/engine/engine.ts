import { actionsFor, reasonFor, recommendationText } from "./decide";
import { assessArea } from "./geo";
import { isEscalation, l0Status } from "./l0";
import { assessL1, L1_PARAMS } from "./l1";
import { buildAreas, diffPlans, planStatus, summarize } from "./plan";
import { RISK_LABEL, rankAreas } from "./rank";
import { computeRoute } from "./routes";
import type { EngineConfig, EngineEvent, EngineState, Frame, PlanVersion, Recommendation, ReviewStatus, RiskLevel, ValidatedReading } from "./types";
import { pad, validateFrame } from "./validate";
import { RULESET } from "./version";

export function initState(): EngineState {
  return {
    tick: -1,
    levels: [],
    rains: [],
    quality: [],
    l0: "normal",
    l0History: [],
    alerts: [],
    l1: null,
    l1History: [],
    areas: [],
    ranking: [],
    recs: [],
    plan: [],
    closures: [],
    routeTarget: null,
    route: null,
    seq: 0,
    recSeq: 0,
    alertSeq: 0,
    lastTimestamp: null,
  };
}

/** Collects events with deterministic, run-scoped ids. */
class Log {
  events: EngineEvent[] = [];
  constructor(private s: EngineState) {}
  add(e: Omit<EngineEvent, "event_id" | "seq">): string {
    const seq = ++this.s.seq;
    const event_id = `EV-${String(seq).padStart(5, "0")}`;
    this.events.push({ event_id, seq, ...e });
    return event_id;
  }
}

const clone = (s: EngineState): EngineState => structuredClone(s);

export interface StepResult {
  state: EngineState;
  events: EngineEvent[];
  readings: ValidatedReading[];
  /** The tick was rejected as a whole (duplicate / out of order). */
  rejected: string | null;
}

/**
 * The integrated workflow for one tick (spec §3.3):
 * validate → L0 → L1 → areas → ranking → recommendations → plan/route → events.
 */
export function step(prev: EngineState, frame: Frame, cfg: EngineConfig): StepResult {
  const s = clone(prev);
  const log = new Log(s);
  const t = frame.tick;
  const check = validateFrame(frame, cfg, s.tick, s.lastTimestamp);
  if (check.rejected) {
    log.add({ tick: t, type: "reading_rejected", source: "validation", reason: { en: `Frame rejected: ${check.rejected}`, ar: `رُفضت دفعة القراءات: ${check.rejected}` } });
    return { state: s, events: log.events, readings: [], rejected: check.rejected };
  }
  for (const m of check.missingTicks) {
    s.levels[m] = null;
    s.rains[m] = null;
    s.quality[m] = "invalid";
    s.l1History[m] = null;
    log.add({ tick: m, type: "reading_missing", source: "validation", reason: { en: `No readings received for T${pad(m)}`, ar: `لم تُستلم قراءات للدقيقة T${pad(m)}` } });
  }

  // 1–2. Receive + validate.
  const lvl = check.readings.find((r) => r.parameter === "water_level");
  const rain = check.readings.find((r) => r.parameter === "rainfall");
  for (const r of check.readings) {
    if (r.quality_status === "valid")
      log.add({ tick: t, type: "reading_received", source: "replay", entity_id: r.sensor_id, data: { value: r.value, unit: r.unit, quality_status: r.quality_status, data_source: r.data_source } });
    else log.add({ tick: t, type: "reading_rejected", source: "validation", entity_id: r.sensor_id, data: { value: r.value, issues: r.issues }, reason: { en: r.issues.join("; "), ar: r.issues.join("؛ ") } });
  }
  s.levels[t] = lvl?.quality_status === "valid" ? (lvl.value as number) : null;
  s.rains[t] = rain?.quality_status === "valid" ? (rain.value as number) : null;
  s.quality[t] = !lvl || lvl.quality_status !== "valid" ? "invalid" : !rain || rain.quality_status !== "valid" ? "suspect" : "valid";
  s.tick = t;
  s.lastTimestamp = frame.readings[0]?.timestamp ?? s.lastTimestamp;

  // 3. L0 — WTR-01 only (RAIN-01 has no L0 limit, F-03 R2). Invalid readings never change the status.
  if (s.levels[t] != null) {
    const next = l0Status(s.levels[t], cfg.limits.water_level);
    if (next !== s.l0) {
      log.add({ tick: t, type: "alert_status_changed", source: "L0", entity_id: "WTR-01", prev: s.l0, next, data: { value: s.levels[t] } });
      s.l0History.push({ tick: t, from: s.l0, to: next });
      if (isEscalation(s.l0, next)) {
        const limit = (next === "danger" ? cfg.limits.water_level.danger : cfg.limits.water_level.warning)!;
        const alert_id = `AL-${String(++s.alertSeq).padStart(3, "0")}`;
        s.alerts.push({ alert_id, tick: t, sensor_id: "WTR-01", level: next, value: s.levels[t]!, threshold: limit, acknowledged: false });
        log.add({ tick: t, type: "alert_created", source: "L0", entity_id: alert_id, next, data: { value: s.levels[t], threshold: limit } });
      }
      s.l0 = next;
    }
  }

  // 4. L1 — independent from L0 (never reads alert status).
  const prevL1 = s.l1?.risk_level ?? null;
  const everAbove = s.levels.slice(0, t).some((v) => v != null && v > L1_PARAMS.baselineMax);
  const l1 = assessL1(s.levels, s.rains, t, prevL1, everAbove, s.quality[t]);
  s.l1 = l1;
  s.l1History[t] = l1.risk_level;
  if (l1.risk_level !== prevL1)
    log.add({ tick: t, type: "risk_changed", source: "L1", entity_id: "ST-01", prev: prevL1, next: l1.risk_level, reason: l1.explanation, data: { rule: l1.rule, ruleset: RULESET.l1, indicators: l1.indicators } });

  // 5. Geospatial — independent assessment per area.
  const prevAreas = new Map(s.areas.map((a) => [a.area_id, a]));
  const areaEvent = new Map<string, string>();
  s.areas = cfg.areas.map((a) => {
    const before = prevAreas.get(a.id);
    const eff = a.lag_ticks == null ? [] : s.levels.slice(0, Math.max(0, t - a.lag_ticks)).map((v) => (v == null ? null : v - a.elevation_offset_cm));
    const above = eff.some((v) => v != null && v > L1_PARAMS.baselineMax);
    const r = assessArea(a, s.levels, s.rains, t, before, above);
    if (!before || before.risk !== r.risk || before.receding !== r.receding) {
      const id = log.add({ tick: t, type: "area_risk_changed", source: "geo", area_id: a.id, prev: before?.risk ?? null, next: r.risk, reason: r.reason, data: { ruleset: RULESET.area, indicators: r.indicators, input_ticks: r.input_ticks } });
      areaEvent.set(a.id, id);
    }
    if (before && before.affected !== r.affected)
      log.add({ tick: t, type: "area_affected_changed", source: "geo", area_id: a.id, prev: before.affected, next: r.affected, reason: r.reason });
    return r;
  });

  // 6. Ranking.
  const prevRank = s.ranking.map((r) => `${r.area_id}#${r.rank}`).join(",");
  s.ranking = rankAreas(cfg.areas, s.areas);
  const nowRank = s.ranking.map((r) => `${r.area_id}#${r.rank}`).join(",");
  if (prevRank !== nowRank)
    log.add({ tick: t, type: "ranking_changed", source: "rank", prev: prevRank || null, next: nowRank, data: { ruleset: RULESET.rank } });

  // 7. Decision support — area-based recommendations; history is preserved, never deleted.
  updateRecommendations(s, cfg, log, t, areaEvent);

  // 8. Response plan + virtual route.
  revisePlan(s, cfg, log, t, "conditions");

  return { state: s, events: log.events, readings: check.readings, rejected: null };
}

function updateRecommendations(s: EngineState, cfg: EngineConfig, log: Log, t: number, areaEvent: Map<string, string>) {
  const rankBy = new Map(s.ranking.map((r) => [r.area_id, r]));
  for (const area of cfg.areas) {
    const r = s.areas.find((x) => x.area_id === area.id)!;
    const rank = rankBy.get(area.id);
    const active = s.recs.filter((x) => x.active && x.area_id === area.id);
    const riskChanged = areaEvent.has(area.id);
    if (!riskChanged) {
      // Same situation: only keep priorities in step with the ranking.
      for (const rec of active)
        if (rank && rec.priority !== rank.rank) {
          log.add({ tick: t, type: "recommendation_updated", source: "decision", area_id: area.id, entity_id: rec.recommendation_id, prev: { priority: rec.priority }, next: { priority: rank.rank }, reason: { en: "Priority re-ranked", ar: "أُعيد ترتيب الأولوية" } });
          rec.priority = rank.rank;
          rec.updated_at_tick = t;
        }
      continue;
    }
    const wanted = actionsFor(r);
    const created: Recommendation[] = [];
    for (const action of wanted) {
      const old = active.find((x) => x.recommended_action === action) ?? active[0] ?? null;
      const text = recommendationText(action, area);
      const rec: Recommendation = {
        recommendation_id: `REC-${String(++s.recSeq).padStart(4, "0")}`,
        related_event_id: areaEvent.get(area.id)!,
        area_id: area.id,
        risk_level: r.risk,
        recommended_action: action,
        priority: rank?.rank ?? 0,
        reason: reasonFor(action, r, rank),
        supporting_data: { text, indicators: r.indicators, input_ticks: r.input_ticks, area_reason: r.reason, ruleset: RULESET.decide, area_rule: RULESET.area },
        created_at_tick: t,
        updated_at_tick: t,
        status: "proposed",
        active: true,
        supersedes_id: old?.recommendation_id ?? null,
        superseded_by: null,
        requires_review: action !== "monitor",
        reviewed_by: null,
        scenario_id: cfg.scenario_id,
      };
      created.push(rec);
      log.add({ tick: t, type: "recommendation_created", source: "decision", area_id: area.id, entity_id: rec.recommendation_id, prev: old ? { id: old.recommendation_id, action: old.recommended_action, risk: old.risk_level } : null, next: { action, risk: r.risk, priority: rec.priority, requires_review: rec.requires_review }, reason: rec.reason });
    }
    for (const old of active) {
      old.active = false;
      old.updated_at_tick = t;
      old.superseded_by = created.find((c) => c.recommended_action === old.recommended_action)?.recommendation_id ?? created[0]?.recommendation_id ?? null;
      const R = RISK_LABEL[r.risk];
      log.add({ tick: t, type: "recommendation_superseded", source: "decision", area_id: area.id, entity_id: old.recommendation_id, prev: { action: old.recommended_action, risk: old.risk_level, status: old.status }, next: old.superseded_by, reason: { en: `Area risk now ${R.en}; previous recommendation kept in history`, ar: `خطر المنطقة الآن ${R.ar}؛ التوصية السابقة محفوظة في السجل` } });
    }
    s.recs.push(...created);
  }
}

/** Creates a new plan version only when its content changed (spec §10.3). */
function revisePlan(s: EngineState, cfg: EngineConfig, log: Log, t: number, trigger: string) {
  // Route target: explicit operator choice, else the top-priority affected area.
  const auto = s.ranking.find((r) => s.areas.find((a) => a.area_id === r.area_id)?.affected)?.area_id ?? null;
  const target = s.routeTarget ?? auto;
  const prevRoute = s.route;
  s.route = target ? computeRoute(target, s.closures, prevRoute) : null;
  const sig = (r: typeof s.route) => (r ? `${r.target_area_id}|${r.status}|${r.edges.join(",")}` : "");
  if (sig(prevRoute) !== sig(s.route) && s.route) {
    if (s.route.status === "ok")
      log.add({ tick: t, type: "route_generated", source: "routes", area_id: s.route.target_area_id, prev: prevRoute?.edges ?? null, next: s.route.edges, reason: s.route.explanation, data: { ruleset: RULESET.route, excluded: s.route.excluded, simulated: true } });
    else log.add({ tick: t, type: "route_unavailable", source: "routes", area_id: s.route.target_area_id, prev: prevRoute?.edges ?? null, next: null, reason: s.route.explanation, data: { excluded: s.route.excluded } });
  }
  const areas = buildAreas(s.ranking, s.recs);
  const last = s.plan[s.plan.length - 1];
  const changes = diffPlans(last, areas, s.route);
  if (last && changes.length === 0) return;
  const version = (last?.version ?? 0) + 1;
  const change_reason = last ? summarize(changes) : { en: "Initial response plan", ar: "خطة الاستجابة الأولية" };
  const event_id = log.add({ tick: t, type: "plan_version_created", source: "plan", entity_id: `PLAN-1 v${version}`, prev: last ? last.version : null, next: version, reason: change_reason, data: { trigger, ruleset: RULESET.plan, changes: changes.length } });
  const pv: PlanVersion = { plan_id: "PLAN-1", version, tick: t, related_event_id: event_id, areas, route: s.route, changes, change_reason, plan_status: planStatus(areas) };
  s.plan.push(pv);
}

/** Human review of a recommendation (spec §9.3). Optimistic check against the plan version. */
export function review(prev: EngineState, cfg: EngineConfig, recId: string, status: ReviewStatus, by: string, planVersion?: number) {
  const current = prev.plan[prev.plan.length - 1]?.version;
  if (planVersion != null && current != null && planVersion !== current)
    return { error: "stale_plan_version" as const, current };
  const s = clone(prev);
  const log = new Log(s);
  const rec = s.recs.find((r) => r.recommendation_id === recId);
  if (!rec) return { error: "not_found" as const };
  if (!rec.active) return { error: "superseded" as const };
  const before = rec.status;
  rec.status = status;
  rec.reviewed_by = by;
  log.add({ tick: s.tick, type: "recommendation_reviewed", source: "operator", area_id: rec.area_id, entity_id: recId, prev: before, next: status, data: { by } });
  // Reflect approval status in the current plan version without rewriting history.
  const pv = s.plan[s.plan.length - 1];
  if (pv) {
    for (const a of pv.areas) for (const x of a.actions) if (x.recommendation_id === recId) x.status = status;
    pv.plan_status = planStatus(pv.areas);
  }
  void cfg;
  return { state: s, events: log.events };
}

/** Operator toggles a virtual road closure; the route and plan are re-evaluated immediately. */
export function setClosure(prev: EngineState, cfg: EngineConfig, edgeId: string, closed: boolean, by: string) {
  const s = clone(prev);
  const log = new Log(s);
  const was = s.closures.includes(edgeId);
  if (was === closed) return { state: s, events: [] };
  s.closures = closed ? [...s.closures, edgeId].sort() : s.closures.filter((e) => e !== edgeId);
  log.add({ tick: s.tick, type: "road_status_changed", source: "operator", entity_id: edgeId, prev: was ? "closed" : "open", next: closed ? "closed" : "open", data: { by, virtual: true }, reason: { en: `Virtual segment ${edgeId} ${closed ? "closed" : "reopened"} by ${by}`, ar: `${closed ? "أُغلق" : "أُعيد فتح"} المقطع الافتراضي ${edgeId} بواسطة ${by}` } });
  if (s.tick >= 0) revisePlan(s, cfg, log, s.tick, "road_closure");
  return { state: s, events: log.events };
}

export function setRouteTarget(prev: EngineState, cfg: EngineConfig, areaId: string | null) {
  const s = clone(prev);
  const log = new Log(s);
  s.routeTarget = areaId;
  if (s.tick >= 0) revisePlan(s, cfg, log, s.tick, "route_target");
  return { state: s, events: log.events };
}

export function acknowledgeAlert(prev: EngineState, alertId: string, by: string) {
  const s = clone(prev);
  const log = new Log(s);
  const a = s.alerts.find((x) => x.alert_id === alertId);
  if (!a || a.acknowledged) return { state: s, events: [] };
  a.acknowledged = true;
  log.add({ tick: s.tick, type: "alert_acknowledged", source: "operator", entity_id: alertId, data: { by } });
  return { state: s, events: log.events };
}

/** Run a whole frame list through the engine (tests, Verification Center, scrubber). */
export function runAll(frames: Frame[], cfg: EngineConfig, upTo = Infinity) {
  let state = initState();
  const events: EngineEvent[] = [];
  const perTick: { tick: number; l0: EngineState["l0"]; l1: RiskLevel | null; activeWarning: number; activeCritical: number; alerts: number }[] = [];
  for (const f of frames) {
    if (f.tick > upTo) break;
    const r = step(state, f, cfg);
    state = r.state;
    events.push(...r.events);
    perTick.push({
      tick: f.tick,
      l0: state.l0,
      l1: state.l1?.risk_level ?? null,
      activeWarning: state.l0 === "warning" ? 1 : 0,
      activeCritical: state.l0 === "danger" ? 1 : 0,
      alerts: state.alerts.length,
    });
  }
  return { state, events, perTick };
}

/** Run-control / system events (start, pause, …) share the run's sequence so the log stays ordered. */
export function logEvent(prev: EngineState, e: Omit<EngineEvent, "event_id" | "seq">) {
  const s = clone(prev);
  const log = new Log(s);
  log.add(e);
  return { state: s, events: log.events };
}
