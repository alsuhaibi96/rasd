"use client";
import clsx from "clsx";
import { Ban, Check, ClipboardList, Eye, FileDown, FileSearch, ListOrdered, Pause, Play, RotateCcw, Route, ScrollText, Sparkles, Square, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useEvidence } from "@/components/evidence/store";
import {
  ADIREA_AREAS,
  CATALOG,
  type EngineState,
  EXPOSURE_LABEL,
  PHASE_LABEL,
  F03,
  RECOMMENDATION_FOOTER,
  RESTRICTED,
  ROAD_EDGES,
  type WhatIfResult,
} from "@/engine";
import { post } from "@/lib/client-api";
import { useL, useTr } from "@/lib/i18n";
import type { RunView } from "@/lib/scenario-types";
import { useRasd } from "@/lib/store";
import { Button, Card, Pill, RiskChip, type RiskKey, RISK_COLOR, SectionTitle, StatusBadge } from "../ui";

const T = (t: number) => `T${String(Math.max(0, t)).padStart(2, "0")}`;
const areaName = (id: string) => ADIREA_AREAS.find((a) => a.id === id)?.name ?? { ar: id, en: id };

/* ---------------- Controls + scrubber ---------------- */
export function RunControls({ run, reviewTick, setReviewTick }: { run: RunView; reviewTick: number | null; setReviewTick: (t: number | null) => void }) {
  const tr = useTr();
  const L = useL();
  const [p, setP] = useState(run.segments.at(-1)?.params ?? { intensity: 1, rate: 1, seed: 0 });
  const ctl = (action: string, extra: Record<string, unknown> = {}) => post(`/api/scenario/${run.run_id}/control`, { action, ...extra });
  const phase = run.kind === "scripted" ? F03.phases[run.tick] : null;
  const pct = ((run.tick + 1) / run.length) * 100;
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="me-2">
          <div className="text-[11px] text-muted">{tr("الزمن المحاكى", "Simulated time")}</div>
          <div className="num text-3xl font-bold" dir="ltr">{T(run.tick)}<span className="text-base text-dim">/{T(run.length - 1)}</span></div>
        </div>
        <div className="min-w-40">
          <div className="text-[11px] text-muted">{run.scenario_id} · {run.kind === "scripted" ? tr("مُعدّ مسبقًا", "scripted") : tr("بارامتري", "parametric")}</div>
          <div className="text-sm font-semibold">{phase ? `${phase} · ${L(PHASE_LABEL[phase])}` : run.kind === "parametric" ? `I ${p.intensity} · R ${p.rate} · S ${p.seed}` : "—"}</div>
          <div className="mt-0.5 text-[11px] text-dim">{tr("الحالة", "Status")}: {run.status} · {run.speed}×</div>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {run.status === "running" && <Button onClick={() => ctl("pause")}><Pause className="size-4" /> {tr("إيقاف مؤقت", "Pause")}</Button>}
          {run.status === "paused" && <Button variant="primary" onClick={() => ctl("resume")}><Play className="size-4 rtl:-scale-x-100" /> {tr("استئناف", "Resume")}</Button>}
          <Button onClick={() => ctl("restart")}><RotateCcw className="size-4" /> {tr("إعادة التشغيل", "Restart")}</Button>
          <select value={run.speed} onChange={(e) => ctl("speed", { speed: Number(e.target.value) })} className="rounded-xl border border-line-2 bg-surface-2 px-2 py-2 text-sm" disabled={run.status === "completed"} aria-label={tr("السرعة", "Speed")}>
            {[0.5, 1, 2, 4, 8].map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
          <a href={`/api/scenario/${run.run_id}/export?format=html`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-line-2 px-3 py-2 text-sm text-muted hover:text-fg"><FileDown className="size-4" /> {tr("تقرير", "Report")}</a>
          <Button variant="ghost" onClick={() => ctl("stop")} title={tr("إنهاء جلسة المحاكاة واستئناف المولّد", "End the simulation session and resume the generator")}><Square className="size-4" /> {tr("إنهاء الجلسة", "End session")}</Button>
        </div>
      </div>

      <div className="mt-4">
        <div className="relative h-2 rounded-full bg-surface-3" dir="ltr">
          <div className="absolute inset-y-0 start-0 rounded-full bg-brand/70" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 font-semibold"><Eye className="size-4 text-muted" /> {tr("مراجعة دقيقة سابقة", "Review a past tick")}</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, run.tick)}
            value={reviewTick ?? run.tick}
            onChange={(e) => setReviewTick(Number(e.target.value) >= run.tick ? null : Number(e.target.value))}
            className="min-w-48 flex-1 accent-[#34d399]"
            dir="ltr"
          />
          {reviewTick != null ? (
            <span className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-2 py-1 text-warn">
              {tr("وضع المراجعة", "Review mode")} {T(reviewTick)} — {tr("أُعيد حسابه حتميًا من مدخلات السيناريو (دون إجراءات المشغّل)", "recomputed deterministically from scenario inputs (operator actions excluded)")}
              <button onClick={() => setReviewTick(null)} className="underline">{tr("العودة للحالي", "Back to live")}</button>
            </span>
          ) : (
            <span className="text-dim">{tr("اسحب للعودة إلى أي دقيقة — المحرك حتمي", "Drag to revisit any tick — the engine is deterministic")}</span>
          )}
        </div>
      </div>

      {run.kind === "parametric" && run.status !== "completed" && (
        <div className="mt-4 grid items-end gap-3 border-t border-line pt-4 sm:grid-cols-4">
          {(["intensity", "rate", "seed"] as const).map((k) => (
            <label key={k} className="text-xs">
              <div className="flex justify-between"><span className="font-semibold">{{ intensity: tr("الشدة", "Intensity"), rate: tr("معدل التطور", "Rate"), seed: tr("البذرة", "Seed") }[k]}</span><span className="num text-brand">{p[k]}</span></div>
              <input type="range" min={k === "seed" ? 0 : 0.5} max={k === "seed" ? 99 : 2} step={k === "seed" ? 1 : 0.1} value={p[k]} onChange={(e) => setP({ ...p, [k]: Number(e.target.value) })} className="w-full accent-[#34d399]" />
            </label>
          ))}
          <Button onClick={() => ctl("params", { params: p })}>{tr("تطبيق من الدقيقة التالية", "Apply from next tick")}</Button>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Area ranking ---------------- */
export function AreaRanking({ state, selected, onSelect }: { state: EngineState; selected: string | null; onSelect: (id: string) => void }) {
  const tr = useTr();
  const L = useL();
  const open = useEvidence((s) => s.open);
  const areaBy = new Map(state.areas.map((a) => [a.area_id, a]));
  const unaffected = ADIREA_AREAS.filter((a) => a.lag_ticks == null);
  return (
    <Card className="flex h-full flex-col p-5">
      <SectionTitle icon={ListOrdered} title={tr("ترتيب أولوية المناطق", "Area priority ranking")} sub={tr("RANK-v0.1: الخطر ↓ ثم فئة التعرض ↓ ثم زمن الوصول ↑ — التساوي يُعرض كتعادل", "RANK-v0.1: risk ↓, then exposure ↓, then impact lag ↑ — equality shown as a tie")} />
      <div className="mt-4 flex-1 space-y-1.5 overflow-y-auto">
        {state.ranking.map((r) => {
          const a = areaBy.get(r.area_id)!;
          return (
            <button key={r.area_id} onClick={() => onSelect(r.area_id)} className={clsx("flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-start transition", selected === r.area_id ? "border-brand/60 bg-brand/5" : "border-line bg-surface-2 hover:border-dim")}>
              <span className="num mt-0.5 grid min-w-8 place-items-center rounded-lg bg-surface-3 py-1 text-sm font-bold">{r.rank}{r.tie ? "=" : ""}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {L(areaName(r.area_id))} <span className="num text-[10px] text-dim">{r.area_id}</span>
                  {a.affected && <Pill className="border-fg/30 text-fg">{tr("متأثرة", "affected")}</Pill>}
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted">{L(r.reason)}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <RiskChip risk={r.risk as RiskKey} />
                <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); open({ kind: "area", id: r.area_id }); }} className="text-[10px] text-brand hover:underline">{tr("لماذا؟", "why?")}</span>
              </span>
            </button>
          );
        })}
        {unaffected.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-xl border border-dashed border-line px-3 py-2 text-xs text-dim">
            <span>{L(a.name)} · {a.id}</span>
            <RiskChip risk="unaffected" />
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-dim">{tr("مناطق افتراضية لأغراض المحاكاة — ليست مناطق متأثرة فعليًا.", "Virtual areas for simulation — not actually affected areas.")}</p>
    </Card>
  );
}

/* ---------------- Area details (selected) ---------------- */
export function AreaDetail({ state, id, onClose }: { state: EngineState; id: string; onClose: () => void }) {
  const tr = useTr();
  const L = useL();
  const open = useEvidence((s) => s.open);
  const def = ADIREA_AREAS.find((a) => a.id === id)!;
  const ar = state.areas.find((a) => a.area_id === id);
  const rank = state.ranking.find((r) => r.area_id === id);
  return (
    <div className="absolute bottom-3 start-3 z-10 w-80 max-w-[calc(100%-1.5rem)] rounded-xl border border-line-2 bg-[#0a1519]/95 p-4 text-xs shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold">{L(def.name)}</div>
          <div className="num text-[10px] text-dim">{def.id} · {tr("افتراضية", "VIRTUAL")} · {L(EXPOSURE_LABEL[def.exposure])}</div>
        </div>
        <button onClick={onClose} className="text-muted"><X className="size-4" /></button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <RiskChip risk={(ar?.risk ?? null) as RiskKey} /> {rank && <span className="num text-muted">#{rank.rank}{rank.tie ? " (tie)" : ""}</span>}
        {ar?.affected && <Pill>{tr("متأثرة", "affected")}</Pill>}
      </div>
      <p className="mt-2 leading-5 text-muted">{L(ar?.reason)}</p>
      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-dim">
        <span>{tr("زمن الوصول", "Impact lag")}: <span className="num text-fg">{def.lag_ticks ?? "—"}</span> {tr("د", "min")}</span>
        <span>{tr("فرق الارتفاع", "Elevation offset")}: <span className="num text-fg">{def.elevation_offset_cm}</span> cm</span>
        <span>{tr("آخر تقييم", "Last assessed")}: <span className="num text-fg">{T(state.tick)}</span></span>
        <span>{tr("الجودة", "Quality")}: <span className="text-fg">{ar?.quality}</span></span>
      </div>
      <div className="mt-1 text-[10px] text-dim">{def.geographic_source}</div>
      <button onClick={() => open({ kind: "area", id })} className="mt-3 flex items-center gap-1.5 text-brand hover:underline"><FileSearch className="size-3.5" /> {tr("سلسلة الأدلة", "Evidence chain")}</button>
    </div>
  );
}

/* ---------------- Recommendations ---------------- */
export function Recommendations({ state, run, live }: { state: EngineState; run: RunView; live: boolean }) {
  const tr = useTr();
  const L = useL();
  const open = useEvidence((s) => s.open);
  const [showHistory, setShowHistory] = useState(false);
  const rank = new Map(state.ranking.map((r) => [r.area_id, r.rank]));
  const active = state.recs.filter((r) => r.active).sort((a, b) => (rank.get(a.area_id) ?? 99) - (rank.get(b.area_id) ?? 99));
  const history = state.recs.filter((r) => !r.active).slice(-30).reverse();
  const review = (id: string, status: string) => post("/api/recommendations/review", { run: run.run_id, recommendation_id: id, status, plan_version: run.plan_head?.version });
  const STATUS = { proposed: tr("مقترحة", "Proposed"), under_review: tr("قيد المراجعة", "Under review"), approved: tr("معتمدة", "Approved"), rejected: tr("مرفوضة", "Rejected") };
  return (
    <Card className="flex h-full flex-col p-5">
      <SectionTitle
        icon={Sparkles}
        title={tr("التوصيات حسب المنطقة", "Area recommendations")}
        sub={tr("دعم قرار فقط — لا تتحول أي توصية إلى أمر تنفيذ ميداني دون اعتماد بشري", "Decision support only — no recommendation becomes a field order without human approval")}
        action={<button onClick={() => setShowHistory(!showHistory)} className="text-xs text-brand hover:underline">{showHistory ? tr("الحالية", "Current") : tr(`السجل (${state.recs.length - active.length})`, `History (${state.recs.length - active.length})`)}</button>}
      />
      <div className="mt-4 max-h-[420px] flex-1 space-y-2 overflow-y-auto">
        {(showHistory ? history : active).map((r) => {
          const prev = r.supersedes_id ? state.recs.find((x) => x.recommendation_id === r.supersedes_id) : null;
          return (
            <div key={r.recommendation_id} className={clsx("rounded-xl border p-3 text-xs", r.active ? "border-line bg-surface-2" : "border-dashed border-line opacity-80")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="num rounded bg-surface-3 px-1.5 text-[11px] font-bold">#{r.priority}</span>
                <span className="text-sm font-semibold">{L(CATALOG[r.recommended_action])}</span>
                <span className="text-muted">· {L(areaName(r.area_id))}</span>
                <RiskChip risk={r.risk_level as RiskKey} />
                <span className="ms-auto num text-[10px] text-dim">{r.recommendation_id} · {T(r.created_at_tick)}</span>
              </div>
              <p className="mt-1.5 text-fg">{L(r.supporting_data.text as { ar: string; en: string })}</p>
              <p className="mt-1 text-muted">{L(r.reason)}</p>
              {prev && r.active && (
                <p className="mt-1 text-[11px] text-dim">
                  {tr("السابقة", "Previous")}: {L(CATALOG[prev.recommended_action])} ({prev.recommendation_id}, <RiskChip risk={prev.risk_level as RiskKey} className="!py-0" />) → {tr("تغيّرت عند", "changed at")} {T(r.created_at_tick)}
                </p>
              )}
              {!r.active && <p className="mt-1 text-[11px] text-dim">{tr("استُبدلت بـ", "Superseded by")} {r.superseded_by ?? "—"} · {tr("محفوظة في السجل", "kept in history")}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={clsx("rounded px-1.5 py-px text-[10px] font-semibold", r.status === "approved" ? "bg-ok/15 text-ok" : r.status === "rejected" ? "bg-danger/15 text-danger" : r.status === "under_review" ? "bg-warn/15 text-warn" : "bg-surface-3 text-muted")}>
                  {STATUS[r.status]}{r.reviewed_by ? ` · ${r.reviewed_by}` : ""}
                </span>
                {r.requires_review && <span className="text-[10px] text-warn">{tr("تتطلب مراجعة بشرية", "Requires human review")}</span>}
                {r.active && live && r.requires_review && (
                  <span className="ms-auto flex gap-1">
                    {r.status !== "under_review" && r.status !== "approved" && <button onClick={() => review(r.recommendation_id, "under_review")} className="rounded border border-line-2 px-2 py-0.5 hover:bg-surface-3">{tr("مراجعة", "Review")}</button>}
                    {r.status !== "approved" && <button onClick={() => review(r.recommendation_id, "approved")} className="flex items-center gap-1 rounded border border-ok/40 px-2 py-0.5 text-ok hover:bg-ok/10"><Check className="size-3" /> {tr("اعتماد", "Approve")}</button>}
                    {r.status !== "rejected" && <button onClick={() => review(r.recommendation_id, "rejected")} className="flex items-center gap-1 rounded border border-danger/40 px-2 py-0.5 text-danger hover:bg-danger/10"><X className="size-3" /> {tr("رفض", "Reject")}</button>}
                  </span>
                )}
                <button onClick={() => open({ kind: "rec", id: r.recommendation_id })} className="text-[10px] text-brand hover:underline">{tr("الأدلة", "evidence")}</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded-lg border border-line bg-surface-2 p-2 text-[10px] leading-4 text-dim">
        {L(RECOMMENDATION_FOOTER)}
        <div className="mt-1">{tr("إجراءات مقيدة لا يولّدها النظام وتتطلب اعتماد خبير:", "Restricted actions the system never generates (expert approval required):")} {RESTRICTED.map((x) => L(x)).join(" · ")}</div>
      </div>
    </Card>
  );
}

/* ---------------- Plan head ---------------- */
export function PlanHead({ run, state, review }: { run: RunView; state: EngineState; review: boolean }) {
  const tr = useTr();
  const L = useL();
  const head = review ? state.plan.at(-1) : run.plan_head;
  if (!head) return <Card className="p-5 text-sm text-muted">{tr("لا توجد خطة بعد.", "No plan yet.")}</Card>;
  const KIND = { added: ["+", "text-ok"], withdrawn: ["−", "text-danger"], priority: ["⇅", "text-warn"], risk: ["◆", "text-[#fdba74]"], route: ["↝", "text-sky-300"] } as const;
  return (
    <Card className="flex h-full flex-col p-5">
      <SectionTitle
        icon={ClipboardList}
        title={`${tr("خطة الاستجابة", "Response plan")} · ${head.plan_id} v${head.version}`}
        sub={`${T(head.tick)} · ${L(head.change_reason)}`}
        action={<Link href="/plans" className="text-xs text-brand hover:underline">{tr(`كل الإصدارات (${review ? state.plan.length : run.plan_count})`, `All versions (${review ? state.plan.length : run.plan_count})`)}</Link>}
      />
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <Pill>{tr("الحالة", "Status")}: {head.plan_status}</Pill>
        <Pill>{tr("مقترح ≠ معتمد", "Proposed ≠ approved")}</Pill>
        <Pill className="border-[#c2410c]/50 text-[#fdba74]">SIMULATED</Pill>
      </div>
      <div className="mt-3 grid flex-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5 text-xs">
          {head.areas.filter((a) => a.actions.length).map((a) => (
            <div key={a.area_id} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1.5">
              <span className="num font-bold">#{a.priority}{a.tie ? "=" : ""}</span>
              <span className="font-semibold">{L(areaName(a.area_id))}</span>
              <RiskChip risk={a.risk as RiskKey} />
              <span className="ms-auto flex flex-wrap gap-1">
                {a.actions.map((x) => (
                  <span key={x.key} className={clsx("rounded px-1.5 text-[10px]", x.status === "approved" ? "bg-ok/15 text-ok" : x.status === "rejected" ? "bg-danger/15 text-danger line-through" : "bg-surface-3 text-muted")}>
                    {L(CATALOG[x.action])}{x.status === "approved" ? " ✓" : ""}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="text-xs">
          <div className="mb-1.5 font-semibold text-muted">{tr("ما الذي تغيّر في هذا الإصدار", "What changed in this version")}</div>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {head.changes.length === 0 && <li className="text-dim">{tr("الإصدار الأولي", "Initial version")}</li>}
            {head.changes.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className={clsx("w-3 shrink-0 font-bold", KIND[c.kind][1])}>{KIND[c.kind][0]}</span>
                <span className="text-muted">{c.area_id && <b className="text-fg">{L(areaName(c.area_id))}: </b>}{L(c.reason)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-dim">{tr("تغيّر مستوى الخطر لا يُطلق أي تنفيذ ميداني تلقائيًا.", "A change in risk level never triggers field execution automatically.")}</p>
    </Card>
  );
}

/* ---------------- Routes ---------------- */
export function RoutesPanel({ run, state, live }: { run: RunView; state: EngineState; live: boolean }) {
  const tr = useTr();
  const L = useL();
  const route = state.route;
  const atRisk = new Set(ROAD_EDGES.filter((e) => { const a = state.areas.find((x) => x.area_id === e.area_id); return a && (a.risk === "elevated" || a.risk === "severe"); }).map((e) => e.id));
  const toggle = (edge: string) => post("/api/routes", { run: run.run_id, edge, closed: !state.closures.includes(edge) });
  return (
    <Card className="flex h-full flex-col p-5">
      <SectionTitle icon={Route} title={tr("المسارات الافتراضية", "Virtual routes")} sub={tr("للتوضيح داخل المحاكاة فقط — ليست تعليمات ملاحة ولا توصف بأنها آمنة", "Simulation-only illustration — not navigation instructions and never described as safe")} />
      <label className="mt-4 flex items-center gap-2 text-xs">
        <span className="text-muted">{tr("الوجهة", "Target")}</span>
        <select disabled={!live} value={state.routeTarget ?? ""} onChange={(e) => post("/api/routes", { run: run.run_id, target: e.target.value || null })} className="flex-1 rounded-lg border border-line-2 bg-surface-2 px-2 py-1">
          <option value="">{tr("تلقائي: أعلى منطقة متأثرة أولوية", "Auto: top-priority affected area")}</option>
          {ADIREA_AREAS.map((a) => <option key={a.id} value={a.id}>{L(a.name)}</option>)}
        </select>
      </label>
      {route ? (
        <div className={clsx("mt-3 rounded-xl border p-3 text-xs", route.status === "ok" ? "border-brand/40 bg-brand/5" : "border-danger/40 bg-danger/5")}>
          <div className="font-semibold">{route.status === "ok" ? tr("مسار محاكى", "Simulated route") : tr("لا يوجد مسار", "No route")} → {L(areaName(route.target_area_id))}</div>
          <div className="mt-1 text-muted">{L(route.explanation)}</div>
          {route.edges.length > 0 && <div className="num mt-1 text-[11px] text-dim" dir="ltr">OPS → {route.edges.join(" → ")}</div>}
          {route.excluded.map((x) => <div key={x.edge_id} className="mt-1 text-[11px] text-danger">✕ {L(x.reason)}</div>)}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted">{tr("لا توجد منطقة متأثرة تتطلب مسارًا.", "No affected area requires a route.")}</p>
      )}
      <div className="mt-3 text-[11px] font-semibold text-muted">{tr("المقاطع (اضغط للإغلاق/الفتح الافتراضي — أو على الخريطة)", "Segments (click to virtually close/open — or on the map)")}</div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {ROAD_EDGES.map((e) => {
          const closed = state.closures.includes(e.id);
          const onRoute = route?.edges.includes(e.id);
          return (
            <button key={e.id} disabled={!live} onClick={() => toggle(e.id)} title={L(e.name)} className={clsx("num rounded border px-1.5 py-0.5 text-[10px]", closed ? "border-danger/50 bg-danger/15 text-danger line-through" : onRoute ? "border-brand/50 bg-brand/10 text-brand" : atRisk.has(e.id) ? "border-[#b45309]/60 text-[#fdba74]" : "border-line-2 text-muted", !live && "opacity-60")}>
              {closed && <Ban className="me-0.5 inline size-2.5" />}{e.id}
            </button>
          );
        })}
      </div>
      <p className="mt-auto pt-3 text-[10px] text-dim">{tr("برتقالي = مقطع يمر بمنطقة مرتفعة/شديدة الخطر (تنبيه فقط، لا يُغلق تلقائيًا). الإغلاق قرار المشغّل.", "Orange = segment through an Elevated/Severe area (flag only, never auto-closed). Closing is the operator's decision.")}</p>
    </Card>
  );
}

/* ---------------- What-if ---------------- */
export function WhatIfPanel({ result, setResult, offset, setOffset, enabled }: { result: WhatIfResult | null; setResult: (r: WhatIfResult | null) => void; offset: number; setOffset: (n: number) => void; enabled: boolean }) {
  const tr = useTr();
  const L = useL();
  const [horizon, setHorizon] = useState<15 | 30>(15);
  const [rain, setRain] = useState<"persist" | "taper" | "stop">("persist");
  const [damping, setDamping] = useState(0.85);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const r = await post<WhatIfResult>("/api/whatif", { horizon, rain, damping });
    setBusy(false);
    if (r) {
      setResult(r);
      setOffset(r.horizon);
    }
  };
  const tick = result?.ticks[offset - 1];
  return (
    <Card className="flex h-full flex-col border-dashed p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold"><Sparkles className="size-5 text-muted" /> <span dir="ltr">What-if Projection – Simulation</span></h2>
      </div>
      <p className="mt-1 text-xs text-muted">{tr("إسقاط افتراضي — ليس توقعًا فعليًا. لا يغيّر L0 ولا L1 ولا يُصدر تنبيهات. للفيضانات فقط.", "Hypothetical projection — not an actual forecast. Does not change L0 or L1 and creates no alerts. Flood only.")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <label>{tr("المدة", "Horizon")}
          <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value) as 15 | 30)} className="mt-1 w-full rounded-lg border border-line-2 bg-surface-2 px-2 py-1"><option value={15}>15 {tr("دقيقة", "min")}</option><option value={30}>30 {tr("دقيقة", "min")}</option></select>
        </label>
        <label>{tr("افتراض الأمطار", "Rain assumption")}
          <select value={rain} onChange={(e) => setRain(e.target.value as "persist")} className="mt-1 w-full rounded-lg border border-line-2 bg-surface-2 px-2 py-1">
            <option value="persist">{tr("تستمر بنفس المعدل", "Persists at current rate")}</option>
            <option value="taper">{tr("تتناقص 0.1 مم/د", "Tapers 0.1 mm/min")}</option>
            <option value="stop">{tr("تتوقف", "Stops")}</option>
          </select>
        </label>
        <label className="col-span-2">{tr("التخميد", "Damping")} <span className="num text-brand">{damping}</span>
          <input type="range" min={0} max={1} step={0.05} value={damping} onChange={(e) => setDamping(Number(e.target.value))} className="w-full accent-[#34d399]" />
        </label>
      </div>
      <Button className="mt-2" disabled={!enabled || busy} onClick={run}>{tr("تشغيل الإسقاط", "Run projection")}</Button>
      {result && tick && (
        <div className="mt-4 space-y-2 text-xs">
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>{tr("بداية الإسقاط", "Start")} {T(result.start_tick)} · {result.horizon} {tr("د", "min")} · {result.ruleset}</span>
            <button onClick={() => setResult(null)} className="text-brand hover:underline">{tr("إخفاء", "Clear")}</button>
          </div>
          <input type="range" min={1} max={result.horizon} value={offset} onChange={(e) => setOffset(Number(e.target.value))} className="w-full accent-[#fb923c]" dir="ltr" />
          <div className="rounded-lg border border-dashed border-line-2 p-2">
            <div className="font-semibold">+{offset} {tr("د", "min")} ({T(tick.tick)}) · {tr("افتراضي", "hypothetical")}</div>
            <div className="num mt-1 text-muted">WTR-01 ≈ {tick.level} cm · RAIN ≈ {tick.rain} mm/min · L1 <span style={{ color: tick.l1 ? RISK_COLOR[tick.l1] : undefined }}>{tick.l1}</span> · L0* {tick.l0_hypothetical}</div>
          </div>
          <div className="flex gap-px" dir="ltr">{result.ticks.map((x) => <span key={x.tick} className={clsx("h-2.5 flex-1", x.offset === offset && "ring-1 ring-fg")} style={{ background: x.l1 ? RISK_COLOR[x.l1] : "#333", opacity: 0.85 }} />)}</div>
          <ul className="space-y-1">
            {result.areas.filter((a) => a.peak !== "unaffected").map((a) => (
              <li key={a.area_id} className="flex flex-wrap items-center gap-1.5">
                <span className="w-28 truncate">{L(areaName(a.area_id))}</span>
                <RiskChip risk={a.current as RiskKey} /> → <RiskChip risk={tick.areas[a.area_id] as RiskKey} className="border border-dashed" />
                <span className="text-[10px] text-dim">{tr("الذروة", "peak")} <RiskChip risk={a.peak as RiskKey} className="!py-0" /></span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] leading-4 text-dim">{L(result.disclaimer)} {tr("الافتراضات", "Assumptions")}: RESPONSE {result.assumptions.RESPONSE} cm/(mm/min), STEADY_RAIN {result.assumptions.STEADY_RAIN} mm/min. *L0 {tr("افتراضي للعرض فقط", "hypothetical, display only")}.</p>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Event feed ---------------- */
const TYPE_TONE: Record<string, string> = {
  alert_created: "text-danger",
  alert_status_changed: "text-warn",
  risk_changed: "text-[#fdba74]",
  area_risk_changed: "text-[#fdba74]",
  plan_version_created: "text-sky-300",
  recommendation_created: "text-brand",
  road_status_changed: "text-danger",
  route_generated: "text-brand",
  system_error: "text-danger",
};
export function EventFeed({ runId }: { runId: number }) {
  const tr = useTr();
  const L = useL();
  const events = useRasd((s) => s.events);
  const [hideReadings, setHideReadings] = useState(true);
  const list = useMemo(() => events.filter((e) => !hideReadings || e.type !== "reading_received").slice(-120).reverse(), [events, hideReadings]);
  return (
    <Card className="flex h-full flex-col p-5">
      <SectionTitle
        icon={ScrollText}
        title={tr("سجل الأحداث المباشر", "Live event log")}
        sub={tr("سجل دائم لا يُحذف — منفصل عن الحالة الحالية", "Append-only, never deleted — separate from current state")}
        action={<Link href={`/events?run=${runId}`} className="text-xs text-brand hover:underline">{tr("الكل", "All")}</Link>}
      />
      <label className="mt-3 flex items-center gap-2 text-[11px] text-muted">
        <input type="checkbox" checked={hideReadings} onChange={(e) => setHideReadings(e.target.checked)} className="accent-[#34d399]" /> {tr("إخفاء أحداث استلام القراءات", "Hide reading-received events")}
      </label>
      <ol className="mt-2 max-h-[420px] flex-1 space-y-1 overflow-y-auto text-[11px]">
        {list.map((e) => (
          <li key={e.id} className="rounded-md border border-line/70 px-2 py-1">
            <div className="flex items-center gap-2">
              <span className="num text-dim">{e.event_id}</span>
              <span className="num text-muted">{T(e.tick)}</span>
              <span className={clsx("font-semibold", TYPE_TONE[e.type] ?? "text-fg")}>{e.type}</span>
              {e.area_id && <span className="text-dim">{e.area_id}</span>}
              <span className="ms-auto text-[9px] text-dim">{e.source}</span>
            </div>
            {(e.prev != null || e.next != null) && typeof e.next !== "object" && <div className="num text-dim">{String(e.prev ?? "—")} → {String(e.next ?? "—")}</div>}
            {e.reason && <div className="text-muted">{L(e.reason)}</div>}
          </li>
        ))}
        {list.length === 0 && <li className="text-muted">{tr("لا توجد أحداث بعد.", "No events yet.")}</li>}
      </ol>
    </Card>
  );
}

export function L0Mini({ state }: { state: EngineState }) {
  const tr = useTr();
  return (
    <span className="flex items-center gap-2 text-xs text-muted">
      {tr("حالة التنبيه L0", "Alert status L0")} <StatusBadge status={state.l0} />
    </span>
  );
}
