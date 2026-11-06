import { EvidenceDrawer } from "@/components/evidence/drawer";
import { RealtimeProvider } from "@/components/shell/realtime-provider";
import { Sidebar } from "@/components/shell/sidebar";
import { SimulatedBanner } from "@/components/shell/simulated-banner";
import { Topbar } from "@/components/shell/topbar";
import { getLang } from "@/lib/lang-server";
import { getSnapshot } from "@/lib/repo";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const [snapshot, user, lang] = await Promise.all([getSnapshot(), currentUser(), getLang()]);
  const ar = lang === "ar";
  return (
    <RealtimeProvider snapshot={snapshot} user={user ?? "operator"} lang={lang}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar />
          <SimulatedBanner />
          <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-7 sm:py-8">{children}</main>
          <footer className="mx-auto flex max-w-[1600px] flex-wrap justify-between gap-4 px-4 pb-6 text-[11px] text-dim sm:px-7">
            <span>{ar ? "رصد / نظام الاستجابة الفورية للكوارث الطبيعية" : "RASD / Rapid Response System for Natural Disasters"}</span>
            <span>{ar ? "نموذج أولي · لا توجد بيانات حساسات حقيقية متصلة · المعاملات توضيحية وغير معتمدة هيدرولوجيًا" : "Prototype · no verified real sensor data connected · parameters are illustrative, not hydrologically validated"}</span>
          </footer>
        </div>
      </div>
      <EvidenceDrawer />
    </RealtimeProvider>
  );
}
