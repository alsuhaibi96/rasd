import { RealtimeProvider } from "@/components/shell/realtime-provider";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { getSnapshot } from "@/lib/repo";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const [snapshot, user] = await Promise.all([getSnapshot(), currentUser()]);
  return (
    <RealtimeProvider snapshot={snapshot} user={user ?? "operator"}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar />
          <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-7 sm:py-8">{children}</main>
          <footer className="mx-auto flex max-w-[1600px] justify-between gap-4 px-4 pb-6 text-[11px] text-dim sm:px-7">
            <span>رصد / نظام الاستجابة الفورية للكوارث الطبيعية</span>
            <span>نموذج أولي · حدود توضيحية قابلة للضبط</span>
          </footer>
        </div>
      </div>
    </RealtimeProvider>
  );
}
