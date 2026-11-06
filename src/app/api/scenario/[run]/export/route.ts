import { NextResponse } from "next/server";
import { RISK_LABEL } from "@/engine";
import { handler } from "@/lib/api";
import { pool } from "@/lib/db";
import { RunError } from "@/lib/scenario/runner";

type Ctx = { params: Promise<{ run: string }> };
const LABEL = "SIMULATED SCENARIO – NOT LIVE DATA";
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const L0 = { normal: "Normal", warning: "Warning", danger: "Critical", unknown: "—" } as Record<string, string>;

/** Evidence export for one run (spec §11.5, §19.2): ?format=json | html (printable, watermarked). */
export const GET = handler(async (_u, req: Request, ctx: Ctx) => {
  const run = Number((await ctx.params).run);
  const format = new URL(req.url).searchParams.get("format") ?? "html";
  const meta = (await pool.query("SELECT * FROM scenario_runs WHERE id = $1", [run])).rows[0];
  if (!meta) throw new RunError("Run not found", 404);
  const [readings, assessments, alerts, plans, events, recs] = await Promise.all([
    pool.query("SELECT r.tick, s.code, r.value, r.status, r.quality_status, r.data_source, r.scenario_id FROM readings r JOIN sensors s ON s.id = r.sensor_id WHERE r.run_id = $1 ORDER BY r.tick, s.code", [run]),
    pool.query("SELECT tick, risk_level, indicators, warmup, receding, quality_status, rule, explanation, recommendation, ruleset, input_reading_ids FROM assessments WHERE run_id = $1 ORDER BY tick", [run]),
    pool.query("SELECT id, tick, level, value, threshold, acknowledged_at, acknowledged_by, data_source FROM alerts WHERE run_id = $1 ORDER BY id", [run]),
    pool.query("SELECT version, tick, change_reason, changes, plan_status FROM plan_versions WHERE run_id = $1 ORDER BY version", [run]),
    pool.query("SELECT event_id, tick, type, source, area_id, entity_id, prev, next, reason FROM events WHERE run_id = $1 ORDER BY seq", [run]),
    pool.query("SELECT recommendation_id, area_id, risk_level, recommended_action, priority, status, active, supersedes_id, reviewed_by, created_tick FROM recommendations WHERE run_id = $1 ORDER BY created_tick, recommendation_id", [run]),
  ]);
  const data = {
    label: LABEL,
    footer: "Decision support only. Not an official warning. Human review required. Simulated data.",
    run: meta,
    readings: readings.rows,
    assessments: assessments.rows,
    alerts: alerts.rows,
    recommendations: recs.rows,
    plan_versions: plans.rows,
    events: events.rows,
    exported_at: new Date().toISOString(),
  };
  if (format === "json")
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="rasd-run-${run}-${meta.scenario_id}.json"` },
    });

  const byTick = new Map<number, Record<string, { value: number; status: string; quality_status: string }>>();
  for (const r of readings.rows) byTick.set(r.tick, { ...byTick.get(r.tick), [r.code]: r });
  const rows = assessments.rows
    .map((a) => {
      const t = byTick.get(a.tick) ?? {};
      const i = a.indicators;
      const flag = (b: boolean) => (b ? "Y" : "N");
      return `<tr><td>T${String(a.tick).padStart(2, "0")}</td><td>${esc(t["WTR-01"]?.value)}</td><td>${esc(t["RAIN-01"]?.value)}</td><td>${i.r10 ?? "n/a"}</td><td>${i.rise_3 ?? "n/a"}</td><td>${flag(i.RF)}</td><td>${flag(i.LR)}</td><td>${flag(i.LH)}</td><td><b>${esc(RISK_LABEL[a.risk_level]?.en ?? "Unavailable")}</b>${a.warmup ? " (warm-up)" : a.receding ? " (receding)" : ""}</td><td>${esc(L0[t["WTR-01"]?.status ?? "unknown"])}</td><td class="x">${esc(a.explanation.en)}</td></tr>`;
    })
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>RASD evidence – run ${run}</title>
<style>
body{font:12px/1.45 system-ui,sans-serif;color:#111;margin:24px;position:relative}
h1{font-size:18px;margin:0}h2{font-size:14px;margin:22px 0 6px;border-bottom:1px solid #ccc}
.banner{background:#7c2d12;color:#fff;font-weight:700;padding:6px 10px;letter-spacing:.04em;margin:10px 0}
.wm{position:fixed;inset:0;display:grid;place-items:center;pointer-events:none;z-index:-1}
.wm span{transform:rotate(-28deg);font-size:64px;font-weight:800;color:rgba(124,45,18,.08);white-space:nowrap}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:3px 5px;text-align:left;vertical-align:top}th{background:#f4f4f4}
.x{font-size:11px;color:#333}.meta td:first-child{width:180px;color:#555}
@media print{.noprint{display:none}}
</style></head><body>
<div class="wm"><span>${LABEL}</span></div>
<h1>RASD – Run evidence report · Run #${run} · ${esc(meta.scenario_id)}</h1>
<div class="banner">${LABEL}</div>
<button class="noprint" onclick="print()">Print / Save as PDF</button>
<h2>Run</h2><table class="meta">
<tr><td>Scenario</td><td>${esc(meta.scenario_id)} (${esc(meta.kind)})</td></tr>
<tr><td>Parameters</td><td>${esc(JSON.stringify(meta.segments))}</td></tr>
<tr><td>Engine / rules</td><td>${esc(meta.engine_version)} · ${esc(JSON.stringify(meta.ruleset))}</td></tr>
<tr><td>L0 limits used</td><td>Warning ≥ ${esc(meta.limits.warning)} cm, Critical ≥ ${esc(meta.limits.danger)} cm — website configuration values, not validated hydrological thresholds</td></tr>
<tr><td>Status</td><td>${esc(meta.status)} · ticks processed ${meta.tick + 1}/${meta.length} · started ${esc(meta.started_at)} by ${esc(meta.started_by)}</td></tr>
<tr><td>Data source</td><td>simulated (all records)</td></tr></table>
<h2>Per-tick L0 / L1</h2><table><tr><th>Tick</th><th>WTR-01 cm</th><th>RAIN-01 mm/min</th><th>R10</th><th>rise_3</th><th>RF</th><th>LR</th><th>LH</th><th>L1 risk</th><th>L0 alert</th><th>Explanation</th></tr>${rows}</table>
<h2>L0 alert records (${alerts.rows.length})</h2><table><tr><th>ID</th><th>Tick</th><th>Level</th><th>Value</th><th>Limit</th><th>Acknowledged</th></tr>${alerts.rows.map((a) => `<tr><td>#${a.id}</td><td>T${a.tick}</td><td>${L0[a.level]}</td><td>${a.value}</td><td>${a.threshold}</td><td>${a.acknowledged_at ? esc(a.acknowledged_by) + " " + esc(a.acknowledged_at) : "—"}</td></tr>`).join("")}</table>
<h2>Response plan versions (${plans.rows.length})</h2><table><tr><th>v</th><th>Tick</th><th>Status</th><th>Reason</th></tr>${plans.rows.map((p) => `<tr><td>${p.version}</td><td>T${p.tick}</td><td>${esc(p.plan_status)}</td><td>${esc(p.change_reason.en)}</td></tr>`).join("")}</table>
<h2>Recommendations (${recs.rows.length})</h2><table><tr><th>ID</th><th>Area</th><th>Risk</th><th>Action</th><th>Priority</th><th>Status</th><th>Active</th><th>Supersedes</th></tr>${recs.rows.map((r) => `<tr><td>${r.recommendation_id}</td><td>${r.area_id}</td><td>${esc(RISK_LABEL[r.risk_level]?.en)}</td><td>${r.recommended_action}</td><td>#${r.priority}</td><td>${r.status}${r.reviewed_by ? " (" + esc(r.reviewed_by) + ")" : ""}</td><td>${r.active ? "yes" : "superseded"}</td><td>${r.supersedes_id ?? "—"}</td></tr>`).join("")}</table>
<p class="x">Every recommendation: Decision support only. Not an official warning. Human review required. Simulated data.</p>
<h2>Event log (${events.rows.length})</h2><table><tr><th>ID</th><th>Tick</th><th>Type</th><th>Source</th><th>Area/entity</th><th>Prev → New</th><th>Reason</th></tr>${events.rows.map((e) => `<tr><td>${e.event_id}</td><td>${e.tick ?? ""}</td><td>${e.type}</td><td>${e.source}</td><td>${esc(e.area_id ?? e.entity_id ?? "")}</td><td class="x">${esc(JSON.stringify(e.prev))} → ${esc(JSON.stringify(e.next))}</td><td class="x">${esc(e.reason?.en ?? "")}</td></tr>`).join("")}</table>
<p class="x">${LABEL}. Results prove behaviour on this simulated scenario only, not real-world performance. Virtual areas and roads are not real geography.</p>
</body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});
