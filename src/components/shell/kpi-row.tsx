"use client";
import clsx from "clsx";
import { RefreshCw, Radio, ShieldAlert, TriangleAlert } from "lucide-react";
import { kpis } from "@/lib/derive";
import { fmtTime, timeAgo } from "@/lib/format";
import { useRasd } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { Card } from "../ui";

export function KpiRow() {
  const sensors = useRasd((s) => s.sensors);
  const lastEventAt = useRasd((s) => s.lastEventAt);
  const now = useNow(Date.parse(useRasd.getState().serverTime));
  const k = kpis(sensors, now);

  const items = [
    {
      label: "الأجهزة الفعلية المتصلة",
      icon: Radio,
      tone: "text-brand bg-brand/10 border-brand/25",
      value: (
        <>
          {k.deviceOnline}
          <span className="ms-1 text-base font-medium text-dim">/ {k.total}</span>
        </>
      ),
      foot: k.deviceOnline ? "أجهزة ESP32 ترسل قراءات حية" : "بانتظار ربط أول جهاز",
      footTone: k.deviceOnline ? "text-brand" : "text-muted",
    },
    {
      label: "حالات الخطر",
      icon: TriangleAlert,
      tone: "text-danger bg-danger/10 border-danger/30",
      value: k.danger,
      foot: "حساسات تجاوزت حد الخطر الآن",
      footTone: k.danger ? "text-[#ff8a9c]" : "text-muted",
    },
    {
      label: "حالات التحذير",
      icon: ShieldAlert,
      tone: "text-warn bg-warn/10 border-warn/30",
      value: k.warning,
      foot: "قراءات تجاوزت حد التحذير",
      footTone: k.warning ? "text-warn" : "text-muted",
    },
    {
      label: "آخر قراءة مستلمة",
      icon: RefreshCw,
      tone: "text-muted bg-surface-3 border-line-2",
      value: <span suppressHydrationWarning>{timeAgo(k.lastSeen, now)}</span>,
      foot: <>التحديث تلقائي · <span className="num">{fmtTime(k.lastSeen)}</span></>,
      footTone: "text-muted",
      spin: true,
    },
  ];

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className="relative overflow-hidden p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs text-muted sm:text-sm">{it.label}</span>
            <span className={clsx("grid size-9 place-items-center rounded-xl border sm:size-10", it.tone)}>
              <it.icon key={it.spin ? lastEventAt ?? 0 : undefined} className={clsx("size-5", it.spin && lastEventAt && "animate-[spin_0.8s_ease-out_1]")} strokeWidth={1.8} />
            </span>
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums sm:text-4xl">{it.value}</div>
          <div className={clsx("mt-2 flex items-center gap-1.5 text-xs", it.footTone)}>
            <span className="size-1.5 rounded-full bg-current" />
            {it.foot}
          </div>
        </Card>
      ))}
    </div>
  );
}
