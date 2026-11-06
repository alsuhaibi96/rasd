"use client";
import clsx from "clsx";
import { FlaskConical, Layers } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { OperationalChain } from "@/components/dashboard/operational-chain";
import { RiskPanel } from "@/components/dashboard/risk-panel";
import { RiskStrip } from "@/components/dashboard/risk-strip";
import { LAYER_KEYS, type LayerKey } from "@/components/sim/basin-map";
import { AreaDetail, AreaRanking, EventFeed, L0Mini, PlanHead, Recommendations, RoutesPanel, RunControls, WhatIfPanel } from "@/components/sim/panels";
import { ScenarioSetup } from "@/components/sim/setup";
import { PageHeader } from "@/components/shell/page-header";
import { BASIN, frameAt, makeConfig, runAll, type ScenarioSpec, type WhatIfResult } from "@/engine";
import { post } from "@/lib/client-api";
import { useL, useLang, useTr } from "@/lib/i18n";
import { useRasd } from "@/lib/store";
import { Card, RISK_COLOR, RiskLevel } from "../ui";

const BasinMap = dynamic(() => import("@/components/sim/basin-map"), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-[#08161b]" /> });

export function SimulationView() {
  const run = useRasd((s) => s.run);
  const tr = useTr();
  const L = useL();
  const lang = useLang();
  const [reviewTick, setReviewTick] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [whatif, setWhatif] = useState<WhatIfResult | null>(null);
  const [offset, setOffset] = useState(15);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>(() => Object.fromEntries(LAYER_KEYS.map((k) => [k, true])) as Record<LayerKey, boolean>);

  // Review mode: recompute the state at a past tick from the same scenario inputs (deterministic).
  const reviewState = useMemo(() => {
    if (!run || reviewTick == null) return null;
    const spec: ScenarioSpec = { kind: run.kind, scenario_id: run.scenario_id, segments: run.segments };
    const frames = Array.from({ length: reviewTick + 1 }, (_, t) => frameAt(spec, t, run.t0));
    return runAll(frames, makeConfig(run.limits, run.scenario_id)).state;
  }, [run, reviewTick]);
  const live = !!run && reviewTick == null && run.status !== "stopped";
  const state = reviewState ?? (run ? { ...run.state, plan: [] } : null);

  const LAYER_LABEL: Record<LayerKey, string> = {
    sensors: tr("مواقع الحساسات", "Sensor locations"),
    sensorStatus: tr("حالة الحساس (L0)", "Sensor status (L0)"),
    alerts: tr("التنبيهات النشطة", "Active alerts"),
    riskZones: tr("نطاق الخطر", "Risk zones"),
    affected: tr("المناطق المتأثرة", "Affected areas"),
    areaRisk: tr("خطر المناطق (L1)", "Area risk levels (L1)"),
    priorities: tr("أولويات الاستجابة", "Response priorities"),
    routes: tr("المسارات", "Routes"),
    closures: tr("الإغلاقات", "Road closures"),
    whatif: tr("إسقاط ماذا لو", "What-if overlay"),
  };

  return (
    <>
      <PageHeader
        title={tr("مركز محاكاة الكوارث التفاعلي", "Interactive Disaster Simulation Center")}
        sub={tr("اختبر السلسلة المتكاملة بسيناريوهات محاكاة: كل زر متصل بمنطق النظام الفعلي، وكل مخرج قابل للتتبع.", "Test the integrated chain with simulated scenarios: every control drives real system logic and every output is traceable.")}
      />
      {!run ? (
        <div className="mt-6"><ScenarioSetup /></div>
      ) : (
        <div className="mt-6 space-y-5">
          <RunControls run={run} reviewTick={reviewTick} setReviewTick={setReviewTick} />
          <OperationalChain />
          <div className="grid gap-5 xl:grid-cols-12">
            <Card className="relative flex flex-col overflow-hidden xl:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold"><FlaskConical className="size-5 text-muted" /> {L(BASIN.name)}</h2>
                  <p className="mt-0.5 text-xs text-muted">{tr("اضغط على منطقة للتفاصيل، أو على مقطع طريق لإغلاقه افتراضيًا", "Click an area for details, or a road segment to close it virtually")}</p>
                </div>
                {state && <L0Mini state={state} />}
              </div>
              <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-2">
                <Layers className="me-1 size-4 text-muted" />
                {LAYER_KEYS.map((k) => (
                  <button key={k} onClick={() => setLayers({ ...layers, [k]: !layers[k] })} className={clsx("rounded-md border px-2 py-0.5 text-[11px]", layers[k] ? "border-brand/50 bg-brand/10 text-brand" : "border-line-2 text-dim")}>
                    {LAYER_LABEL[k]}
                  </button>
                ))}
              </div>
              <div className="relative h-[460px] border-t border-line sm:h-[540px]">
                <BasinMap
                  className="h-full w-full"
                  state={state}
                  layers={layers}
                  selectedArea={selected}
                  onSelectArea={setSelected}
                  onToggleRoad={live ? (edge) => post("/api/routes", { run: run.run_id, edge, closed: !run.state.closures.includes(edge) }) : undefined}
                  whatif={layers.whatif ? whatif : null}
                  whatifOffset={offset}
                  lang={lang}
                />
                {selected && state && <AreaDetail state={state} id={selected} onClose={() => setSelected(null)} />}
                <div className="pointer-events-none absolute end-3 bottom-3 rounded-lg border border-line-2 bg-[#0a1519]/90 p-2 text-[10px] text-muted">
                  <div className="mb-1 font-semibold text-fg">{tr("مستوى الخطر (L1)", "Risk level (L1)")}</div>
                  {(["low", "moderate", "elevated", "severe", "no_data"] as const).map((r) => (
                    <div key={r} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: RISK_COLOR[r] }} /> <RiskLevel risk={r} size="sm" /></div>
                  ))}
                  <div className="mt-1 flex items-center gap-1.5"><span className="h-0.5 w-4 bg-brand" /> {tr("مسار محاكى", "Simulated route")}</div>
                  <div className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-danger" /> {tr("مغلق افتراضيًا", "Virtually closed")}</div>
                  {whatif && <div className="flex items-center gap-1.5"><span className="size-2.5 border border-dashed border-fg" /> {tr("مُسقط (افتراضي)", "Projected (hypothetical)")}</div>}
                </div>
              </div>
              <div className="border-t border-line px-4 pb-3"><RiskStrip /></div>
            </Card>
            <div className="xl:col-span-4">{state && <AreaRanking state={state} selected={selected} onSelect={setSelected} />}</div>
            <div className="xl:col-span-4"><RiskPanel /></div>
            <div className="xl:col-span-8">{state && <PlanHead run={run} state={reviewState ?? { ...run.state, plan: [] }} review={reviewTick != null} />}</div>
            <div className="xl:col-span-6">{state && <Recommendations state={state} run={run} live={live} />}</div>
            <div className="xl:col-span-6"><EventFeed runId={run.run_id} /></div>
            <div className="xl:col-span-6">{state && <RoutesPanel run={run} state={state} live={live} />}</div>
            <div className="xl:col-span-6"><WhatIfPanel result={whatif} setResult={setWhatif} offset={offset} setOffset={setOffset} enabled={run.tick >= 0} /></div>
          </div>
        </div>
      )}
    </>
  );
}
