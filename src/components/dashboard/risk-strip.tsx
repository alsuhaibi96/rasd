"use client";
import clsx from "clsx";
import { useTr } from "@/lib/i18n";
import { useRasd } from "@/lib/store";
import { RISK_COLOR, riskLabel } from "../ui";

/** F-03 §9 item 5: per-tick L1 risk strip beneath the trend chart. */
export function RiskStrip({ compact }: { compact?: boolean }) {
  const run = useRasd((s) => s.run);
  const tr = useTr();
  if (!run) return null;
  const hist = run.state.l1History;
  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      <div className="mb-1 flex items-center justify-between text-[10px] text-dim">
        <span>{tr("مستوى الخطر L1 لكل دقيقة", "L1 risk level per tick")}</span>
        <span className="num" dir="ltr">T00 → T{String(run.length - 1).padStart(2, "0")}</span>
      </div>
      <div className="flex gap-px" dir="ltr">
        {Array.from({ length: run.length }, (_, t) => {
          const r = hist[t];
          const done = t <= run.state.tick;
          return (
            <span
              key={t}
              title={`T${String(t).padStart(2, "0")} · ${done ? riskLabel(r ?? null, tr) : "—"}`}
              className={clsx("h-3 flex-1 first:rounded-s last:rounded-e", t === run.state.tick && "ring-1 ring-fg")}
              style={{ background: done ? (r ? RISK_COLOR[r] : RISK_COLOR.no_data) : "var(--color-surface-3)", opacity: done ? 1 : 0.6 }}
            />
          );
        })}
      </div>
    </div>
  );
}
