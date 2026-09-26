"use client";
import clsx from "clsx";
import { Bell, LayoutGrid, LogOut, MapPin, ShieldCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { dataSource } from "@/lib/derive";
import { useRasd } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { Logo } from "./logo";

export const NAV = [
  { href: "/", label: "لوحة المراقبة", icon: LayoutGrid },
  { href: "/stations", label: "نقاط الرصد", icon: MapPin, count: "stations" as const },
  { href: "/alerts", label: "التنبيهات", icon: Bell, count: "alerts" as const },
  { href: "/thresholds", label: "حدود الخطورة", icon: SlidersHorizontal },
];

export function useNavCounts() {
  const stations = useRasd((s) => s.stations.length);
  const openAlerts = useRasd((s) => s.alerts.filter((a) => !a.acknowledged_at).length);
  return { stations, alerts: openAlerts };
}

const SOURCE_LABEL = { simulator: "محاكاة", device: "أجهزة فعلية", mixed: "أجهزة + محاكاة" };

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

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-7 pb-6">
        <Logo />
        <p className="mt-4 text-sm leading-6 text-muted">نظام الاستجابة الفورية<br />للكوارث الطبيعية</p>
      </div>
      <div className="px-6 pb-2 text-xs text-dim">مركز العمليات</div>
      <nav className="flex flex-col gap-1 px-3">
        {NAV.map(({ href, label, icon: Icon, count }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/stations" && pathname.startsWith("/sensors"));
          const n = count ? counts[count] : 0;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={clsx(
                "relative flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] transition",
                active ? "bg-brand/10 font-semibold text-brand" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {active && <span className="absolute inset-y-2 -start-3 w-1 rounded-e-full bg-brand" />}
              <Icon className="size-5" strokeWidth={1.8} />
              <span className="flex-1">{label}</span>
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
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 p-4">
        <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm">
          <div className={clsx("flex items-center gap-2 font-semibold", connected ? "text-brand" : "text-warn")}>
            <span className={clsx("size-2 rounded-full", connected ? "bg-brand shadow-[0_0_8px] shadow-brand" : "animate-pulse bg-warn")} />
            {connected ? "الخادم متصل" : "جارٍ إعادة الاتصال…"}
          </div>
          <p className="mt-1.5 text-xs text-muted">تحديث مباشر مع وصول البيانات</p>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
            <span className="text-muted">مصدر البيانات</span>
            <span className="font-medium">{SOURCE_LABEL[dataSource(sensors, now)]}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid size-9 place-items-center rounded-full bg-surface-3 text-sm font-bold uppercase">{user.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{user}</div>
            <div className="flex items-center gap-1 text-xs text-muted"><ShieldCheck className="size-3" /> مشغّل النظام</div>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-muted hover:bg-surface-3 hover:text-fg" title="تسجيل الخروج">
            <LogOut className="size-4 -scale-x-100" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 border-e border-line bg-[#091317] lg:block">
      <SidebarContent />
    </aside>
  );
}
