"use client";
import clsx from "clsx";
import { BadgeCheck, Bell, ClipboardList, Cpu, FlaskConical, LayoutGrid, LogOut, MapPin, ScrollText, ShieldCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { dataSource } from "@/lib/derive";
import { useTr } from "@/lib/i18n";
import { useRasd } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { Logo } from "./logo";

export const NAV = [
  { href: "/", label: "لوحة المراقبة", en: "Dashboard", icon: LayoutGrid, group: "ops" },
  { href: "/stations", label: "نقاط الرصد", en: "Monitoring points", icon: MapPin, count: "stations" as const, group: "ops" },
  { href: "/alerts", label: "التنبيهات", en: "Alerts (L0)", icon: Bell, count: "alerts" as const, group: "ops" },
  { href: "/thresholds", label: "حدود التنبيه", en: "Alert limits", icon: SlidersHorizontal, group: "ops" },
  { href: "/simulation", label: "مركز المحاكاة", en: "Simulation Center", icon: FlaskConical, group: "sim", badge: "run" as const },
  { href: "/plans", label: "خطة الاستجابة", en: "Response plan", icon: ClipboardList, group: "sim" },
  { href: "/events", label: "سجل الأحداث", en: "Event log", icon: ScrollText, group: "sim" },
  { href: "/verification", label: "مركز التحقق", en: "Verification", icon: BadgeCheck, group: "gov" },
  { href: "/system", label: "حالة النظام", en: "System status", icon: Cpu, group: "gov" },
];

export function useNavCounts() {
  const stations = useRasd((s) => s.stations.length);
  const openAlerts = useRasd((s) => s.alerts.filter((a) => !a.acknowledged_at).length);
  return { stations, alerts: openAlerts };
}

const SOURCE_LABEL = { simulator: ["محاكاة", "Simulated"], device: ["أجهزة (غير متحقق منها)", "Devices (unverified)"], mixed: ["أجهزة + محاكاة", "Devices + simulated"] };
const GROUPS = { ops: ["مركز العمليات", "Operations"], sim: ["المحاكاة والقرار", "Simulation & decisions"], gov: ["الحوكمة والتحقق", "Governance"] } as const;

export function logout() {
  fetch("/api/auth/logout", { method: "POST" }).then(() => (window.location.href = "/login"));
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const counts = useNavCounts();
  const connected = useRasd((s) => s.connected);
  const user = useRasd((s) => s.user);
  const sensors = useRasd((s) => s.sensors);
  const now = useNow(Date.parse(useRasd.getState().serverTime));
  const run = useRasd((s) => s.run);
  const tr = useTr();

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-7 pb-6">
        <Logo />
        <p className="mt-4 text-sm leading-6 text-muted">{tr("نظام الاستجابة الفورية", "Rapid Response System")}<br />{tr("للكوارث الطبيعية", "for Natural Disasters")}</p>
      </div>
      <nav className="flex flex-col gap-0.5 overflow-y-auto px-3">
        {NAV.map(({ href, label, en, icon: Icon, count, group, badge }, i) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/stations" && pathname.startsWith("/sensors"));
          const n = count ? counts[count] : 0;
          return (
            <div key={href}>
            {NAV[i - 1]?.group !== group && <div className="px-3 pt-4 pb-1.5 text-[11px] text-dim">{tr(GROUPS[group as keyof typeof GROUPS][0], GROUPS[group as keyof typeof GROUPS][1])}</div>}
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={clsx(
                "relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-[14px] transition",
                active ? "bg-brand/10 font-semibold text-brand" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {active && <span className="absolute inset-y-2 -start-3 w-1 rounded-e-full bg-brand" />}
              <Icon className="size-5" strokeWidth={1.8} />
              <span className="flex-1">{tr(label, en)}</span>
              {badge && run && (
                <span className={clsx("rounded px-1.5 py-px text-[10px] font-bold", run.status === "running" ? "animate-pulse bg-[#7c2d12] text-[#fed7aa]" : "bg-surface-3 text-muted")}>
                  {run.status === "running" ? "SIM" : run.status === "paused" ? "II" : "✓"}
                </span>
              )}
              {count && n > 0 && (
                <span
                  className={clsx(
                    "num grid min-w-6 place-items-center rounded-md px-1.5 py-0.5 text-xs",
                    count === "alerts" ? "bg-danger/20 text-[#ff9aab]" : "bg-surface-3 text-muted",
                  )}
                >
                  {n}
                </span>
              )}
            </Link>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 p-4">
        <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm">
          <div className={clsx("flex items-center gap-2 font-semibold", connected ? "text-brand" : "text-warn")}>
            <span className={clsx("size-2 rounded-full", connected ? "bg-brand shadow-[0_0_8px] shadow-brand" : "animate-pulse bg-warn")} />
            {connected ? tr("الخادم متصل", "Server connected") : tr("جارٍ إعادة الاتصال…", "Reconnecting…")}
          </div>
          <p className="mt-1.5 text-xs text-muted">{tr("تحديث مباشر مع وصول البيانات", "Updates as data arrives")}</p>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
            <span className="text-muted">{tr("مصدر البيانات", "Data source")}</span>
            <span className="font-medium">{run ? tr("سيناريو محاكاة", "Simulated scenario") : tr(...(SOURCE_LABEL[dataSource(sensors, now)] as [string, string]))}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid size-9 place-items-center rounded-full bg-surface-3 text-sm font-bold uppercase">{user.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{user}</div>
            <div className="flex items-center gap-1 text-xs text-muted"><ShieldCheck className="size-3" /> {tr("مشغّل النظام", "Operator")}</div>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-muted hover:bg-surface-3 hover:text-fg" title={tr("تسجيل الخروج", "Sign out")}>
            <LogOut className="size-4 -scale-x-100" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 overflow-y-auto shrink-0 border-e border-line bg-[#091317] lg:block">
      <SidebarContent />
    </aside>
  );
}
