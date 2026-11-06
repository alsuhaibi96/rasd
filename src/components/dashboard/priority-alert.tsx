"use client";
import clsx from "clsx";
import { ArrowLeft, Check, Clock, MapPin, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { indexBy, priorityAlert } from "@/lib/derive";
import { fmtTime, isStale, timeAgo } from "@/lib/format";
import { useLang, useTr } from "@/lib/i18n";
import { SENSOR_META, SENSOR_META_EN, formatValue } from "@/lib/sensor-meta";
import { useRasd } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { Button, Card, SensorIcon, SourceTag, StatusBadge, Value } from "../ui";

const STEPS: [string, string][] = [
  ["رصد القراءة", "Reading detected"],
  ["تحليل البيانات", "Data analysed"],
  ["إصدار التنبيه", "Alert issued"],
  ["تأكيد الاطلاع", "Acknowledged"],
];

export function ResponsePath({ acknowledged }: { acknowledged: boolean }) {
  const tr = useTr();
  const done = acknowledged ? 4 : 3;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{tr("مسار الاستجابة", "Response path")}</span>
        <span className={acknowledged ? "text-brand" : "text-warn"}>{acknowledged ? tr("تم الاطلاع", "Acknowledged") : tr("بانتظار الاطلاع", "Awaiting acknowledgement")}</span>
      </div>
      <ol className="mt-4 grid grid-cols-4">
        {STEPS.map(([ar, en], i) => {
          const label = tr(ar, en);
          const ok = i < done;
          return (
            <li key={ar} className="relative flex flex-col items-center gap-2 text-center">
              {i > 0 && <span className={clsx("absolute top-3 start-[-50%] end-[50%] h-px", i < done ? "bg-brand/60" : "bg-line-2")} />}
              <span
                className={clsx(
                  "relative z-10 grid size-6 place-items-center rounded-full border text-[11px]",
                  ok ? "border-brand bg-brand/20 text-brand" : "border-warn/60 bg-surface text-warn",
                )}
              >
                {ok ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={clsx("text-[11px]", ok ? "text-fg" : "text-muted")}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function PriorityAlert() {
  const alerts = useRasd((s) => s.alerts);
  const sensors = useRasd((s) => s.sensors);
  const stations = useRasd((s) => s.stations);
  const acknowledge = useRasd((s) => s.acknowledge);
  const now = useNow(Date.parse(useRasd.getState().serverTime));
  const [busy, setBusy] = useState(false);
  const tr = useTr();
  const lang = useLang();

  const alert = priorityAlert(alerts);
  const sensor = alert && indexBy(sensors).get(alert.sensor_id);
  const station = sensor && indexBy(stations).get(sensor.station_id);

  if (!alert || !sensor || !station) {
    return (
      <Card className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="grid size-14 place-items-center rounded-2xl border border-brand/30 bg-brand/10 text-brand">
          <ShieldCheck className="size-7" strokeWidth={1.6} />
        </span>
        <div className="text-lg font-bold">{tr("لا توجد تنبيهات نشطة", "No active alerts")}</div>
        <p className="max-w-xs text-sm text-muted">
          {tr("جميع التنبيهات تم الاطلاع عليها. أي تجاوز جديد للحدود سيظهر هنا فورًا.", "All alerts have been acknowledged. Any new limit breach will appear here immediately.")}
        </p>
      </Card>
    );
  }

  const meta = lang === "en" ? { ...SENSOR_META[sensor.type], ...SENSOR_META_EN[sensor.type] } : SENSOR_META[sensor.type];
  const simulated = sensor.last_data_source === "simulated" || sensor.last_data_source === "test";
  const danger = alert.level === "danger";
  const stale = isStale(sensor.last_seen_at, now);

  return (
    <Card className={clsx("relative flex h-full flex-col overflow-hidden p-5", danger ? "border-danger/35" : "border-warn/30")}>
      <div className={clsx("pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b", danger ? "from-danger/12" : "from-warn/8", "to-transparent")} />
      <div className="relative flex items-center justify-between">
        <div className={clsx("flex items-center gap-2 text-sm font-semibold", danger ? "text-[#ff8a9c]" : "text-warn")}>
          <TriangleAlert className="size-4" /> {tr("التنبيه ذو الأولوية (L0)", "Priority alert (L0)")} <SourceTag source={alert.source} />
          {alert.scenario_id && <span className="num text-[10px] font-normal text-muted">{alert.scenario_id}</span>}
        </div>
        <span className="num rounded-md border border-line-2 px-2 py-0.5 text-xs text-muted">#ALT-{alert.id}</span>
      </div>

      <div className="relative mt-5 flex items-center gap-4">
        <SensorIcon type={sensor.type} status={alert.level} size="lg" />
        <div>
          <h3 className="text-xl font-bold">{meta.hazard}</h3>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5" /> {station.name_ar}{tr("، ", ", ")}{station.city_ar}
          </div>
        </div>
      </div>

      <div className={clsx("relative mt-5 flex items-end justify-between rounded-xl border p-4", danger ? "border-danger/25 bg-danger/8" : "border-warn/25 bg-warn/5")}>
        <div>
          <div className="flex items-center gap-2 text-xs text-muted">{tr("آخر قراءة مستلمة", "Latest reading received")} <SourceTag source={sensor.last_source} /></div>
          <Value
            value={formatValue(sensor.type, sensor.last_value)}
            unit={meta.unitLabel}
            className={clsx("mt-1 text-3xl", sensor.last_status === "danger" ? "text-[#ff8a9c]" : sensor.last_status === "warning" ? "text-warn" : "")}
          />
        </div>
        <StatusBadge status={sensor.last_status} />
      </div>

      <p className="relative mt-4 text-sm leading-7 text-muted">
        {lang === "en" ? (
          <>
            {danger ? "Critical" : "Warning"} level detected at <b className="num text-fg">{formatValue(sensor.type, alert.value)}</b> {meta.unitLabel} (limit{" "}
            <span className="num">{formatValue(sensor.type, alert.threshold)}</span>). Please follow up the monitoring point and verify the field condition.
          </>
        ) : (
          <>
            رُصد مستوى {danger ? "خطر" : "تحذير"} عند{" "}
            <b className="num text-fg">{formatValue(sensor.type, alert.value)}</b> {meta.unitLabel} (الحد{" "}
            <span className="num">{formatValue(sensor.type, alert.threshold)}</span>). يُرجى متابعة نقطة الرصد والتحقق من الحالة ميدانيًا.
          </>
        )}
      </p>

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> <span className="num">{fmtTime(alert.created_at)}</span> · <span suppressHydrationWarning>{timeAgo(alert.created_at, now, lang)}</span></span>
        <span className="flex items-center gap-1.5">
          <span className={clsx("size-1.5 rounded-full", stale ? "bg-unk" : simulated ? "bg-muted" : "animate-pulse bg-brand")} />
          {simulated
            ? stale ? tr("قراءة محاكاة قديمة", "Stale simulated reading") : tr("قراءة محاكاة", "Simulated reading")
            : stale ? tr("قراءة قديمة", "Stale reading") : tr("قراءة حية", "Live reading")}
        </span>
      </div>

      <div className="my-5 h-px bg-line" />
      <ResponsePath acknowledged={!!alert.acknowledged_at} />

      <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await acknowledge(alert.id);
              toast.success(tr("تم تأكيد الاطلاع على التنبيه", "Alert acknowledged"));
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <ShieldCheck className="size-4" /> {tr("تأكيد الاطلاع", "Acknowledge")}
        </Button>
        <Link href={`/sensors/${sensor.code}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line-2 bg-surface-2 px-4 py-2.5 text-sm font-semibold hover:bg-surface-3">
          {tr("عرض التفاصيل", "View details")} <ArrowLeft className="size-4 ltr:rotate-180" />
        </Link>
      </div>
    </Card>
  );
}
