"use client";
import clsx from "clsx";
import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { SaudiMap } from "@/components/map";
import { Card, SectionTitle, SensorIcon, SourceTag, StatusBadge, Value } from "@/components/ui";
import { fmtDateTime, fmtTime, timeAgo } from "@/lib/format";
import { SENSOR_META, formatValue } from "@/lib/sensor-meta";
import { useRasd } from "@/lib/store";
import { useNow } from "@/lib/use-now";

export function SensorDetailView({ code }: { code: string }) {
  const sensors = useRasd((s) => s.sensors);
  const stations = useRasd((s) => s.stations);
  const alerts = useRasd((s) => s.alerts);
  const thresholds = useRasd((s) => s.thresholds);
  const history = useRasd((s) => s.history);
  const now = useNow(Date.parse(useRasd.getState().serverTime));

  const sensor = sensors.find((s) => s.code === code);
  const station = sensor && stations.find((s) => s.id === sensor.station_id);
  const own = useMemo(() => (sensor ? alerts.filter((a) => a.sensor_id === sensor.id).slice(0, 8) : []), [alerts, sensor]);

  if (!sensor || !station) {
    return (
      <Card className="p-10 text-center">
        <p className="text-muted">الحساس <span className="num">{code}</span> غير موجود.</p>
        <Link href="/stations" className="mt-4 inline-block text-brand">العودة إلى نقاط الرصد</Link>
      </Card>
    );
  }
  const meta = SENSOR_META[sensor.type];
  const t = thresholds.find((x) => x.sensor_type === sensor.type);
  const recent = [...(history[sensor.id] ?? [])].reverse().slice(0, 12);

  return (
    <>
      <Link href="/stations" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowRight className="size-4" /> نقاط الرصد
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <SensorIcon type={sensor.type} status={sensor.last_status} size="lg" />
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            {meta.label} <span className="num rounded-md border border-line-2 px-2 py-0.5 text-sm font-medium text-muted">{sensor.code}</span>
          </h1>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5" /> {station.name_ar}، {station.city_ar} <SourceTag source={sensor.last_source} />
          </div>
        </div>
        <div className="ms-auto flex items-center gap-4">
          <Value value={formatValue(sensor.type, sensor.last_value)} unit={meta.unitLabel} className="text-5xl" />
          <StatusBadge status={sensor.last_status} className="text-sm" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionTitle
            title="اتجاه القراءات"
            sub={
              <>
                آخر تحديث <span className="num">{fmtTime(sensor.last_seen_at)}</span> · <span suppressHydrationWarning>{timeAgo(sensor.last_seen_at, now)}</span>
              </>
            }
          />
          <div className="mt-4">
            <TrendChart sensor={sensor} height={340} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <div className="text-muted">حد التحذير</div>
              <div className="num mt-1 text-lg font-bold text-warn">{formatValue(sensor.type, t?.warning)}</div>
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <div className="text-muted">حد الخطر</div>
              <div className="num mt-1 text-lg font-bold text-danger">{formatValue(sensor.type, t?.danger)}</div>
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <div className="text-muted">الاتجاه</div>
              <div className="mt-1 text-sm font-semibold">{t?.direction === "below" ? "الخطر عند الانخفاض" : "الخطر عند الارتفاع"}</div>
            </div>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <SaudiMap className="h-full min-h-[420px]" stations={[station]} sensors={sensors} selectedStationId={station.id} />
        </Card>

        <Card className="overflow-hidden xl:col-span-2">
          <div className="p-5"><SectionTitle title="آخر القراءات" sub="تتحدث مباشرة مع وصول كل قراءة" /></div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line bg-surface-2/50 text-xs text-muted">
                <th className="px-5 py-2.5 text-start font-medium">الوقت</th>
                <th className="px-3 py-2.5 text-start font-medium">القراءة</th>
                <th className="px-3 py-2.5 text-start font-medium">الحالة</th>
                <th className="px-5 py-2.5 text-start font-medium">المصدر</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={r.id} className={clsx("border-b border-line/60 last:border-0", i === 0 && "animate-flash")}>
                  <td className="num px-5 py-2.5 text-start text-muted">{fmtTime(r.created_at)}</td>
                  <td className="px-3 py-2.5"><Value value={formatValue(sensor.type, r.value)} unit={meta.unitLabel} /></td>
                  <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-2.5"><SourceTag source={r.source} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="p-5">
          <SectionTitle title="تنبيهات هذا الحساس" sub={`${own.length} تنبيه`} />
          <ul className="mt-4 space-y-2">
            {own.length === 0 && <li className="text-sm text-muted">لا توجد تنبيهات مسجلة.</li>}
            {own.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.level} />
                  <span className="num">{formatValue(sensor.type, a.value)}</span>
                  <span className="text-xs text-muted">{meta.unitLabel}</span>
                </div>
                <div className="text-end text-xs text-muted">
                  <div className="num">{fmtDateTime(a.created_at)}</div>
                  <div className={a.acknowledged_at ? "text-brand" : "text-warn"}>{a.acknowledged_at ? "تم الاطلاع" : "بانتظار الاطلاع"}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
