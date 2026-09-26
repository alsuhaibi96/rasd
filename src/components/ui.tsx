import clsx from "clsx";
import { Activity, Droplet, Droplets, Flame, Gauge, Thermometer, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { SENSOR_META, STATUS_LABEL } from "@/lib/sensor-meta";
import type { SensorType, Source, Status } from "@/lib/types";

export const SENSOR_ICON: Record<SensorType, LucideIcon> = {
  water_level: Droplet,
  smoke_gas: Flame,
  temperature: Thermometer,
  humidity: Droplets,
  pressure: Gauge,
  vibration: Activity,
};

const TONE: Record<Status, string> = {
  normal: "text-ok bg-ok/10 border-ok/25",
  warning: "text-warn bg-warn/10 border-warn/30",
  danger: "text-danger bg-danger/12 border-danger/35",
  unknown: "text-unk bg-unk/10 border-unk/25",
};
const DOT: Record<Status, string> = { normal: "bg-ok", warning: "bg-warn", danger: "bg-danger", unknown: "bg-unk" };

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={clsx("rounded-2xl border border-line bg-surface", className)} {...p} />;
}

export function StatusDot({ status, pulse }: { status: Status; pulse?: boolean }) {
  return (
    <span className="relative inline-flex size-2">
      {pulse && <span className={clsx("absolute inset-0 animate-ping rounded-full opacity-60", DOT[status])} />}
      <span className={clsx("relative inline-flex size-2 rounded-full", DOT[status])} />
    </span>
  );
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium", TONE[status], className)}>
      <StatusDot status={status} pulse={status === "danger"} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function SourceTag({ source }: { source: Source }) {
  return source === "device" ? (
    <span className="rounded border border-brand/40 bg-brand/10 px-1.5 py-px text-[10px] font-medium text-brand">جهاز</span>
  ) : (
    <span className="rounded border border-line-2 bg-surface-3 px-1.5 py-px text-[10px] text-muted">تجريبي</span>
  );
}

export function SensorIcon({ type, status = "unknown", size = "md" }: { type: SensorType; status?: Status; size?: "sm" | "md" | "lg" }) {
  const Icon = SENSOR_ICON[type];
  const box = { sm: "size-8 rounded-lg", md: "size-10 rounded-xl", lg: "size-12 rounded-xl" }[size];
  const tone = status === "unknown" ? "text-muted bg-surface-3 border-line-2" : TONE[status];
  return (
    <span className={clsx("inline-grid shrink-0 place-items-center border", box, tone)} title={SENSOR_META[type].label}>
      <Icon className={size === "lg" ? "size-6" : size === "sm" ? "size-4" : "size-5"} strokeWidth={1.8} />
    </span>
  );
}

export function Button({
  variant = "default",
  className,
  ...p
}: ComponentProps<"button"> & { variant?: "default" | "primary" | "danger" | "ghost" }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-brand text-[#04241a] shadow-[0_0_24px_-6px] shadow-brand/60 hover:bg-[#4ee6ab]",
        variant === "danger" && "border border-danger/40 bg-danger/15 text-[#ff9aab] hover:bg-danger/25",
        variant === "default" && "border border-line-2 bg-surface-2 text-fg hover:border-dim hover:bg-surface-3",
        variant === "ghost" && "text-muted hover:bg-surface-3 hover:text-fg",
        className,
      )}
      {...p}
    />
  );
}

export function SectionTitle({ icon: Icon, title, sub, action }: { icon?: LucideIcon; title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold">
          {Icon && <Icon className="size-5 text-muted" strokeWidth={1.8} />}
          {title}
        </h2>
        {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Value({ value, unit, className, unitClass }: { value: string; unit: string; className?: string; unitClass?: string }) {
  return (
    <span className={clsx("inline-flex items-baseline gap-1.5", className)}>
      <span className="num font-bold tracking-tight">{value}</span>
      <span className={clsx("text-xs font-medium text-muted", unitClass)}>{unit}</span>
    </span>
  );
}
