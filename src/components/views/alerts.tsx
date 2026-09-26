"use client";
import clsx from "clsx";
import { ArrowLeft, BellOff, CheckCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { KpiRow } from "@/components/shell/kpi-row";
import { PageHeader } from "@/components/shell/page-header";
import { Button, Card, SensorIcon, SourceTag, StatusBadge } from "@/components/ui";
import { indexBy } from "@/lib/derive";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { SENSOR_META, formatValue } from "@/lib/sensor-meta";
import { useRasd } from "@/lib/store";
import { useNow } from "@/lib/use-now";

const TABS = [
  { id: "all", label: "جميع التنبيهات" },
  { id: "open", label: "بانتظار الاطلاع" },
  { id: "danger", label: "خطر" },
  { id: "warning", label: "تحذير" },
] as const;

export function AlertsView() {
  const alerts = useRasd((s) => s.alerts);
  const sensors = useRasd((s) => s.sensors);
  const stations = useRasd((s) => s.stations);
  const acknowledge = useRasd((s) => s.acknowledge);
  const now = useNow(Date.parse(useRasd.getState().serverTime));
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [busy, setBusy] = useState<number | null>(null);
  const sensorById = indexBy(sensors);
  const stationById = indexBy(stations);

  const list = alerts.filter((a) =>
    tab === "all" ? true : tab === "open" ? !a.acknowledged_at : a.level === tab,
  );
  const openCount = alerts.filter((a) => !a.acknowledged_at).length;

  async function ack(id: number) {
    setBusy(id);
    try {
      await acknowledge(id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="سجل التنبيهات" sub="تابع القراءات التي تجاوزت الحدود، وأكّد الاطلاع على الحالات." />
      <KpiRow />
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                "rounded-xl border px-4 py-2 text-sm transition",
                tab === t.id ? "border-brand/40 bg-brand/10 font-semibold text-brand" : "border-line-2 text-muted hover:text-fg",
              )}
            >
              {t.label}
              {t.id === "open" && openCount > 0 && <span className="num ms-2 rounded bg-danger/20 px-1.5 text-xs text-[#ff9aab]">{openCount}</span>}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">{list.length} تنبيه · سجل محفوظ</span>
      </div>

      <div className="mt-4 space-y-3">
        {list.length === 0 && (
          <Card className="flex flex-col items-center gap-3 p-12 text-center text-muted">
            <BellOff className="size-8" strokeWidth={1.5} />
            لا توجد تنبيهات في هذا التصنيف.
          </Card>
        )}
        {list.map((a) => {
          const s = sensorById.get(a.sensor_id);
          const st = s && stationById.get(s.station_id);
          if (!s || !st) return null;
          const meta = SENSOR_META[s.type];
          const fresh = now - Date.parse(a.created_at) < 8000;
          return (
            <Card
              key={a.id}
              className={clsx(
                "flex flex-col gap-4 p-5 sm:flex-row sm:items-center",
                !a.acknowledged_at && a.level === "danger" && "border-danger/30",
                a.acknowledged_at && "opacity-70",
                fresh && "animate-flash",
              )}
            >
              <SensorIcon type={s.type} status={a.level} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold">{meta.hazard}</h3>
                  <StatusBadge status={a.level} />
                  <SourceTag source={a.source} />
                  <span className="num text-xs text-dim">#ALT-{a.id}</span>
                </div>
                <p className="mt-1.5 text-sm text-muted">
                  {st.name_ar}، {st.city_ar} · <b className="num text-fg">{formatValue(s.type, a.value)}</b> {meta.unitLabel} · حد{" "}
                  {a.level === "danger" ? "الخطر" : "التحذير"}: <span className="num">{formatValue(s.type, a.threshold)}</span>
                </p>
                <p className="mt-1 text-xs text-dim">
                  رُصد <span className="num">{fmtDateTime(a.created_at)}</span> · <span suppressHydrationWarning>{timeAgo(a.created_at, now)}</span>
                  {a.acknowledged_at && (
                    <span className="text-brand">
                      {" "}· تم الاطلاع بواسطة {a.acknowledged_by} <span className="num">{fmtDateTime(a.acknowledged_at)}</span>
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                {a.acknowledged_at ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2 text-sm text-brand">
                    <CheckCheck className="size-4" /> تم الاطلاع
                  </span>
                ) : (
                  <Button onClick={() => ack(a.id)} disabled={busy === a.id}>
                    <ShieldCheck className="size-4" /> تأكيد الاطلاع
                  </Button>
                )}
                <Link href={`/sensors/${s.code}`} className="flex items-center gap-1 text-xs text-brand hover:underline">
                  تفاصيل الحساس <ArrowLeft className="size-3.5" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
