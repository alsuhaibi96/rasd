import { describe, expect, it } from "vitest";
import { makeConfig } from "./config";
import { acknowledgeAlert, initState, review, runAll, setClosure, step } from "./engine";
import { ADIREA_AREAS } from "./geo";
import { FORBIDDEN, RECOMMENDATION_FOOTER } from "./l1";
import { rankAreas } from "./rank";
import { computeRoute } from "./routes";
import { frameAt, scenarioLength, SCRIPTED_F03, type ScenarioSpec } from "./scenarios";
import { F03 } from "./scenarios/f03";
import { F03_DASHBOARD, F03_EXPECTED, F03_EXPLANATIONS, F03_RECOMMENDATIONS } from "./scenarios/f03.expected";
import type { AreaDef, AreaResult } from "./types";
import { project } from "./whatif";

const T0 = "2026-11-05T09:00:00.000Z";
const cfg = makeConfig();
const frames = (s: ScenarioSpec = SCRIPTED_F03) => Array.from({ length: scenarioLength(s) }, (_, t) => frameAt(s, t, T0));

function runF03() {
  let st = initState();
  const perTick = [];
  for (const f of frames()) {
    st = step(st, f, cfg).state;
    perTick.push(structuredClone(st));
  }
  return perTick;
}
const states = runF03();

describe("F-03 input fidelity (TC-02)", () => {
  it("replays exactly the 64 Section 4 values tagged simulated / FLOOD-F03 (TC-01)", () => {
    const fs = frames();
    expect(fs).toHaveLength(32);
    fs.forEach((f, t) => {
      expect(f.readings.map((r) => r.value)).toEqual([F03.level[t], F03.rain[t]]);
      for (const r of f.readings) {
        expect(r.data_source).toBe("simulated");
        expect(r.scenario_id).toBe("FLOOD-F03");
      }
    });
  });
});

describe("F-03 per-tick L0 and L1 (TC-04, TC-05, TC-12)", () => {
  F03_EXPECTED.forEach(([r10, rise, RF, LR, LH, risk, l0, note], t) => {
    it(`T${String(t).padStart(2, "0")}`, () => {
      const s = states[t];
      const i = s.l1!.indicators;
      expect(i.r10).toBeCloseTo(r10, 6);
      expect(i.rise_3).toBe(rise);
      expect([+i.RF, +i.LR, +i.LH]).toEqual([RF, LR, LH]);
      expect(s.l1!.risk_level).toBe(risk);
      expect(s.l0).toBe(l0);
      expect(s.l1!.warmup).toBe(note === "warm-up");
      expect(s.l1!.receding).toBe(note === "receding");
      expect(s.l1!.confidence).toBe("not_applicable_rule_based");
    });
  });
});

describe("F-03 explanations and recommendations (TC-08, TC-09)", () => {
  for (const [t, text] of Object.entries(F03_EXPLANATIONS))
    it(`explanation T${t} matches Section 7 exactly`, () => expect(states[+t].l1!.explanation.en).toBe(text));
  it("recommendation wording matches Section 8.3 and contains no forbidden wording", () => {
    for (const s of states) {
      const rec = s.l1!.recommendation;
      expect(rec.en).toBe(F03_RECOMMENDATIONS[rec.key]);
      for (const re of FORBIDDEN) expect(re.test(rec.en) || re.test(rec.ar)).toBe(false);
    }
    expect(RECOMMENDATION_FOOTER.en).toBe("Decision support only. Not an official warning. Human review required. Simulated data.");
  });
});

describe("F-03 alert behaviour and dashboard counters (TC-13, TC-16, TC-17)", () => {
  it("creates exactly a Warning at T15 and a Critical at T18; RAIN-01 creates none", () => {
    const s = states[31];
    expect(s.alerts.map((a) => [a.tick, a.level, a.sensor_id])).toEqual([[15, "warning", "WTR-01"], [18, "danger", "WTR-01"]]);
  });
  it("records every status transition and keeps history after returning to Normal", () => {
    expect(states[31].l0History.map((h) => [h.tick, h.to])).toEqual([[15, "warning"], [18, "danger"], [24, "warning"], [26, "normal"]]);
    expect(states[31].alerts).toHaveLength(2);
  });
  for (const [t, [w, c, n]] of Object.entries(F03_DASHBOARD))
    it(`Section 9 counters at T${t}`, () => {
      const s = states[+t];
      expect([s.l0 === "warning" ? 1 : 0, s.l0 === "danger" ? 1 : 0, s.alerts.length]).toEqual([w, c, n]);
    });
  it("acknowledgement keeps the alert record", () => {
    const r = acknowledgeAlert(states[31], "AL-001", "op");
    expect(r.state.alerts).toHaveLength(2);
    expect(r.state.alerts[0].acknowledged).toBe(true);
  });
});

describe("Determinism (TC-03) and concept separation (TC-07)", () => {
  it("two runs produce identical event logs", () => {
    const a = runAll(frames(), cfg).events;
    const b = runAll(frames(), cfg).events;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it("'critical' never labels a risk level and 'severe' never an alert status", () => {
    for (const s of states) {
      expect(["normal", "warning", "danger"]).toContain(s.l0);
      expect(["low", "moderate", "elevated", "severe"]).toContain(s.l1!.risk_level);
    }
  });
  it("L1 does not depend on L0 limits", () => {
    const other = makeConfig({ warning: 10, danger: 20, direction: "above", min_value: 0, max_value: 200 });
    const a = runAll(frames(), cfg).perTick.map((p) => p.l1);
    const b = runAll(frames(), other).perTick.map((p) => p.l1);
    expect(a).toEqual(b);
  });
});

describe("Data validation (AT-03)", () => {
  it("rejects invalid values, units, sources, duplicates and flags missing ticks", () => {
    let st = initState();
    st = step(st, frameAt(SCRIPTED_F03, 0, T0), cfg).state;
    const bad = frameAt(SCRIPTED_F03, 1, T0);
    bad.readings[0] = { ...bad.readings[0], value: 999 };
    bad.readings[1] = { ...bad.readings[1], unit: "mm" };
    const r = step(st, bad, cfg);
    expect(r.readings.map((x) => x.quality_status)).toEqual(["invalid", "invalid"]);
    expect(r.state.levels[1]).toBeNull();
    expect(r.state.l1!.risk_level).toBeNull(); // Unavailable, not invented
    expect(step(r.state, frameAt(SCRIPTED_F03, 1, T0), cfg).rejected).toMatch(/duplicate/);
    const gap = step(r.state, frameAt(SCRIPTED_F03, 4, T0), cfg);
    expect(gap.events.filter((e) => e.type === "reading_missing").map((e) => e.tick)).toEqual([2, 3]);
    const live = frameAt(SCRIPTED_F03, 2, T0);
    live.readings = live.readings.map((x) => ({ ...x, data_source: "real" as const }));
    expect(step(r.state, live, cfg).readings.every((x) => x.quality_status === "invalid")).toBe(true);
  });
});

describe("Areas, ranking, recommendations, plan (AT-07…AT-14)", () => {
  it("assesses each area independently with No Data before water can reach it", () => {
    const s0 = states[0];
    const by = (s: typeof s0, id: string) => s.areas.find((a) => a.area_id === id)!;
    expect(by(s0, "AR-01").risk).toBe("low");
    expect(by(s0, "AR-04").risk).toBe("no_data");
    expect(by(s0, "AR-08").risk).toBe("unaffected");
    expect(by(states[14], "AR-01").risk).toBe("severe");
    expect(by(states[14], "AR-07").risk).not.toBe("severe");
    // AR-07 sits 45 cm above the gauge: never reaches Severe in F-03.
    expect(states.every((s) => by(s, "AR-07").risk !== "severe")).toBe(true);
  });
  it("ranks by risk, exposure, lag and reports ties instead of inventing differences", () => {
    const twins: AreaDef[] = [
      { ...ADIREA_AREAS[0], id: "X1" },
      { ...ADIREA_AREAS[0], id: "X2" },
      { ...ADIREA_AREAS[3], id: "X3" },
    ];
    const res: AreaResult[] = twins.map((a) => ({ area_id: a.id, risk: "elevated", affected: true, indicators: null, warmup: false, receding: false, quality: "valid", reason: { en: "", ar: "" }, input_ticks: [] }));
    const rows = rankAreas(twins, res);
    expect(rows.map((r) => [r.area_id, r.rank, r.tie])).toEqual([["X3", 1, false], ["X1", 2, true], ["X2", 2, true]]);
  });
  it("creates area-linked recommendations, supersedes instead of deleting", () => {
    const s = states[31];
    for (const r of s.recs) {
      expect(r.area_id).toMatch(/^AR-/);
      expect(r.related_event_id).toMatch(/^EV-/);
    }
    const superseded = s.recs.filter((r) => !r.active);
    expect(superseded.length).toBeGreaterThan(0);
    for (const r of superseded) expect(r.superseded_by).not.toBeNull();
    expect(s.recs.some((r) => r.recommended_action === "escalate" && r.area_id === "AR-01")).toBe(true);
    for (const r of s.recs) expect(JSON.stringify(r.supporting_data.text)).not.toMatch(/evacuat|predict|forecast/i);
  });
  it("versions the plan with explained changes and preserves history", () => {
    const s = states[31];
    expect(s.plan.length).toBeGreaterThan(5);
    s.plan.forEach((v, i) => expect(v.version).toBe(i + 1));
    for (const v of s.plan.slice(1)) {
      expect(v.changes.length).toBeGreaterThan(0);
      for (const c of v.changes) expect(c.reason.en.length).toBeGreaterThan(5);
    }
  });
  it("rejects approval against a stale plan version (spec §17.10)", () => {
    const s = states[20];
    const rec = s.recs.find((r) => r.active && r.requires_review)!;
    expect(review(s, cfg, rec.recommendation_id, "approved", "op", 1)).toMatchObject({ error: "stale_plan_version" });
    const ok = review(s, cfg, rec.recommendation_id, "approved", "op", s.plan.at(-1)!.version);
    expect("state" in ok && ok.state!.recs.find((r) => r.recommendation_id === rec.recommendation_id)!.status).toBe("approved");
  });
});

describe("Virtual routes (AT-15, AT-16)", () => {
  it("excludes a closed segment and finds an alternative", () => {
    const base = computeRoute("AR-04", [], null);
    expect(base.status).toBe("ok");
    const closed = base.edges[base.edges.length - 1];
    const alt = computeRoute("AR-04", [closed], base);
    expect(alt.status).toBe("ok");
    expect(alt.edges).not.toContain(closed);
    expect(alt.excluded.map((x) => x.edge_id)).toContain(closed);
  });
  it("reports no route when the target is isolated", () => {
    expect(computeRoute("AR-04", ["E04", "E05", "E23"], null).status).toBe("no_route");
  });
  it("re-plans when an operator closes a road during the run", () => {
    const s = states[16];
    const edge = s.route!.edges[0];
    const r = setClosure(s, cfg, edge, true, "op");
    expect(r.state.route!.edges).not.toContain(edge);
    expect(r.events.map((e) => e.type)).toEqual(expect.arrayContaining(["road_status_changed", "plan_version_created"]));
  });
});

describe("What-if isolation (AT-20…AT-22)", () => {
  it("projects 30 min without touching L0, L1, alerts or the event log", () => {
    const s = states[12];
    const before = JSON.stringify(s);
    const p = project(s, cfg, { horizon: 30, rain: "persist", damping: 0.85 })!;
    expect(p.ticks).toHaveLength(30);
    expect(p.label).toBe("What-if Projection – Simulation");
    expect(JSON.stringify(s)).toBe(before);
    expect(p.areas.find((a) => a.area_id === "AR-08")!.peak).toBe("unaffected");
    expect(JSON.stringify(p.ticks)).not.toMatch(/predict|forecast|evacuat/i);
  });
  it("stopping rain projects recession, persisting rain projects escalation", () => {
    const s = states[12];
    const stop = project(s, cfg, { horizon: 15, rain: "stop", damping: 0.85 })!;
    const keep = project(s, cfg, { horizon: 15, rain: "persist", damping: 0.85 })!;
    expect(stop.ticks.at(-1)!.level).toBeLessThan(keep.ticks.at(-1)!.level);
  });
});

describe("Parametric scenarios", () => {
  it("intensity changes readings and downstream outputs deterministically", () => {
    const hi: ScenarioSpec = { kind: "parametric", scenario_id: "FLOOD-PARAM", segments: [{ from_tick: 0, params: { intensity: 1.5, rate: 1, seed: 7 } }] };
    const c = makeConfig(undefined, "FLOOD-PARAM");
    const a = runAll(frames(hi), c);
    const b = runAll(frames(hi), c);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    const base = runAll(frames(), cfg);
    expect(Math.max(...a.state.levels.map((v) => v ?? 0))).toBeGreaterThan(Math.max(...base.state.levels.map((v) => v ?? 0)));
  });
});
