"use client";
import clsx from "clsx";
import { Brain, ClipboardList, Database, Gauge, Map as MapIcon, Radio, ScanSearch, ShieldCheck, Workflow } from "lucide-react";
import { useEvidence } from "@/components/evidence/store";
import { useTr } from "@/lib/i18n";
import { useRasd } from "@/lib/store";
import { useSystemStatus } from "@/lib/use-system";
import { Card, type ModuleState, StateTag } from "../ui";

/**
 * Spec §3.1/§11.7: the integrated chain with each stage's REAL runtime state and last output.
 * Replaces the earlier decorative "response cycle" animation. Click a stage for its evidence.
 */
export function OperationalChain() {
  const run = useRasd((s) => s.run);
  const connected = useRasd((s) => s.connected);
  const lastEventAt = useRasd((s) => s.lastEventAt);
  const { status } = useSystemStatus();
  const open = useEvidence((s) => s.open);
  const tr = useTr();
  const s = run?.state;
  const has = !!s && s.tick >= 0;
  const T = (t: number) => `T${String(t).padStart(2, "0")}`;
  const active = (run && (run.status === "running" || run.status === "paused" || run.status === "completed")) || false;
  const sim: ModuleState = active ? "simulated" : "idle";

  const aiState: ModuleState = !status ? "idle" : status.ai.state === "not_configured" ? "not_configured" : status.ai.state === "ready" || status.ai.state === "running" ? "operational" : status.ai.state === "error" ? "error" : "unavailable";
  const stages: { id: string; icon: typeof Radio; label: string; state: ModuleState; out: string }[] = [
    { id: "data", icon: Radio, label: tr("استقبال البيانات", "Data ingestion"), state: active ? "simulated" : status?.generator === "running" ? "simulated" : "idle", out: has ? `${T(s!.tick)} · WTR-01 ${s!.levels[s!.tick] ?? "—"} cm` : status?.generator === "running" ? tr("مولّد الخلفية", "Background generator") : "—" },
    { id: "validation", icon: ShieldCheck, label: tr("التحقق", "Validation"), state: has ? "operational" : sim, out: has ? (s!.quality[s!.tick] ?? "—") : "—" },
    { id: "l0", icon: Gauge, label: "L0 " + tr("التنبيه", "alert"), state: "operational", out: has ? { normal: tr("طبيعي", "Normal"), warning: tr("تحذير", "Warning"), danger: tr("خطر", "Critical"), unknown: "—" }[s!.l0] : tr("على البيانات الحية", "On generator data") },
    { id: "l1", icon: ScanSearch, label: "L1 " + tr("الخطر", "risk"), state: has ? "operational" : "idle", out: has ? (s!.l1?.risk_level ?? tr("غير متاح", "Unavailable")) : tr("يعمل على بيانات السيناريو", "Runs on scenario data") },
    { id: "ai", icon: Brain, label: "AI", state: aiState === "not_configured" ? "proposed" : aiState, out: tr("مقترح · غير مُهيأ", "Proposed · Not Configured") },
    { id: "geo", icon: MapIcon, label: tr("المناطق", "Areas"), state: has ? "operational" : "idle", out: has ? `${s!.areas.filter((a) => a.affected).length} ${tr("متأثرة", "affected")}` : "—" },
    { id: "decision", icon: Workflow, label: tr("دعم القرار", "Decision"), state: has ? "operational" : "idle", out: has ? `${s!.recs.filter((r) => r.active && r.requires_review && r.status === "proposed").length} ${tr("بانتظار المراجعة", "awaiting review")}` : "—" },
    { id: "plan", icon: ClipboardList, label: tr("خطة الاستجابة", "Response plan"), state: has ? "operational" : "idle", out: run?.plan_head ? `v${run.plan_head.version} · ${run.plan_head.plan_status}` : "—" },
  ];

  return (
    <Card className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Database className="size-4 text-muted" /> {tr("سلسلة التشغيل المتكاملة", "Integrated operational chain")}
          <span className="text-xs font-normal text-muted">{tr("— الحالة الفعلية لكل مرحلة؛ اضغط لعرض الأدلة", "— real state of each stage; click for evidence")}</span>
        </div>
        <div className={clsx("flex items-center gap-2 text-xs", connected ? "text-brand" : "text-warn")}>
          <span className={clsx("size-1.5 rounded-full", connected ? "bg-brand" : "bg-warn")} />
          {connected ? tr("متصل", "Connected") : tr("غير متصل", "Disconnected")}
          {run?.processing_ms ? <span className="num text-muted">· {run.processing_ms} ms/tick</span> : null}
        </div>
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {lastEventAt && active && run?.status === "running" && (
          <span key={run.tick} className="pointer-events-none absolute -top-1 hidden h-0.5 w-10 rounded bg-brand shadow-[0_0_10px] shadow-brand xl:block" style={{ animation: "travel 0.9s ease-in-out forwards" }} />
        )}
        {stages.map((st, i) => (
          <button
            key={st.id}
            onClick={() => open({ kind: st.id === "l1" ? "l1" : "stage", id: st.id } as never)}
            className={clsx(
              "group relative flex flex-col items-start gap-1.5 rounded-xl border p-3 text-start transition hover:border-dim",
              st.state === "proposed" || st.state === "not_configured" || st.state === "idle" ? "border-dashed border-line-2 bg-transparent" : "border-line bg-surface-2",
            )}
          >
            <div className="flex w-full items-center justify-between gap-1">
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="num text-[10px] text-dim">{i + 1}</span>
                <st.icon className="size-4 text-muted" strokeWidth={1.8} />
                {st.label}
              </span>
            </div>
            <StateTag state={st.state} />
            <span className="num w-full truncate text-[11px] text-muted" title={st.out}>{st.out}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
