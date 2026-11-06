"use client";
import clsx from "clsx";
import { BadgeCheck, ChevronDown, Printer, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTr } from "@/lib/i18n";
import type { TestResult, VerificationReport } from "@/lib/verification";
import { PageHeader } from "../shell/page-header";
import { Button, Card, Pill, SectionTitle } from "../ui";

const TONE: Record<string, string> = {
  pass: "bg-ok/15 text-ok border-ok/30",
  fail: "bg-danger/15 text-danger border-danger/30",
  partial: "bg-warn/15 text-warn border-warn/30",
  blocked: "bg-surface-3 text-muted border-line-2",
  not_tested: "bg-transparent text-dim border-line-2 border-dashed",
  verification_pending: "bg-sky-400/10 text-sky-300 border-sky-400/30",
};
const LABEL: Record<string, [string, string]> = {
  pass: ["ناجح", "Pass"], fail: ["فاشل", "Fail"], partial: ["جزئي", "Partial"], blocked: ["محجوب", "Blocked"], not_tested: ["لم يُختبر", "Not Tested"], verification_pending: ["بانتظار التحقق", "Verification Pending"],
};

function Row({ r }: { r: TestResult }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-line bg-surface-2">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-3 py-2 text-start text-xs">
        <span className="num w-14 font-bold">{r.id}</span>
        <span className="flex-1 font-semibold">{r.title}{r.priority && <span className="ms-2 text-[10px] font-normal text-dim">{r.priority}</span>}</span>
        <span className={clsx("rounded border px-2 py-0.5 text-[10px] font-bold", TONE[r.status])}>{tr(...LABEL[r.status])}</span>
        <ChevronDown className={clsx("size-4 text-dim transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-line px-3 py-2 text-xs" dir="ltr">
          <div><span className="text-dim">Expected: </span>{r.expected}</div>
          <div><span className="text-dim">Actual: </span>{r.actual}</div>
          {r.notes && <div className="text-warn">{r.notes}</div>}
          {Object.keys(r.evidence).length > 0 && <pre className="max-h-48 overflow-auto rounded bg-black/30 p-2 text-[10px] text-muted">{JSON.stringify(r.evidence, null, 1)}</pre>}
        </div>
      )}
    </li>
  );
}

function ManualRecord({ onSaved }: { onSaved: () => void }) {
  const tr = useTr();
  const [test, setTest] = useState("TC-11a");
  const [status, setStatus] = useState("pass");
  const [notes, setNotes] = useState("");
  const [comp, setComp] = useState({ login: "", fonts: "", map: "", realtime: "" });
  const save = async () => {
    const res = await fetch("/api/verification/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ test_id: test, status, notes, components: test === "TC-11b" ? comp : {} }) });
    if (res.ok) { toast.success(tr("سُجّلت النتيجة", "Result recorded")); setNotes(""); onSaved(); } else toast.error((await res.json()).error);
  };
  return (
    <Card className="p-5">
      <SectionTitle title={tr("تسجيل اختبار يدوي (دون اتصال)", "Record a manual test (offline)")} sub={tr("لا يُدّعى العمل دون اتصال إلا من تشغيل مسجّل. افصل الشبكة، شغّل F-03، ثم سجّل النتيجة لكل مكوّن.", "Offline is only claimed from a recorded run. Disable the network, run F-03, then record the result per component.")} />
      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
        <select value={test} onChange={(e) => setTest(e.target.value)} className="rounded-lg border border-line-2 bg-surface-2 px-2 py-1.5">
          <option value="TC-11a">TC-11a · Offline core replay</option><option value="TC-11b">TC-11b · Offline login & map</option><option value="AT-24">AT-24 · Offline test</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-line-2 bg-surface-2 px-2 py-1.5">
          {Object.keys(LABEL).map((k) => <option key={k} value={k}>{tr(...LABEL[k])}</option>)}
        </select>
        <Button onClick={save}>{tr("حفظ", "Save")}</Button>
        {test === "TC-11b" && (Object.keys(comp) as (keyof typeof comp)[]).map((k) => (
          <label key={k} className="flex items-center gap-2">{k}
            <select value={comp[k]} onChange={(e) => setComp({ ...comp, [k]: e.target.value })} className="flex-1 rounded-lg border border-line-2 bg-surface-2 px-2 py-1"><option value="">—</option><option>pass</option><option>fail</option><option>partial</option></select>
          </label>
        ))}
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tr("ملاحظات: الخطوات، ما الذي عمل، ما الذي احتاج الإنترنت", "Notes: steps, what worked, what needed internet")} className="rounded-lg border border-line-2 bg-surface-2 px-2 py-1.5 sm:col-span-3" rows={2} />
      </div>
    </Card>
  );
}

export function VerificationView() {
  const tr = useTr();
  const [rep, setRep] = useState<VerificationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    const r = await fetch("/api/verification");
    if (r.ok) setRep(await r.json());
    setBusy(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const count = (g: string, s: string) => rep?.results.filter((r) => r.group === g && r.status === s).length ?? 0;
  return (
    <>
      <PageHeader title={tr("مركز التحقق والقبول", "Verification & acceptance center")} sub={tr("يشغّل اختبارات F-03 (TC-01…TC-17) واختبارات القبول (AT-01…AT-25) على المحرك وعلى التشغيلات المحفوظة. لا تُعلَّم أي ميزة غير منفذة كناجحة.", "Runs F-03 tests (TC-01…TC-17) and acceptance tests (AT-01…AT-25) against the engine and the persisted runs. Nothing unimplemented is marked Pass.")} />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={load} disabled={busy}><RefreshCw className={clsx("size-4", busy && "animate-spin")} /> {tr("تشغيل كل الاختبارات", "Run all tests")}</Button>
        <Button onClick={() => window.print()}><Printer className="size-4" /> {tr("طباعة الأدلة", "Print evidence")}</Button>
        {rep && (
          <>
            <span className={clsx("rounded-lg border px-3 py-1.5 text-sm font-bold", rep.verdict === "pass" ? TONE.pass : rep.verdict === "fail" ? TONE.fail : TONE.partial)}>
              {tr("حكم السيناريو", "Scenario verdict")}: {rep.verdict === "pass" ? tr("ناجح", "Pass") : rep.verdict === "fail" ? tr("فاشل", "Fail") : tr("غير حاسم", "Inconclusive")}
            </span>
            <Pill>{tr("التشغيل", "Run")} #{rep.run ?? "—"} {rep.previous_run ? `· ${tr("مقارنة مع", "vs")} #${rep.previous_run}` : ""}</Pill>
            <Pill>engine {rep.engine_version}</Pill>
          </>
        )}
      </div>
      {rep && (
        <>
          <p className="mt-3 text-xs text-muted">{rep.verdict !== "pass" && tr("الحكم ناجح فقط إذا نجحت كل حالات P0. اختبارات العمل دون اتصال تتطلب تسجيلًا يدويًا.", "The verdict is Pass only if every P0 case passes. Offline tests require a manual record.")} {rep.disclaimer}</p>
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            {(["F-03", "AT"] as const).map((g) => (
              <Card key={g} className="p-5">
                <SectionTitle icon={BadgeCheck} title={g === "F-03" ? tr("اختبارات السيناريو F-03 (القسم 10)", "Scenario F-03 tests (Section 10)") : tr("اختبارات القبول (المواصفة §19.3)", "Acceptance tests (spec §19.3)")} sub={`${count(g, "pass")} pass · ${count(g, "partial")} partial · ${count(g, "fail")} fail · ${count(g, "not_tested")} not tested`} />
                <ul className="mt-4 space-y-1.5">{rep.results.filter((r) => r.group === g).map((r) => <Row key={r.id} r={r} />)}</ul>
              </Card>
            ))}
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <Card className="p-5">
              <SectionTitle title={tr("القبول الشامل (§19.4)", "End-to-end acceptance (§19.4)")} sub={tr(`مخرجات كل مرحلة في التشغيل #${rep.run ?? "—"}`, `Outputs of each stage in run #${rep.run ?? "—"}`)} />
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {rep.e2e.map((s) => (
                  <div key={s.stage} className={clsx("rounded-lg border p-2", s.n > 0 ? "border-ok/30" : "border-danger/30")}>
                    <div className="text-dim">{s.stage}</div><div className="num text-lg font-bold">{s.n}</div>
                  </div>
                ))}
                {!rep.e2e.length && <p className="col-span-4 text-muted">{tr("لا يوجد تشغيل F-03 مكتمل بعد.", "No completed F-03 run yet.")}</p>}
              </div>
            </Card>
            <ManualRecord onSaved={load} />
          </div>
        </>
      )}
    </>
  );
}
