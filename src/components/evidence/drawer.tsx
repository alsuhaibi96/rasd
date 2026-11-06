"use client";
import clsx from "clsx";
import { ArrowDown, FileSearch, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ADIREA_AREAS, CATALOG, EXPOSURE_LABEL, L1_PARAMS } from "@/engine";
import { useL, useTr } from "@/lib/i18n";
import type { RunView } from "@/lib/scenario-types";
import { useRasd } from "@/lib/store";
import { Pill, RiskChip, type RiskKey } from "../ui";
import { type EvidenceTarget, useEvidence } from "./store";

const T = (t: number) => `T${String(t).padStart(2, "0")}`;

function Node({ title, tag, children, last }: { title: string; tag?: string; children: ReactNode; last?: boolean }) {
  return (
    <li className="relative">
      <div className="rounded-xl border border-line bg-surface-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold">{title}</span>
          {tag && <span className="num rounded bg-surface-3 px-1.5 py-px text-[10px] text-muted">{tag}</span>}
        </div>
        <div className="mt-2 space-y-1 text-xs leading-5 text-muted">{children}</div>
      </div>
      {!last && (
        <div className="flex justify-center py-1 text-dim">
          <ArrowDown className="size-4" />
        </div>
      )}
    </li>
  );
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{k}</span>
      <span className="num text-end text-fg">{v}</span>
    </div>
  );
}

function ReadingInputs({ run, srcTick, label }: { run: RunView; srcTick: number; label?: string }) {
  const tr = useTr();
  const s = run.state;
  const rains: string[] = [];
  let sum = 0;
  for (let i = Math.max(0, run.state.tick - L1_PARAMS.rainWindow + 1); i <= run.state.tick; i++) {
    const v = s.rains[i];
    if (v != null) sum += v;
    rains.push(v == null ? "—" : String(v));
  }
  return (
    <Node title={tr("القراءات المُدخلة", "Input readings")} tag="simulated">
      {label && <div className="text-[11px] text-dim">{label}</div>}
      <KV k={`WTR-01 @ ${T(srcTick)}`} v={s.levels[srcTick] == null ? tr("مفقودة/غير صالحة", "missing/invalid") : `${s.levels[srcTick]} cm`} />
      <KV k={`WTR-01 @ ${srcTick >= 3 ? T(srcTick - 3) : "—"}`} v={srcTick >= 3 && s.levels[srcTick - 3] != null ? `${s.levels[srcTick - 3]} cm` : tr("غير متاح (إحماء)", "n/a (warm-up)")} />
      <KV k={`RAIN-01 ${T(Math.max(0, run.state.tick - 9))}…${T(run.state.tick)}`} v={`Σ ${Math.round(sum * 10) / 10} mm`} />
      <div className="num truncate text-[10px] text-dim" dir="ltr">[{rains.join(", ")}]</div>
      <KV k={tr("جودة البيانات", "Quality status")} v={s.quality[srcTick] ?? "—"} />
      <KV k="scenario_id · data_source" v={`${run.scenario_id} · simulated`} />
    </Node>
  );
}

function Versions({ run }: { run: RunView }) {
  const tr = useTr();
  return (
    <Node title={tr("الإصدارات والتتبع", "Versions & provenance")} last>
      <KV k={tr("المحرك", "Engine")} v={run.engine_version} />
      {Object.entries(run.ruleset).map(([k, v]) => (
        <KV key={k} k={k} v={v} />
      ))}
      <KV k={tr("الزمن المحاكى", "Simulated time")} v={`${T(run.state.tick)} = T00 + ${run.state.tick} min`} />
      <KV k={tr("آخر معالجة (فعلي)", "Last processed (wall)")} v={run.last_tick_at ? new Date(run.last_tick_at).toLocaleTimeString("en-GB") : "—"} />
    </Node>
  );
}

function Lineage({ target, run }: { target: EvidenceTarget; run: RunView }) {
  const tr = useTr();
  const L = useL();
  const s = run.state;
  const t = s.tick;

  if (target.kind === "l1") {
    const l1 = s.l1;
    if (!l1) return <p className="text-sm text-muted">{tr("لا يوجد تقييم بعد.", "No assessment yet.")}</p>;
    const i = l1.indicators;
    return (
      <ol>
        <ReadingInputs run={run} srcTick={t} />
        <Node title={tr("المؤشرات (L1)", "Indicators (L1)")} tag={run.ruleset.l1}>
          <KV k="rise_3" v={i.rise_3 == null ? "n/a (warm-up)" : `${i.rise_3} cm`} />
          <KV k="R10" v={i.r10 == null ? "n/a" : `${i.r10} mm`} />
          <KV k={`RF (R10 ≥ ${L1_PARAMS.rfMinR10})`} v={i.RF ? "Y" : "N"} />
          <KV k={`LR (rise_3 ≥ ${L1_PARAMS.lrMinRise})`} v={i.LR ? "Y" : "N"} />
          <KV k={`LH (level > ${L1_PARAMS.baselineMax})`} v={i.LH ? "Y" : "N"} />
        </Node>
        <Node title={tr("القاعدة المطبّقة", "Rule fired")} tag={l1.rule}>
          <RiskChip risk={l1.risk_level} />
          <p className="mt-1 text-fg">{L(l1.explanation)}</p>
          <KV k={tr("ثقة النموذج", "Model confidence")} v={tr("غير منطبق – قائم على القواعد", "Not applicable – rule-based")} />
        </Node>
        <Node title={tr("التوصية (دعم قرار)", "Recommendation (decision support)")}>
          <p className="text-fg">{L(l1.recommendation)}</p>
        </Node>
        <Versions run={run} />
      </ol>
    );
  }

  const areaId = target.kind === "area" ? target.id : target.kind === "rec" ? s.recs.find((r) => r.recommendation_id === target.id)?.area_id : undefined;
  const def = ADIREA_AREAS.find((a) => a.id === areaId);
  if ((target.kind === "area" || target.kind === "rec") && def) {
    const ar = s.areas.find((a) => a.area_id === def.id);
    const rank = s.ranking.find((r) => r.area_id === def.id);
    const recs = target.kind === "rec" ? s.recs.filter((r) => r.recommendation_id === target.id) : s.recs.filter((r) => r.area_id === def.id && r.active);
    const prevRecs = target.kind === "rec" ? s.recs.filter((r) => r.recommendation_id === recs[0]?.supersedes_id) : [];
    const head = run.plan_head;
    return (
      <ol>
        {def.lag_ticks != null && t - def.lag_ticks >= 0 ? (
          <ReadingInputs run={run} srcTick={t - def.lag_ticks} label={tr(`زمن الوصول ${def.lag_ticks} د، فرق الارتفاع ${def.elevation_offset_cm} سم (AREA-v0.1)`, `Impact lag ${def.lag_ticks} min, elevation offset ${def.elevation_offset_cm} cm (AREA-v0.1)`)} />
        ) : (
          <Node title={tr("القراءات المُدخلة", "Input readings")}>{def.lag_ticks == null ? tr("المنطقة غير مرتبطة بأي حساس.", "Area is not linked to any sensor.") : tr("لم تصل المياه بعد — لا توجد بيانات.", "Water has not reached the area yet — No Data.")}</Node>
        )}
        <Node title={`${L(def.name)} · ${def.id}`} tag="VIRTUAL">
          <RiskChip risk={(ar?.risk ?? null) as RiskKey} />
          <p className="mt-1 text-fg">{L(ar?.reason)}</p>
          <KV k={tr("متأثرة", "Affected")} v={ar?.affected ? tr("نعم", "yes") : tr("لا", "no")} />
          <KV k={tr("فئة التعرض", "Exposure")} v={L(EXPOSURE_LABEL[def.exposure])} />
          <KV k={tr("حالة البيانات الجغرافية", "Geographic status")} v="virtual" />
        </Node>
        {rank && (
          <Node title={tr("الترتيب", "Ranking")} tag={run.ruleset.rank}>
            <KV k={tr("الأولوية", "Priority")} v={`#${rank.rank}${rank.tie ? " (tie)" : ""}`} />
            <p>{L(rank.reason)}</p>
          </Node>
        )}
        {prevRecs.map((r) => (
          <Node key={r.recommendation_id} title={tr("التوصية السابقة (محفوظة)", "Previous recommendation (kept)")} tag={r.recommendation_id}>
            <KV k={tr("الإجراء", "Action")} v={L(CATALOG[r.recommended_action])} />
            <KV k={tr("الخطر حينها", "Risk then")} v={<RiskChip risk={r.risk_level as RiskKey} />} />
            <KV k={tr("الحالة", "Status")} v={r.status} />
          </Node>
        ))}
        {recs.map((r) => (
          <Node key={r.recommendation_id} title={tr("التوصية", "Recommendation")} tag={r.recommendation_id}>
            <KV k={tr("الإجراء", "Action")} v={L(CATALOG[r.recommended_action])} />
            <p className="text-fg">{L(r.supporting_data.text as { ar: string; en: string })}</p>
            <p>{L(r.reason)}</p>
            <KV k={tr("الحدث المنشئ", "Created by event")} v={r.related_event_id} />
            <KV k={tr("أُنشئت عند", "Created at")} v={T(r.created_at_tick)} />
            <KV k={tr("تتطلب مراجعة بشرية", "Requires human review")} v={r.requires_review ? tr("نعم", "yes") : tr("لا", "no")} />
            <KV k={tr("الحالة", "Status")} v={`${r.status}${r.active ? "" : " · superseded"}`} />
          </Node>
        ))}
        {head && (
          <Node title={tr("خطة الاستجابة", "Response plan")} tag={`${head.plan_id} v${head.version}`}>
            <p>{L(head.change_reason)}</p>
            <KV k={tr("حالة الخطة", "Plan status")} v={head.plan_status} />
          </Node>
        )}
        <Versions run={run} />
      </ol>
    );
  }

  if (target.kind === "stage") return <StageEvidence id={target.id} run={run} />;
  return <p className="text-sm text-muted">{tr("لا توجد بيانات تتبع.", "No lineage available.")}</p>;
}

const STAGE_INFO: Record<string, { ar: string; en: string; source: string[] }> = {
  data: { ar: "يستقبل القراءات المحاكاة لكل دقيقة (T00…T31) من ملف السيناريو أو المولّد البارامتري.", en: "Receives the simulated readings of each tick (T00…T31) from the scenario file or the parametric generator.", source: ["replay", "control"] },
  validation: { ar: "يتحقق من الاكتمال والنوع والوحدة والطابع الزمني والتكرار والفقد والمدى وهوية المصدر.", en: "Checks completeness, type, unit, timestamp, duplicates, gaps, range and source identity.", source: ["validation"] },
  l0: { ar: "حالة التنبيه: قراءة واحدة مقابل حدودها (60/80 سم من إعدادات الموقع).", en: "Alert status: one reading against its limits (60/80 cm from the website configuration).", source: ["L0"] },
  l1: { ar: "تقييم الخطر القائم على القواعد (RF، LR، LH) — مستقل تمامًا عن L0.", en: "Rule-based risk assessment (RF, LR, LH) — fully independent from L0.", source: ["L1"] },
  ai: { ar: "مرحلة الذكاء الاصطناعي مقترحة فقط؛ لا يوجد نموذج مُدرّب متصل.", en: "The AI stage is proposed only; no trained model is connected.", source: [] },
  geo: { ar: "يربط المخاطر بالمناطق الافتراضية (زمن وصول + فرق ارتفاع).", en: "Associates risk with virtual areas (impact lag + elevation offset).", source: ["geo", "rank"] },
  decision: { ar: "توصيات مرتبطة بالمناطق من كتالوج معتمد مبدئيًا (مراقبة، تحقق، إبلاغ، تصعيد، استعداد).", en: "Area-linked recommendations from the proposed catalog (Monitor, Verify, Notify, Escalate, Prepare).", source: ["decision", "operator"] },
  plan: { ar: "خطة استجابة بإصدارات، تتحدث عند تغيّر الظروف مع شرح كل تغيير.", en: "Versioned response plan, updated when conditions change, with every change explained.", source: ["plan", "routes"] },
};

function StageEvidence({ id, run }: { id: string; run: RunView }) {
  const tr = useTr();
  const L = useL();
  const events = useRasd((s) => s.events);
  const info = STAGE_INFO[id];
  const recent = events.filter((e) => info?.source.includes(e.source)).slice(-8).reverse();
  return (
    <ol>
      <Node title={tr("وصف الوحدة", "Module")}>{info ? L(info) : id}</Node>
      <Node title={tr("آخر الأحداث", "Latest events")} tag={`${recent.length}`}>
        {recent.length ? (
          recent.map((e) => (
            <div key={e.id} className="border-b border-line/60 pb-1 last:border-0">
              <span className="num text-[10px] text-dim">{e.event_id} · {T(e.tick)}</span> <span className="text-fg">{e.type}</span>
              {e.area_id && <span className="text-dim"> · {e.area_id}</span>}
              {e.reason && <div className="text-[11px]">{L(e.reason)}</div>}
            </div>
          ))
        ) : (
          <span>{tr("لا توجد أحداث لهذه الوحدة بعد.", "No events for this module yet.")}</span>
        )}
      </Node>
      <Versions run={run} />
    </ol>
  );
}

/** The signature "why?" view: any output traced back to readings, rules and versions (spec §4.4). */
export function EvidenceDrawer() {
  const target = useEvidence((s) => s.target);
  const close = useEvidence((s) => s.close);
  const run = useRasd((s) => s.run);
  const tr = useTr();
  if (!target) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <aside className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col border-s border-line bg-[#0a1519] shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <div className="flex items-center gap-2 font-bold">
              <FileSearch className="size-5 text-brand" /> {tr("سلسلة الأدلة", "Evidence chain")}
            </div>
            <p className="mt-0.5 text-xs text-muted">{tr("من القراءة إلى القرار — كل مخرج قابل للتتبع", "From reading to decision — every output is traceable")}</p>
          </div>
          <button onClick={close} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label={tr("إغلاق", "Close")}>
            <X className="size-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 border-b border-line bg-[#3b1206]/60 px-5 py-1.5 text-[11px] font-semibold text-[#fed7aa]" dir="ltr">
          SIMULATED SCENARIO – NOT LIVE DATA
        </div>
        <div className={clsx("flex-1 overflow-y-auto p-5")}>
          {run ? (
            <Lineage target={target} run={run} />
          ) : (
            <div className="space-y-3 text-sm text-muted">
              <p>{tr("لا يوجد سيناريو نشط. سلسلة الأدلة تُبنى من حالة التشغيل.", "No active scenario. The evidence chain is built from the run state.")}</p>
              <Link href="/simulation" className="text-brand hover:underline">{tr("ابدأ من مركز المحاكاة", "Start from the Simulation Center")}</Link>
            </div>
          )}
        </div>
        {run && (
          <div className="border-t border-line px-5 py-3 text-[11px] text-dim">
            <Pill>{tr("تشغيل", "Run")} #{run.run_id}</Pill> <Pill>{run.scenario_id}</Pill>{" "}
            <Link className="text-brand hover:underline" href={`/events?run=${run.run_id}`} onClick={close}>{tr("السجل الكامل", "Full event log")}</Link>
          </div>
        )}
      </aside>
    </div>
  );
}
