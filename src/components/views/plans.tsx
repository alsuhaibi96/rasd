"use client";
import clsx from "clsx";
import { ClipboardList, GitCompare } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ADIREA_AREAS, CATALOG, type PlanVersion } from "@/engine";
import { useL, useTr } from "@/lib/i18n";
import { useRasd } from "@/lib/store";
import { PageHeader } from "../shell/page-header";
import { Card, Pill, RiskChip, type RiskKey, SectionTitle } from "../ui";

type Row = PlanVersion & { created_at: string };
const T = (t: number) => `T${String(t).padStart(2, "0")}`;
const KIND = { added: ["+", "text-ok", "border-ok/30 bg-ok/5"], withdrawn: ["−", "text-danger", "border-danger/30 bg-danger/5"], priority: ["⇅", "text-warn", "border-warn/30 bg-warn/5"], risk: ["◆", "text-[#fdba74]", "border-[#fb923c]/30 bg-[#fb923c]/5"], route: ["↝", "text-sky-300", "border-sky-400/30 bg-sky-400/5"] } as const;

export function PlansView() {
  const run = useRasd((s) => s.run);
  const tr = useTr();
  const L = useL();
  const [runId, setRunId] = useState<number | null>(run?.run_id ?? null);
  const [runs, setRuns] = useState<{ id: number; scenario_id: string; status: string }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const area = (id: string | null) => (id ? L(ADIREA_AREAS.find((a) => a.id === id)?.name) || id : "");
  const planCount = run?.plan_count;

  useEffect(() => {
    fetch("/api/runs").then((r) => (r.ok ? r.json() : [])).then((rs) => {
      setRuns(rs);
      setRunId((cur) => cur ?? rs[0]?.id ?? null);
    });
  }, []);
  useEffect(() => {
    if (!runId) return;
    fetch(`/api/plans?run=${runId}`).then((r) => (r.ok ? r.json() : [])).then((d: Row[]) => {
      setRows(d);
      setSel((s) => (s && s <= d.length ? s : d.at(-1)?.version ?? null));
    });
  }, [runId, planCount]);

  const cur = rows.find((r) => r.version === sel);
  const prev = rows.find((r) => r.version === (sel ?? 0) - 1);
  return (
    <>
      <PageHeader title={tr("خطة الاستجابة الديناميكية", "Dynamic response plan")} sub={tr("كل إصدار محفوظ؛ ما الذي تغيّر ولماذا ومتى — مع فصل المقترح عن المعتمد.", "Every version preserved: what changed, why and when — with proposed kept apart from approved.")} />
      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-muted">{tr("التشغيل", "Run")}
          <select value={runId ?? ""} onChange={(e) => { setRunId(Number(e.target.value)); setSel(null); }} className="rounded-lg border border-line-2 bg-surface-2 px-2 py-1 text-fg">
            {runs.map((r) => <option key={r.id} value={r.id}>#{r.id} · {r.scenario_id} · {r.status}</option>)}
          </select>
        </label>
        <Pill className="border-[#c2410c]/50 text-[#fdba74]">SIMULATED SCENARIO – NOT LIVE DATA</Pill>
        {run && run.run_id === runId && <Link href="/simulation" className="text-xs text-brand hover:underline">{tr("الاعتماد يتم من مركز المحاكاة", "Approvals happen in the Simulation Center")}</Link>}
      </div>
      {!rows.length ? (
        <Card className="mt-5 p-8 text-center text-sm text-muted">{tr("لا توجد إصدارات خطة لهذا التشغيل.", "No plan versions for this run.")}</Card>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-12">
          <Card className="p-4 xl:col-span-3">
            <SectionTitle icon={ClipboardList} title={tr("الإصدارات", "Versions")} sub={`${rows.length}`} />
            <ol className="mt-3 max-h-[640px] space-y-1 overflow-y-auto">
              {rows.slice().reverse().map((r) => (
                <li key={r.version}>
                  <button onClick={() => setSel(r.version)} className={clsx("w-full rounded-lg border px-3 py-2 text-start text-xs", sel === r.version ? "border-brand/60 bg-brand/5" : "border-line hover:border-dim")}>
                    <div className="flex justify-between"><b>v{r.version}{r.version === rows.length ? ` · ${tr("الحالي", "current")}` : ""}</b><span className="num text-dim">{T(r.tick)}</span></div>
                    <div className="mt-0.5 text-muted">{L(r.change_reason)}</div>
                  </button>
                </li>
              ))}
            </ol>
          </Card>
          {cur && (
            <>
              <Card className="p-5 xl:col-span-5">
                <SectionTitle icon={GitCompare} title={`${tr("التغييرات", "Changes")} v${prev?.version ?? "—"} → v${cur.version}`} sub={`${T(cur.tick)} · ${tr("الحدث", "event")} ${cur.related_event_id} · ${cur.plan_status}`} />
                <ul className="mt-4 space-y-1.5 text-xs">
                  {cur.changes.length === 0 && <li className="text-muted">{tr("الإصدار الأولي", "Initial version")}</li>}
                  {cur.changes.map((c, i) => (
                    <li key={i} className={clsx("flex gap-2 rounded-lg border px-3 py-2", KIND[c.kind][2])}>
                      <span className={clsx("w-3 font-bold", KIND[c.kind][1])}>{KIND[c.kind][0]}</span>
                      <span className="flex-1">
                        {c.area_id && <b>{area(c.area_id)} · </b>}
                        {c.action && <span className="font-semibold">{L(CATALOG[c.action])} · </span>}
                        <span className="text-muted">{L(c.reason)}</span>
                        {c.from != null && c.kind !== "added" && c.kind !== "withdrawn" && <div className="num text-[10px] text-dim" dir="ltr">{String(c.from)} → {String(c.to)}</div>}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="p-5 xl:col-span-4">
                <SectionTitle title={`${tr("محتوى الخطة", "Plan content")} v${cur.version}`} sub={tr("المقترح مقابل المعتمد (حالة الاعتماد عند إنشاء الإصدار)", "Proposed vs approved (approval status as recorded on this version)")} />
                <div className="mt-4 space-y-1.5 text-xs">
                  {cur.areas.map((a) => (
                    <div key={a.area_id} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                      <div className="flex items-center gap-2"><span className="num font-bold">#{a.priority}{a.tie ? "=" : ""}</span><span className="font-semibold">{area(a.area_id)}</span><RiskChip risk={a.risk as RiskKey} /></div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {a.actions.map((x) => (
                          <span key={x.key} className={clsx("rounded px-1.5 text-[10px]", x.status === "approved" ? "bg-ok/15 text-ok" : x.status === "rejected" ? "bg-danger/15 text-danger" : "bg-surface-3 text-muted")}>
                            {L(CATALOG[x.action])} · {x.status}
                          </span>
                        ))}
                        {!a.actions.length && <span className="text-dim">—</span>}
                      </div>
                    </div>
                  ))}
                  {cur.route && <div className="rounded-lg border border-line px-3 py-2 text-muted">{tr("المسار المحاكى", "Simulated route")}: {L(cur.route.explanation)}</div>}
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}
