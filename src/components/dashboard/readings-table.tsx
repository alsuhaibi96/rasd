"use client";
import clsx from "clsx";
import { ArrowLeft, Radio } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bySeverity, indexBy } from "@/lib/derive";
import { fmtTime, isStale, timeAgo } from "@/lib/format";
import { SENSOR_META, formatValue } from "@/lib/sensor-meta";
import { useRasd } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { Card, SectionTitle, SensorIcon, SourceTag, StatusBadge, Value } from "../ui";

export function ReadingsTable({ limit }: { limit?: number }) {
  const router = useRouter();
  const sensors = useRasd((s) => s.sensors);
  const stations = useRasd((s) => s.stations);
  const flash = useRasd((s) => s.flash);
  const selected = useRasd((s) => s.selectedSensorId);
  const select = useRasd((s) => s.select);
  const now = useNow(Date.parse(useRasd.getState().serverTime));
  const stationById = indexBy(stations);
  const rows = [...sensors].sort(bySeverity).slice(0, limit);

  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-4">
        <SectionTitle
          icon={Radio}
          title="قراءات الحساسات"
          sub={`${sensors.length} حساس · مرتبة حسب الخطورة`}
          action={
            limit ? (
              <Link href="/stations" className="flex items-center gap-1 text-sm text-brand hover:underline">
                عرض الكل <ArrowLeft className="size-4" />
              </Link>
            ) : null
          }
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-y border-line bg-surface-2/50 text-xs text-muted">
              <th className="px-5 py-3 text-start font-medium">الحساس / المصدر</th>
              <th className="px-3 py-3 text-start font-medium">نقطة الرصد</th>
              <th className="px-3 py-3 text-start font-medium">القراءة</th>
              <th className="px-3 py-3 text-start font-medium">الحالة</th>
              <th className="px-5 py-3 text-start font-medium">آخر تحديث</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const st = stationById.get(s.station_id);
              const meta = SENSOR_META[s.type];
              const stale = isStale(s.last_seen_at, now);
              return (
                <tr
                  key={`${s.id}-${flash[s.id] ?? 0}`}
                  onClick={() => (limit ? select(s.id) : router.push(`/sensors/${s.code}`))}
                  className={clsx(
                    "cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-surface-2",
                    flash[s.id] && "animate-flash",
                    selected === s.id && limit && "bg-surface-2",
                  )}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <SensorIcon type={s.type} status={s.last_status} size="sm" />
                      <div>
                        <div className="font-semibold">{meta.label}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-dim">
                          <span className="num">{s.code}</span> <SourceTag source={s.last_source} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <div>{st?.name_ar}</div>
                    <div className="text-xs text-muted">{st?.city_ar}</div>
                  </td>
                  <td className="px-3 py-3.5">
                    <Value value={formatValue(s.type, s.last_value)} unit={meta.unitLabel} className="text-lg" />
                  </td>
                  <td className="px-3 py-3.5">
                    <StatusBadge status={s.last_status} />
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-dim">
                      <span className={clsx("size-1 rounded-full", stale ? "bg-unk" : "bg-brand")} />
                      {stale ? "قراءة قديمة" : "قراءة حية"}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted">
                    <div className="num">{fmtTime(s.last_seen_at)}</div>
                    <div className="mt-0.5 text-dim" suppressHydrationWarning>{timeAgo(s.last_seen_at, now)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
