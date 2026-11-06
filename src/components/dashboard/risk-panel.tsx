"use client";
import clsx from "clsx";
import { Brain, FileSearch, FlaskConical, Gauge, ScanSearch } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useEvidence } from "@/components/evidence/store";
import { RECOMMENDATION_FOOTER } from "@/engine";
import { useL, useTr } from "@/lib/i18n";
import { useRasd } from "@/lib/store";
import { useSystemStatus } from "@/lib/use-system";
import { Card, RiskLevel, StateTag, StatusBadge } from "../ui";

const Flag = ({ on, label, value }: { on: boolean; label: string; value: string }) => (
  <div className={clsx("rounded-lg border px-2.5 py-2", on ? "border-[#fb923c]/40 bg-[#fb923c]/10" : "border-line bg-surface-2")}>
    <div className="flex items-center justify-between text-[11px]">
      <span className="font-semibold">{label}</span>
      <span className={on ? "text-[#fdba74]" : "text-dim"}>{on ? "Y" : "N"}</span>
    </div>
    <div className="num mt-0.5 text-xs text-muted">{value}</div>
  </div>
);

/**
 * Risk Assessment panel — kept separate from the L0 priority alert (F-03 §0, §9 item 4).
 * Stage toggle L0 · L1 · AI; AI disabled and labeled Proposed (TC-14).
 */
export function RiskPanel() {
  const run = useRasd((s) => s.run);
  const tr = useTr();
  const L = useL();
  const open = useEvidence((s) => s.open);
  const { status } = useSystemStatus();
  const [stage, setStage] = useState<"l0" | "l1" | "ai">("l1");
  const l1 = run?.state.l1;
  const i = l1?.indicators;

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <ScanSearch className="size-5 text-muted" /> {tr("تقييم الخطر", "Risk assessment")}
          </h2>
          <p className="mt-1 text-xs text-muted">{tr("مستقل عن حالة التنبيه — لا يُشتق أحدهما من الآخر", "Independent from alert status — neither is derived from the other")}</p>
        </div>
        <div className="flex rounded-lg border border-line-2 p-0.5 text-xs" role="tablist">
          {(["l0", "l1", "ai"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={stage === k}
              disabled={k === "ai"}
              onClick={() => setStage(k)}
              title={k === "ai" ? tr("مقترح — لا يوجد نموذج مُدرّب متصل", "Proposed — no trained model connected") : undefined}
              className={clsx("rounded-md px-2.5 py-1 font-semibold", stage === k ? "bg-surface-3 text-fg" : "text-muted", k === "ai" && "cursor-not-allowed opacity-50")}
            >
              {k.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {!run || !l1 ? (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-2 p-6 text-center">
          <span className="text-sm font-semibold">{tr("غير متاح", "Unavailable")}</span>
          <p className="max-w-xs text-xs leading-5 text-muted">
            {tr("يعمل تقييم L1 على بيانات سيناريو محاكاة معتمد (F-03). لا توجد بيانات حساسات حقيقية متصلة.", "L1 runs on an approved simulated scenario (F-03). No real sensor data is connected.")}
          </p>
          <Link href="/simulation" className="inline-flex items-center gap-2 rounded-xl border border-line-2 bg-surface-2 px-3 py-2 text-xs font-semibold hover:bg-surface-3">
            <FlaskConical className="size-4" /> {tr("تشغيل سيناريو F-03", "Run scenario F-03")}
          </Link>
        </div>
      ) : stage === "l0" ? (
        <div className="mt-5 space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 p-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted"><Gauge className="size-3.5" /> {tr("حالة التنبيه (L0) · WTR-01", "Alert status (L0) · WTR-01")}</div>
              <div className="num mt-1 text-2xl font-bold">{run.state.levels[run.state.tick] ?? "—"} <span className="text-xs text-muted">cm</span></div>
            </div>
            <StatusBadge status={run.state.l0} />
          </div>
          <p className="text-xs leading-5 text-muted">
            {tr(`قراءة واحدة مقابل حدودها: تحذير ≥ ${run.limits.warning} سم، خطر ≥ ${run.limits.danger} سم. قيم من إعدادات الموقع (تم التحقق منها في الشيفرة) وليست حدودًا هيدرولوجية معتمدة. RAIN-01 لا يملك حد L0.`, `One reading against its limits: Warning ≥ ${run.limits.warning} cm, Critical ≥ ${run.limits.danger} cm. Website configuration values (verified in code), not validated hydrological thresholds. RAIN-01 has no L0 limit.`)}
          </p>
          <div className="text-xs text-muted">
            {tr("التحولات", "Transitions")}: {run.state.l0History.length ? run.state.l0History.map((h) => `T${String(h.tick).padStart(2, "0")} → ${h.to === "danger" ? tr("خطر", "Critical") : h.to === "warning" ? tr("تحذير", "Warning") : tr("طبيعي", "Normal")}`).join(" · ") : "—"}
          </div>
        </div>
      ) : stage === "ai" ? (
        <div className="mt-5 space-y-2 text-sm">
          <div className="flex items-center gap-2"><Brain className="size-4" /> AI <StateTag state="proposed" /></div>
          <p className="text-xs text-muted">{status?.ai.detail}</p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <RiskLevel risk={l1.risk_level} size="lg" note={l1.warmup ? tr("إحماء", "warm-up") : l1.receding ? tr("انحسار", "receding") : undefined} />
            <span className="num text-xs text-muted">T{String(l1.tick).padStart(2, "0")} · {l1.rule}</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Flag on={i!.RF} label="RF" value={`R10 ${i!.r10 ?? "n/a"} mm`} />
            <Flag on={i!.LR} label="LR" value={`rise₃ ${i!.rise_3 ?? "n/a"} cm`} />
            <Flag on={i!.LH} label="LH" value={`${i!.level ?? "—"} cm`} />
          </div>
          <p className="mt-3 text-xs leading-5 text-fg">{L(l1.explanation)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted">
            <span>{tr("جودة البيانات", "Data quality")}: <b className="text-fg">{l1.quality}</b></span>
            <span>{tr("ثقة النموذج", "Model confidence")}: <b className="text-fg">{tr("غير منطبق – قائم على القواعد", "Not applicable – rule-based")}</b></span>
          </div>
          <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-xs">
            <div className="font-semibold">{L(l1.recommendation)}</div>
            <div className="mt-1.5 text-[10px] text-dim">{L(RECOMMENDATION_FOOTER)}</div>
          </div>
          <button onClick={() => open({ kind: "l1" })} className="mt-auto flex items-center justify-center gap-2 pt-4 text-xs text-brand hover:underline">
            <FileSearch className="size-4" /> {tr("لماذا هذا المستوى؟ عرض سلسلة الأدلة", "Why this level? Show evidence chain")}
          </button>
        </>
      )}
    </Card>
  );
}
