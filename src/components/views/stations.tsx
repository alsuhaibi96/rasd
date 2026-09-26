"use client";
import clsx from "clsx";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { KpiRow } from "@/components/shell/kpi-row";
import { PageHeader } from "@/components/shell/page-header";
import { Card, SensorIcon, SourceTag, StatusBadge, Value } from "@/components/ui";
import { bySeverity, indexBy, kpis } from "@/lib/derive";
import { fmtTime, isStale } from "@/lib/format";
import { SENSOR_META, STATUS_LABEL, formatValue } from "@/lib/sensor-meta";
import { useRasd } from "@/lib/store";
import type { Status } from "@/lib/types";
import { useNow } from "@/lib/use-now";

const FILTERS: ("all" | Status)[] = ["all", "danger", "warning", "normal"];

export function StationsView() {
  const sensors = useRasd((s) => s.sensors);
  const stations = useRasd((s) => s.stations);
  const flash = useRasd((s) => s.flash);
  const now = useNow(Date.parse(useRasd.getState().serverTime));
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const stationById = indexBy(stations);
  const k = kpis(sensors, now);
  const list = [...sensors].sort(bySeverity).filter((s) => filter === "all" || s.last_status === filter);

  return (
    <>
      <PageHeader title="نقاط الرصد والحساسات" sub="مصدر كل قراءة وحالتها وآخر تحديث من نقطة الرصد." />
      <KpiRow />
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold">جميع نقاط الرصد</h2>
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "rounded-lg border px-3 py-1.5 text-xs transition",
                filter === f ? "border-brand/40 bg-brand/10 text-brand" : "border-line-2 text-muted hover:text-fg",
              )}
            >
              {f === "all" ? "الكل" : STATUS_LABEL[f]}
            </button>
          ))}
          <span className="ms-2 text-xs text-muted">
            {stations.length} نقطة · <span className="num">{k.deviceOnline}</span> أجهزة فعلية متصلة
          </span>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => {
          const st = stationById.get(s.station_id);
          const meta = SENSOR_META[s.type];
          const stale = isStale(s.last_seen_at, now);
          return (
            <Link key={s.id} href={`/sensors/${s.code}`}>
              <Card
                key={flash[s.id] ?? 0}
                className={clsx(
                  "h-full p-5 transition hover:border-line-2 hover:bg-surface-2",
                  s.last_status === "danger" && "border-danger/40",
                  s.last_status === "warning" && "border-warn/30",
                  flash[s.id] && "animate-flash",
                )}
              >
                <div className="flex items-start justify-between">
                  <SensorIcon type={s.type} status={s.last_status} size="sm" />
                  <StatusBadge status={s.last_status} />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <h3 className="text-lg font-bold">{meta.label}</h3>
                  <SourceTag source={s.last_source} />
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted">
                  <MapPin className="size-3.5" /> {st?.name_ar}، {st?.city_ar}
                </div>
                <Value value={formatValue(s.type, s.last_value)} unit={meta.unitLabel} className="mt-5 text-4xl" />
                <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className={clsx("size-1.5 rounded-full", stale ? "bg-unk" : "bg-brand")} />
                    {stale ? "قراءة قديمة" : "قراءة حية"}
                  </span>
                  <span className="num">{s.code}</span>
                  <span className="num">{fmtTime(s.last_seen_at)}</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
