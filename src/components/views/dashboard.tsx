"use client";
import { ArrowLeft, LineChart, Map as MapIcon, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { ReadingsTable } from "@/components/dashboard/readings-table";
import { PriorityAlert } from "@/components/dashboard/priority-alert";
import { ResponseCycle } from "@/components/dashboard/response-cycle";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { SaudiMap } from "@/components/map";
import { KpiRow } from "@/components/shell/kpi-row";
import { PageHeader } from "@/components/shell/page-header";
import { Card, SectionTitle, SourceTag, StatusBadge, Value } from "@/components/ui";
import { indexBy, priorityAlert } from "@/lib/derive";
import { SENSOR_META, formatValue } from "@/lib/sensor-meta";
import { useRasd } from "@/lib/store";

export function DashboardView() {
  const stations = useRasd((s) => s.stations);
  const sensors = useRasd((s) => s.sensors);
  const alerts = useRasd((s) => s.alerts);
  const selectedId = useRasd((s) => s.selectedSensorId);
  const select = useRasd((s) => s.select);

  // Default chart: the sensor behind the priority alert, else the first water-level sensor.
  useEffect(() => {
    if (selectedId != null || !sensors.length) return;
    const a = priorityAlert(alerts);
    select(a?.sensor_id ?? sensors.find((s) => s.type === "water_level")?.id ?? sensors[0].id);
  }, [selectedId, sensors, alerts, select]);

  const sensorById = useMemo(() => indexBy(sensors), [sensors]);
  const sensor = selectedId != null ? sensorById.get(selectedId) : undefined;
  const station = sensor && stations.find((s) => s.id === sensor.station_id);

  return (
    <>
      <PageHeader title="نظرة عامة على الرصد" sub="الصورة الكاملة لنقاط الرصد والتنبيهات، في مكان واحد." />
      <KpiRow />

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="flex flex-col overflow-hidden xl:col-span-8">
          <div className="p-5">
            <SectionTitle
              icon={MapIcon}
              title="خريطة نقاط الرصد"
              sub={`${stations.length} نقطة رصد · ${new Set(stations.map((s) => s.region_code)).size} مناطق · المملكة العربية السعودية`}
              action={
                <Link href="/stations" className="flex items-center gap-1 text-sm text-brand hover:underline">
                  عرض القائمة <ArrowLeft className="size-4" />
                </Link>
              }
            />
          </div>
          <SaudiMap
            className="h-[420px] border-t border-line sm:h-[520px]"
            stations={stations}
            sensors={sensors}
            selectedStationId={sensor?.station_id}
            onSelectStation={(id) => {
              const first = sensors.find((s) => s.station_id === id);
              if (first) select(first.id);
            }}
          />
        </Card>
        <div className="xl:col-span-4">
          <PriorityAlert />
        </div>

        <div className="xl:col-span-8">
          <ReadingsTable limit={7} />
        </div>
        <Card className="p-5 xl:col-span-4">
          {sensor && station ? (
            <>
              <SectionTitle
                icon={LineChart}
                title={`اتجاه ${SENSOR_META[sensor.type].label}`}
                sub={
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3" /> {station.name_ar}، {station.city_ar} <SourceTag source={sensor.last_source} />
                  </span>
                }
                action={
                  <Link href={`/sensors/${sensor.code}`} className="num rounded-md border border-line-2 px-2 py-0.5 text-xs text-muted hover:text-fg">
                    {sensor.code}
                  </Link>
                }
              />
              <div className="my-4 flex items-center justify-between">
                <Value value={formatValue(sensor.type, sensor.last_value)} unit={SENSOR_META[sensor.type].unitLabel} className="text-4xl" />
                <StatusBadge status={sensor.last_status} />
              </div>
              <TrendChart sensor={sensor} height={230} />
              <p className="mt-3 text-center text-[11px] text-dim">اختر حساسًا من الجدول أو الخريطة لعرض اتجاهه</p>
            </>
          ) : (
            <div className="h-72 animate-pulse rounded-xl bg-surface-2" />
          )}
        </Card>

        <div className="xl:col-span-12">
          <ResponseCycle />
        </div>
      </div>
    </>
  );
}
