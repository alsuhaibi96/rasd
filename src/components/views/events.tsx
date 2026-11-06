"use client";
import { ScrollText } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useL, useTr } from "@/lib/i18n";
import type { LoggedEvent } from "@/lib/scenario-types";
import { PageHeader } from "../shell/page-header";
import { Card, Pill } from "../ui";

const T = (t: number | null) => (t == null ? "" : `T${String(t).padStart(2, "0")}`);
const show = (v: unknown) => (v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export function EventsView() {
  const tr = useTr();
  const L = useL();
  const params = useSearchParams();
  const [runs, setRuns] = useState<{ id: number; scenario_id: string; status: string }[]>([]);
  const [run, setRun] = useState<string>(params.get("run") ?? "");
  const [type, setType] = useState("");
  const [area, setArea] = useState("");
  const [rows, setRows] = useState<LoggedEvent[]>([]);
  useEffect(() => {
    fetch("/api/runs").then((r) => (r.ok ? r.json() : [])).then((rs) => { setRuns(rs); setRun((c) => c || String(rs[0]?.id ?? "")); });
  }, []);
  useEffect(() => {
    const q = new URLSearchParams({ limit: "2000" });
    if (run) q.set("run", run);
    if (type) q.set("type", type);
    if (area) q.set("area", area);
    fetch(`/api/events?${q}`).then((r) => (r.ok ? r.json() : [])).then(setRows);
  }, [run, type, area]);
  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.type))).sort(), [rows]);
  return (
    <>
      <PageHeader title={tr("سجل الأحداث والتدقيق", "Event & audit log")} sub={tr("سجل دائم للإضافة فقط: القيمة السابقة والجديدة والسبب والمصدر والمنطقة لكل تغيير.", "Append-only: previous value, new value, reason, source and area for every change.")} />
      <Card className="mt-6 p-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <ScrollText className="size-4 text-muted" />
          <select value={run} onChange={(e) => setRun(e.target.value)} className="rounded-lg border border-line-2 bg-surface-2 px-2 py-1">
            <option value="">{tr("كل التشغيلات", "All runs")}</option>
            {runs.map((r) => <option key={r.id} value={r.id}>#{r.id} · {r.scenario_id} · {r.status}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-line-2 bg-surface-2 px-2 py-1">
            <option value="">{tr("كل الأنواع", "All types")}</option>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input value={area} onChange={(e) => setArea(e.target.value.toUpperCase())} placeholder="AR-01" className="w-24 rounded-lg border border-line-2 bg-surface-2 px-2 py-1" />
          <Pill>{rows.length} {tr("حدث", "events")}</Pill>
          <Pill className="border-[#c2410c]/50 text-[#fdba74]">data_source: simulated</Pill>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="text-start text-muted">
              <tr className="border-b border-line">
                {[tr("المعرّف", "ID"), tr("الدقيقة", "Tick"), tr("النوع", "Type"), tr("المصدر", "Source"), tr("المنطقة/الكيان", "Area / entity"), tr("السابق → الجديد", "Previous → new"), tr("السبب", "Reason"), tr("وقت التسجيل", "Logged at")].map((h) => <th key={h} className="px-2 py-2 text-start font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.slice().reverse().map((e) => (
                <tr key={e.id} className="border-b border-line/50 align-top">
                  <td className="num px-2 py-1.5 text-dim">#{e.run_id}·{e.event_id}</td>
                  <td className="num px-2 py-1.5">{T(e.tick)}</td>
                  <td className="px-2 py-1.5 font-semibold">{e.type}</td>
                  <td className="px-2 py-1.5 text-muted">{e.source}</td>
                  <td className="num px-2 py-1.5">{e.area_id ?? e.entity_id ?? ""}</td>
                  <td className="num max-w-xs truncate px-2 py-1.5 text-muted" title={`${show(e.prev)} → ${show(e.next)}`} dir="ltr">{show(e.prev)} → {show(e.next)}</td>
                  <td className="max-w-md px-2 py-1.5 text-muted">{L(e.reason)}</td>
                  <td className="num px-2 py-1.5 text-dim">{new Date(e.created_at).toLocaleTimeString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
