"use client";
import clsx from "clsx";
import { Bell, Cpu, Database, LayoutGrid, Radio, ScanSearch } from "lucide-react";
import { useRasd } from "@/lib/store";
import { Card } from "../ui";

const STAGES = [
  { label: "الحساس", icon: Radio },
  { label: "وحدة التحكم", icon: Cpu },
  { label: "قاعدة البيانات", icon: Database },
  { label: "تحليل المستوى", icon: ScanSearch },
  { label: "تحديث اللوحة", icon: LayoutGrid },
  { label: "إصدار التنبيه", icon: Bell },
];

/** The core loop from the brief, with a pulse that travels along it on every incoming reading. */
export function ResponseCycle() {
  const lastEventAt = useRasd((s) => s.lastEventAt);
  const connected = useRasd((s) => s.connected);
  return (
    <Card className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
      <div className="shrink-0 text-sm font-semibold">دورة الاستجابة</div>
      <div className="relative flex flex-1 items-center justify-between gap-2 overflow-x-auto">
        <div className="absolute inset-x-6 top-1/2 h-px bg-line-2" />
        {lastEventAt && (
          <span
            key={lastEventAt}
            className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-brand shadow-[0_0_10px] shadow-brand"
            style={{ animation: "travel 1.3s ease-in-out forwards" }}
          />
        )}
        {STAGES.map(({ label, icon: Icon }) => (
          <div key={label} className="relative z-10 flex shrink-0 items-center gap-2 bg-surface px-2 text-xs text-muted">
            <Icon className="size-4 text-fg" strokeWidth={1.7} /> {label}
          </div>
        ))}
      </div>
      <div className={clsx("flex shrink-0 items-center gap-2 text-xs", connected ? "text-brand" : "text-warn")}>
        <span className={clsx("size-1.5 rounded-full", connected ? "bg-brand" : "bg-warn")} />
        {connected ? "تعمل تلقائيًا" : "متوقفة مؤقتًا"}
      </div>
    </Card>
  );
}
