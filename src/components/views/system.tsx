"use client";
import clsx from "clsx";
import { Cpu, ListChecks, Server } from "lucide-react";
import { ENGINE_VERSION, L1_PARAMS, RULESET, WHATIF_PARAMS } from "@/engine";
import { FEATURES, STACK } from "@/lib/audit";
import { useL, useTr } from "@/lib/i18n";
import { useSystemStatus } from "@/lib/use-system";
import { PageHeader } from "../shell/page-header";
import { Card, type ModuleState, SectionTitle, StateTag } from "../ui";

const FS: Record<string, [string, string, string]> = {
  verified: ["موجودة ومتحقق منها", "Existing and Verified", "text-ok"],
  enhanced: ["موجودة – تم تحسينها", "Existing – Enhanced", "text-ok"],
  implemented: ["منفذة ومختبرة", "Implemented & tested", "text-brand"],
  partial: ["منفذة جزئيًا", "Partially Implemented", "text-warn"],
  pending: ["بانتظار التحقق", "Verification Pending", "text-sky-300"],
  future: ["مقترحة / مستقبلية", "Proposed / Future", "text-dim"],
};

export function SystemView() {
  const tr = useTr();
  const L = useL();
  const { status, error } = useSystemStatus(5000);
  const mod = (name: string, state: ModuleState, detail: string) => ({ name, state, detail });
  const run = status?.run;
  const modules = status
    ? [
        mod(tr("قاعدة البيانات", "Database"), status.db === "available" ? "operational" : "error", "PostgreSQL"),
        mod(tr("مولّد البيانات التجريبية", "Background generator"), status.generator === "running" ? "simulated" : "idle", status.generator),
        mod(tr("محرك إعادة التشغيل", "Replay engine"), run ? "simulated" : "idle", run ? `#${run.id} ${run.scenario} ${run.status} T${run.tick}` : tr("لا يوجد تشغيل", "no active run")),
        mod("L0", "operational", tr("حدود 60/80 سم من إعدادات الموقع", "60/80 cm website configuration limits")),
        mod("L1", run ? "operational" : "idle", RULESET.l1),
        mod("AI", status.ai.state === "not_configured" ? "not_configured" : status.ai.state === "ready" || status.ai.state === "running" ? "operational" : "unavailable", status.ai.detail),
        mod(tr("المحرك الجغرافي", "Geospatial engine"), run ? "operational" : "idle", `${RULESET.area} · ${tr("بيانات افتراضية", "virtual data")}`),
        mod(tr("دعم القرار", "Decision support"), run ? "operational" : "idle", RULESET.decide),
        mod(tr("خطة الاستجابة", "Response planning"), run ? "operational" : "idle", RULESET.plan),
        mod(tr("المسارات الافتراضية", "Virtual routes"), run ? "simulated" : "idle", RULESET.route),
        mod(tr("إسقاط ماذا لو", "What-if projection"), run ? "simulated" : "idle", `${RULESET.whatif} · ${tr("فيضانات فقط", "flood only")}`),
        mod(tr("حساسات حقيقية", "Real sensors"), status.real_devices_online ? "operational" : "unavailable", `${status.real_devices_online} ${tr("متصلة (مصدر خارجي غير متحقق منه)", "online (external, unverified)")}`),
      ]
    : [];
  return (
    <>
      <PageHeader title={tr("حالة النظام والتدقيق التقني", "System status & technical audit")} sub={tr("كل حالة هنا محسوبة من وقت التشغيل الفعلي — لا توجد تسميات ثابتة.", "Every status here is computed from the actual runtime — no static labels.")} />
      <div className="mt-6 grid gap-5 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-7">
          <SectionTitle icon={Cpu} title={tr("مصفوفة القدرات المباشرة", "Live capability matrix")} sub={error ? tr("تعذر جلب الحالة", "Could not load status") : `${tr("محدّث", "Updated")} ${status ? new Date(status.server_time).toLocaleTimeString("en-GB") : "…"}`} />
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {modules.map((m) => (
              <li key={m.name} className="flex items-start justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs">
                <div><div className="font-semibold">{m.name}</div><div className="mt-0.5 text-[11px] text-muted">{m.detail}</div></div>
                <StateTag state={m.state} />
              </li>
            ))}
          </ul>
          <div className="mt-5 grid gap-2 text-[11px] text-muted sm:grid-cols-2">
            <div className="rounded-lg border border-line p-3">
              <div className="mb-1 font-semibold text-fg">{tr("تصنيف مصدر البيانات (§4.3)", "Data source classification (§4.3)")}</div>
              <div><b>real</b> — {tr("مصدر حقيقي متحقق منه (لا يوجد حاليًا)", "verified real source (none yet)")}</div>
              <div><b>simulated</b> — {tr("بيانات مولّدة للمحاكاة", "generated for simulation")}</div>
              <div><b>test</b> — {tr("بيانات اختبار برمجي", "software testing data")}</div>
              <div><b>external</b> — {tr("أجهزة ESP32 قبل التحقق من صحتها التشغيلية", "ESP32 devices before operational verification")}</div>
            </div>
            <div className="rounded-lg border border-line p-3">
              <div className="mb-1 font-semibold text-fg">{tr("الاعتماد على الشبكة (دون اتصال)", "Network dependencies (offline)")}</div>
              <div>{tr("الخطوط: مضمّنة وقت البناء", "Fonts: self-hosted at build time")}</div>
              <div>{tr("الخرائط: GeoJSON محلي، بلا خادم بلاطات", "Maps: local GeoJSON, no tile server")}</div>
              <div>{tr("لا توجد واجهات برمجة خارجية", "No external APIs")}</div>
              <div className="text-warn">{tr("يتطلب خادم التطبيق وقاعدة البيانات (محليًا أو على الشبكة)", "Requires the app server + database (local or networked)")}</div>
            </div>
          </div>
        </Card>
        <Card className="p-5 xl:col-span-5">
          <SectionTitle icon={Server} title={tr("التقنيات المستخدمة", "Technologies in use")} sub={`engine ${ENGINE_VERSION}`} />
          <dl className="mt-4 space-y-2 text-xs" dir="ltr">
            {STACK.map(([k, v]) => <div key={k}><dt className="font-semibold">{k}</dt><dd className="text-muted">{v}</dd></div>)}
          </dl>
          <div className="mt-4 rounded-lg border border-line p-3 text-[11px] text-muted" dir="ltr">
            <div className="mb-1 font-semibold text-fg">Parameter registry (Proposed, illustrative — not validated)</div>
            <div>L1: baseline {L1_PARAMS.baselineMin}–{L1_PARAMS.baselineMax} cm · RF R10 ≥ {L1_PARAMS.rfMinR10} mm · LR rise₃ ≥ {L1_PARAMS.lrMinRise} cm · Severe rise₃ ≥ {L1_PARAMS.severeRise} & level ≥ {L1_PARAMS.severeLevel}</div>
            <div>L0: 60 / 80 cm — website configuration value (verified in code), not a hydrological threshold</div>
            <div>What-if: RESPONSE {WHATIF_PARAMS.RESPONSE}, STEADY_RAIN {WHATIF_PARAMS.STEADY_RAIN}</div>
            <div>{Object.values(RULESET).join(" · ")}</div>
          </div>
        </Card>
        <Card className="p-5 xl:col-span-12">
          <SectionTitle icon={ListChecks} title={tr("جرد الميزات والمطابقة (§2.2–2.3)", "Feature inventory & reconciliation (§2.2–2.3)")} sub={tr("الحالة عند التدقيق ← الإجراء ← الحالة الآن", "State at audit → action → status now")} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-xs">
              <thead className="text-muted"><tr className="border-b border-line">{[tr("الميزة", "Feature"), tr("الموقع", "Where"), tr("عند التدقيق", "Found in audit"), tr("الإجراء", "Action"), tr("الحالة", "Status"), tr("ملاحظات", "Notes")].map((h) => <th key={h} className="px-2 py-2 text-start font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {FEATURES.map((f) => (
                  <tr key={f.name.en} className="border-b border-line/50 align-top">
                    <td className="px-2 py-2 font-semibold">{L(f.name)}</td>
                    <td className="num px-2 py-2 text-muted">{f.where}</td>
                    <td className="px-2 py-2 text-muted" dir="ltr">{f.before}</td>
                    <td className="px-2 py-2">{f.action}</td>
                    <td className={clsx("px-2 py-2 font-semibold", FS[f.status][2])}>{tr(FS[f.status][0], FS[f.status][1])}</td>
                    <td className="px-2 py-2 text-muted" dir="ltr">{f.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
