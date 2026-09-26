"use client";
import { useEffect, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtShortTime, fmtTime } from "@/lib/format";
import { SENSOR_META, STATUS_COLOR, formatValue } from "@/lib/sensor-meta";
import { useRasd } from "@/lib/store";
import type { Sensor } from "@/lib/types";

export function TrendChart({ sensor, height = 220 }: { sensor: Sensor; height?: number }) {
  const history = useRasd((s) => s.history[sensor.id]);
  const loadHistory = useRasd((s) => s.loadHistory);
  const threshold = useRasd((s) => s.thresholds.find((t) => t.sensor_type === sensor.type));

  useEffect(() => {
    if (!history) loadHistory(sensor.id);
  }, [sensor.id, history, loadHistory]);

  const data = useMemo(() => (history ?? []).map((r) => ({ t: Date.parse(r.created_at), v: r.value })), [history]);
  const meta = SENSOR_META[sensor.type];
  const color = STATUS_COLOR[sensor.last_status === "unknown" ? "normal" : sensor.last_status];

  const domain = useMemo(() => {
    const vals = data.map((d) => d.v);
    if (threshold?.warning != null) vals.push(threshold.warning);
    if (threshold?.danger != null) vals.push(threshold.danger);
    if (!vals.length) return [0, 1];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;
    return [Math.max(threshold?.min_value ?? -Infinity, lo - pad), hi + pad];
  }, [data, threshold]);

  if (!history) return <div className="animate-pulse rounded-xl bg-surface-2" style={{ height }} />;

  return (
    <div dir="ltr" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id={`g-${sensor.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1a2c31" vertical={false} />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={fmtShortTime} stroke="#5d7571" fontSize={11} tickLine={false} axisLine={false} minTickGap={40} />
          <YAxis domain={domain} stroke="#5d7571" fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => formatValue(sensor.type, v)} />
          {threshold?.warning != null && (
            <ReferenceLine y={threshold.warning} stroke="#fbbf24" strokeDasharray="5 4" strokeOpacity={0.8} label={{ value: "تحذير", fill: "#fbbf24", fontSize: 10, position: "insideTopLeft" }} />
          )}
          {threshold?.danger != null && (
            <ReferenceLine y={threshold.danger} stroke="#f43f5e" strokeDasharray="5 4" strokeOpacity={0.9} label={{ value: "خطر", fill: "#f43f5e", fontSize: 10, position: "insideTopLeft" }} />
          )}
          <Tooltip
            cursor={{ stroke: "#24393f" }}
            contentStyle={{ background: "#0f1e23", border: "1px solid #24393f", borderRadius: 10, fontSize: 12, direction: "rtl" }}
            labelFormatter={(t) => fmtTime(new Date(Number(t)).toISOString())}
            formatter={(v) => [`${formatValue(sensor.type, Number(v))} ${meta.unitLabel}`, meta.label]}
          />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#g-${sensor.id})`} isAnimationActive={false} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: color }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
