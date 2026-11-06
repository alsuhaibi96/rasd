"use client";
import clsx from "clsx";
import { Archive, RefreshCw, Radio, ShieldAlert, TriangleAlert } from "lucide-react";
import { kpis } from "@/lib/derive";
import { fmtTime, timeAgo } from "@/lib/format";
import { useLang, useTr } from "@/lib/i18n";
import { useRasd } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { Card } from "../ui";

export function KpiRow() {
  const allSensors = useRasd((s) => s.sensors);
  const lastEventAt = useRasd((s) => s.lastEventAt);
  const run = useRasd((s) => s.run);
  const alerts = useRasd((s) => s.alerts);
  const alertTotal = useRasd((s) => s.alertTotal);
  const now = useNow(Date.parse(useRasd.getState().serverTime));
  const tr = useTr();
  const lang = useLang();
  // F-03 §9: during a scenario the active counters show the scenario point only.
  const sensors = run ? allSensors.filter((s) => s.last_scenario_id === run.scenario_id) : allSensors;
  const k = kpis(sensors, now);
  const kAll = kpis(allSensors, now);
  const runAlerts = run ? alerts.filter((a) => a.run_id === run.run_id).length : alertTotal;

  const items = [
    {
      label: tr("الأجهزة الفعلية المتصلة", "Real devices connected"),
      icon: Radio,
      tone: "text-brand bg-brand/10 border-brand/25",
      value: (
        <>
          {kAll.deviceOnline}
          <span className="ms-1 text-base font-medium text-dim">/ {kAll.total}</span>
        </>
      ),
      foot: kAll.deviceOnline ? tr("أجهزة ترسل قراءات (مصدر خارجي غير متحقق منه)", "Devices reporting (external, unverified source)") : tr("لا توجد أجهزة حقيقية متصلة", "No real devices connected"),
      footTone: kAll.deviceOnline ? "text-brand" : "text-muted",
    },
    {
      label: tr("خطر نشط (L0)", "Active Critical (L0)"),
      icon: TriangleAlert,
      tone: "text-danger bg-danger/10 border-danger/30",
      value: k.danger,
      foot: run ? tr("نقطة السيناريو فقط · الحالة الحالية", "Scenario point only · current status") : tr("حساسات عند حد الخطر الآن", "Sensors at Critical now"),
      footTone: k.danger ? "text-[#ff8a9c]" : "text-muted",
    },
    {
      label: tr("تحذير نشط (L0)", "Active Warning (L0)"),
      icon: ShieldAlert,
      tone: "text-warn bg-warn/10 border-warn/30",
      value: k.warning,
      foot: run ? tr("نقطة السيناريو فقط · الحالة الحالية", "Scenario point only · current status") : tr("حساسات عند حد التحذير الآن", "Sensors at Warning now"),
      footTone: k.warning ? "text-warn" : "text-muted",
    },
    {
      label: tr("سجل التنبيهات (تراكمي)", "Alert log (cumulative)"),
      icon: Archive,
      tone: "text-muted bg-surface-3 border-line-2",
      value: runAlerts,
      foot: run ? tr(`سجلات L0 لهذا التشغيل · لا تُحذف عند العودة للطبيعي`, `L0 records for this run · kept after return to Normal`) : tr("كل السجلات المحفوظة · لا تُحذف", "All saved records · never deleted"),
      footTone: "text-muted",
    },
    {
      label: run ? tr("آخر قراءة محاكاة", "Last simulated reading") : tr("آخر قراءة مستلمة", "Last reading received"),
      icon: RefreshCw,
      tone: "text-muted bg-surface-3 border-line-2",
      value: <span suppressHydrationWarning>{timeAgo(k.lastSeen, now, lang)}</span>,
      foot: <>{tr("التحديث تلقائي", "Auto-updating")} · <span className="num">{fmtTime(k.lastSeen)}</span></>,
      footTone: "text-muted",
      spin: true,
    },
  ];

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
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
