"use client";
import clsx from "clsx";
import { Activity, CloudRain, Droplet, Droplets, Flame, Gauge, Thermometer, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useTr } from "@/lib/i18n";
import { SENSOR_META, STATUS_LABEL, STATUS_LABEL_EN } from "@/lib/sensor-meta";
import type { DataSource, SensorType, Source, Status } from "@/lib/types";

export const SENSOR_ICON: Record<SensorType, LucideIcon> = {
  water_level: Droplet,
  smoke_gas: Flame,
  temperature: Thermometer,
  humidity: Droplets,
  pressure: Gauge,
  vibration: Activity,
  rainfall: CloudRain,
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
      <StatusText status={status} />
    </span>
  );
}

function StatusText({ status }: { status: Status }) {
  const tr = useTr();
  return <>{tr(STATUS_LABEL[status], STATUS_LABEL_EN[status])}</>;
}

/** Spec §4.3 classification. Accepts the legacy device/simulator source too. */
export function SourceTag({ source }: { source: Source | DataSource }) {
  const tr = useTr();
  const ds: DataSource = source === "device" ? "external" : source === "simulator" ? "simulated" : source;
  const label = { real: tr("حقيقي", "Real"), simulated: tr("محاكاة", "Simulated"), test: tr("اختبار", "Test"), external: tr("خارجي · غير متحقق", "External · unverified") }[ds];
  const tone = {
    real: "border-brand/40 bg-brand/10 text-brand",
    simulated: "border-[#c2410c]/50 bg-[#7c2d12]/30 text-[#fdba74]",
    test: "border-line-2 bg-surface-3 text-muted",
    external: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  }[ds];
  return <span className={clsx("rounded border px-1.5 py-px text-[10px] font-medium", tone)}>{label}</span>;
}

/* ---------- L1 risk (separate vocabulary and visual from L0 alert status) ---------- */
export type RiskKey = "low" | "moderate" | "elevated" | "severe" | "no_data" | "unaffected" | null;
export const RISK_COLOR: Record<string, string> = {
  low: "#34d399",
  moderate: "#fbbf24",
  elevated: "#fb923c", // intermediate amber
  severe: "#f43f5e",
  no_data: "#5d7571",
  unaffected: "#24393f",
};
const RISK_STEPS = ["low", "moderate", "elevated", "severe"] as const;
export function riskLabel(r: RiskKey, tr: (a: string, e: string) => string) {
  if (r == null) return tr("غير متاح", "Unavailable");
  return {
    low: tr("منخفض", "Low"),
    moderate: tr("متوسط", "Moderate"),
    elevated: tr("مرتفع", "Elevated"),
    severe: tr("شديد", "Severe"),
    no_data: tr("لا توجد بيانات", "No Data"),
    unaffected: tr("غير متأثرة", "Unaffected"),
  }[r];
}

/** 4-step level indicator (F-03 §0: risk uses a stepped bar, alert status uses a pill). */
export function RiskLevel({ risk, size = "md", note }: { risk: RiskKey; size?: "sm" | "md" | "lg"; note?: string }) {
  const tr = useTr();
  const idx = risk ? RISK_STEPS.indexOf(risk as (typeof RISK_STEPS)[number]) : -1;
  const h = { sm: "h-1.5 w-4", md: "h-2 w-6", lg: "h-2.5 w-9" }[size];
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex gap-0.5" dir="ltr" aria-hidden>
        {RISK_STEPS.map((s, i) => (
          <span key={s} className={clsx("rounded-sm", h)} style={{ background: i <= idx ? RISK_COLOR[risk!] : "var(--color-surface-3)" }} />
        ))}
      </span>
      <span className={clsx("font-semibold", size === "lg" ? "text-xl" : size === "sm" ? "text-xs" : "text-sm")} style={{ color: idx >= 0 ? RISK_COLOR[risk!] : "var(--color-muted)" }}>
        {riskLabel(risk, tr)}
      </span>
      {note && <span className="text-[11px] text-muted">({note})</span>}
    </span>
  );
}

export function RiskChip({ risk, className }: { risk: RiskKey; className?: string }) {
  const tr = useTr();
  const c = risk ? RISK_COLOR[risk] : RISK_COLOR.no_data;
  const dashed = risk === "no_data" || risk == null;
  return (
    <span
      className={clsx("inline-flex items-center gap-1 rounded px-1.5 py-px text-[11px] font-semibold", dashed && "border border-dashed", className)}
      style={{ color: risk === "unaffected" ? "var(--color-dim)" : c, background: dashed || risk === "unaffected" ? "transparent" : c + "1f", borderColor: dashed ? c : undefined }}
    >
      {riskLabel(risk, tr)}
    </span>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 rounded-md border border-line-2 bg-surface-2 px-2 py-0.5 text-[11px] text-muted", className)}>{children}</span>;
}

/** Module/runtime state used across the chain and system pages (spec §15.2). */
export type ModuleState = "operational" | "simulated" | "proposed" | "unavailable" | "not_configured" | "idle" | "error";
export function StateTag({ state }: { state: ModuleState }) {
  const tr = useTr();
  const m = {
    operational: [tr("يعمل", "Operational"), "border-ok/30 bg-ok/10 text-ok"],
    simulated: [tr("محاكاة", "Simulated"), "border-[#c2410c]/50 bg-[#7c2d12]/30 text-[#fdba74]"],
    proposed: [tr("مقترح", "Proposed"), "border-line-2 bg-surface-3 text-muted"],
    unavailable: [tr("غير متاح", "Unavailable"), "border-line-2 bg-transparent text-dim"],
    not_configured: [tr("غير مُهيأ", "Not Configured"), "border-line-2 bg-transparent text-dim"],
    idle: [tr("بانتظار بيانات", "Idle"), "border-line-2 bg-surface-2 text-muted"],
    error: [tr("خطأ", "Error"), "border-danger/40 bg-danger/10 text-danger"],
  }[state];
  return <span className={clsx("rounded border px-1.5 py-px text-[10px] font-semibold", m[1])}>{m[0]}</span>;
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
