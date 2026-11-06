"use client";
import clsx from "clsx";
import { CloudRain, FileDown, Lock, Mountain, Play, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import { F03 } from "@/engine";
import { post } from "@/lib/client-api";
import { useL, useTr } from "@/lib/i18n";
import { Button, Card, SectionTitle } from "../ui";

interface RunRow { id: number; scenario_id: string; kind: string; status: string; tick: number; length: number; started_by: string; started_at: string }

export function ScenarioSetup() {
  const tr = useTr();
  const L = useL();
  const [kind, setKind] = useState<"scripted" | "parametric">("scripted");
  const [p, setP] = useState({ intensity: 1, rate: 1, seed: 0 });
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<RunRow[]>([]);
  useEffect(() => {
    fetch("/api/runs").then((r) => (r.ok ? r.json() : [])).then(setRuns).catch(() => {});
  }, []);

  const hazards = [
    { id: "flood", icon: CloudRain, label: tr("فيضان / سيل", "Flood / flash flood"), ok: true },
    { id: "eq", icon: Mountain, label: tr("زلزال", "Earthquake"), ok: false, why: tr("غير متاح — غير معتمد للمحاكاة؛ المنصة لا تتنبأ بالزلازل", "Unavailable — not approved; the platform does not predict earthquakes") },
    { id: "dust", icon: Wind, label: tr("عاصفة غبارية", "Dust storm"), ok: false, why: tr("غير متاح — يتطلب قرار اعتماد منفصل", "Unavailable — requires a separate approval decision") },
  ];
  const slider = (k: keyof typeof p, label: string, min: number, max: number, stepv: number, hint: string) => (
    <label className="block text-xs">
      <div className="flex justify-between"><span className="font-semibold">{label}</span><span className="num text-brand">{p[k]}</span></div>
      <input type="range" min={min} max={max} step={stepv} value={p[k]} onChange={(e) => setP({ ...p, [k]: Number(e.target.value) })} className="mt-1 w-full accent-[#34d399]" />
      <div className="text-[11px] text-dim">{hint}</div>
    </label>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <Card className="p-5 xl:col-span-8">
        <SectionTitle title={tr("إعداد السيناريو", "Scenario setup")} sub={tr("كل تشغيل يمر بالسلسلة الكاملة: القراءات ← التحقق ← L0 ← L1 ← المناطق ← الترتيب ← التوصيات ← الخطة.", "Every run goes through the full chain: readings → validation → L0 → L1 → areas → ranking → recommendations → plan.")} />
        <div className="mt-5 text-xs font-semibold text-muted">1 · {tr("نوع الكارثة", "Disaster type")}</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {hazards.map((h) => (
            <div key={h.id} title={h.why} className={clsx("rounded-xl border p-3 text-sm", h.ok ? "border-brand/50 bg-brand/10" : "cursor-not-allowed border-dashed border-line-2 opacity-60")}>
              <div className="flex items-center gap-2 font-semibold"><h.icon className="size-4" /> {h.label}</div>
              {!h.ok && <div className="mt-1 text-[11px] text-muted">{h.why}</div>}
            </div>
          ))}
        </div>
        <div className="mt-5 text-xs font-semibold text-muted">2 · {tr("الموقع الافتراضي", "Virtual location")}</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-brand/50 bg-brand/10 p-3 text-sm">
            <div className="font-semibold">{L(F03.location)}</div>
            <div className="mt-1 text-[11px] text-muted">{tr("8 مناطق افتراضية + شبكة طرق افتراضية", "8 virtual areas + virtual road network")}</div>
          </div>
          <div className="cursor-not-allowed rounded-xl border border-dashed border-line-2 p-3 text-sm opacity-60">
            <div className="font-semibold">{tr("وادي حنيفة، الرياض (WTR-02)", "Wadi Hanifa, Riyadh (WTR-02)")}</div>
            <div className="mt-1 text-[11px] text-muted">{tr("غير متاح — لا توجد بيانات جغرافية افتراضية ولا حساس أمطار", "Unavailable — no virtual geographic data and no rainfall sensor")}</div>
          </div>
        </div>
        <div className="mt-5 text-xs font-semibold text-muted">3 · {tr("نوع السيناريو", "Scenario type")}</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(["scripted", "parametric"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={clsx("rounded-xl border p-3 text-start text-sm", kind === k ? "border-brand/60 bg-brand/10" : "border-line-2 hover:border-dim")}>
              <div className="font-semibold">{k === "scripted" ? `${tr("مُعدّ مسبقًا", "Scripted")} · FLOOD-F03 v${F03.version}` : `${tr("بارامتري", "Parametric")} · FLOOD-PARAM`}</div>
              <div className="mt-1 text-[11px] leading-5 text-muted">
                {k === "scripted"
                  ? tr("32 قراءة معتمدة (T00–T31)، مخرجات متوقعة معروفة مسبقًا، قابلة للتكرار — للاختبار والقبول.", "32 approved readings (T00–T31), expected outputs known in advance, repeatable — for testing and acceptance.")
                  : tr("شكل F-03 مع شدة ومعدل تطور وبذرة ضوضاء — للاستكشاف فقط، ليس دليلًا على الأداء الفعلي.", "F-03 shape with intensity, development rate and noise seed — for exploration only, not evidence of real-world performance.")}
              </div>
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {kind === "parametric" ? (
            <>
              {slider("intensity", tr("الشدة", "Intensity"), 0.5, 2, 0.1, tr("تضاعف الأمطار والارتفاع فوق 22 سم", "Scales rainfall and rise above 22 cm"))}
              {slider("rate", tr("معدل التطور", "Development rate"), 0.5, 2, 0.1, tr(">1 أسرع، <1 أبطأ", ">1 faster, <1 slower"))}
              {slider("seed", tr("بذرة الضوضاء", "Noise seed"), 0, 99, 1, tr("0 = بلا ضوضاء؛ نفس البذرة = نفس النتيجة", "0 = no noise; same seed = same result"))}
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted sm:col-span-3"><Lock className="size-4" /> {tr("معاملات السيناريو المُعدّ مقفلة وفق المواصفة F-03 v0.2.", "Scripted parameters are locked by specification F-03 v0.2.")}</div>
          )}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            {tr("سرعة التشغيل", "Playback speed")}
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded-lg border border-line-2 bg-surface-2 px-2 py-1 text-fg">
              {[0.5, 1, 2, 4, 8].map((s) => <option key={s} value={s}>{s}× {s === 1 ? tr("(دقيقة محاكاة/ثانية)", "(1 sim-min/s)") : ""}</option>)}
            </select>
          </label>
          <Button variant="primary" disabled={busy} onClick={async () => { setBusy(true); await post("/api/scenario", { kind, hazard: "flood", params: p, speed }); setBusy(false); }}>
            <Play className="size-4 rtl:-scale-x-100" /> {tr("بدء السيناريو", "Start scenario")}
          </Button>
          <span className="text-[11px] text-dim">{tr("سيتوقف مولّد البيانات التجريبية أثناء التشغيل (عزل إعادة التشغيل).", "The background data generator pauses during the run (replay isolation).")}</span>
        </div>
      </Card>
      <Card className="p-5 xl:col-span-4">
        <SectionTitle title={tr("التشغيلات السابقة", "Previous runs")} sub={tr("كل تشغيل محفوظ مع أدلته", "Every run is preserved with its evidence")} />
        <ul className="mt-4 space-y-2 text-xs">
          {runs.length === 0 && <li className="text-muted">{tr("لا توجد تشغيلات بعد.", "No runs yet.")}</li>}
          {runs.slice(0, 12).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
              <div>
                <span className="num font-semibold">#{r.id}</span> <span className="num text-muted">{r.scenario_id}</span>
                <div className="text-[11px] text-dim">{r.status} · T{String(Math.max(0, r.tick)).padStart(2, "0")}/{r.length - 1} · {r.started_by}</div>
              </div>
              <span className="flex gap-1">
                <a className="flex items-center gap-1 rounded border border-line-2 px-1.5 py-0.5 text-muted hover:text-fg" href={`/api/scenario/${r.id}/export?format=html`} target="_blank" rel="noreferrer"><FileDown className="size-3" /> HTML</a>
                <a className="rounded border border-line-2 px-1.5 py-0.5 text-muted hover:text-fg" href={`/api/scenario/${r.id}/export?format=json`}>JSON</a>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
