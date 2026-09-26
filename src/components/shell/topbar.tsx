"use client";
import { Bell, LayoutGrid, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { dataSource } from "@/lib/derive";
import { useRasd } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { NAV, SidebarContent, logout, useNavCounts } from "./sidebar";

export function Topbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { alerts } = useNavCounts();
  const sensors = useRasd((s) => s.sensors);
  const now = useNow(Date.parse(useRasd.getState().serverTime));
  const src = dataSource(sensors, now);
  const current =
    NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)))?.label ??
    (pathname.startsWith("/sensors") ? "تفاصيل الحساس" : "");

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-md sm:px-7">
        <button className="rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden" onClick={() => setOpen(true)} aria-label="القائمة">
          <Menu className="size-5" />
        </button>
        <nav className="flex min-w-0 items-center gap-2 text-sm">
          <LayoutGrid className="hidden size-5 text-muted sm:block" strokeWidth={1.8} />
          <span className="hidden text-muted sm:inline">مركز العمليات</span>
          <span className="hidden text-dim sm:inline">/</span>
          <span className="truncate font-semibold">{current}</span>
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <span
            className={
              src === "simulator"
                ? "rounded-lg border border-line-2 bg-surface-2 px-2.5 py-1 text-xs text-muted"
                : "rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs text-brand"
            }
          >
            {src === "simulator" ? "بيانات تجريبية" : "بيانات حية"}
          </span>
          <Link href="/alerts" className="relative rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="التنبيهات">
            <Bell className="size-5" strokeWidth={1.8} />
            {alerts > 0 && <span className="absolute top-1.5 end-1.5 size-2 rounded-full bg-danger ring-2 ring-bg" />}
          </Link>
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
          <button onClick={logout} className="hidden rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg sm:block" title="تسجيل الخروج">
            <LogOut className="size-5 -scale-x-100" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-72 border-e border-line bg-[#091317]">
            <button className="absolute top-5 end-4 rounded-lg p-2 text-muted" onClick={() => setOpen(false)} aria-label="إغلاق">
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
