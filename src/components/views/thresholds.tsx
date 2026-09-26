"use client";
import { Check, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KpiRow } from "@/components/shell/kpi-row";
import { PageHeader } from "@/components/shell/page-header";
import { Button, Card, SENSOR_ICON } from "@/components/ui";
import { validateLimits } from "@/lib/severity";
import { SENSOR_META } from "@/lib/sensor-meta";
import { useRasd } from "@/lib/store";
import type { SensorType, Threshold } from "@/lib/types";

type Draft = Record<SensorType, { warning: string; danger: string }>;

const toDraft = (ts: Threshold[]) =>
  Object.fromEntries(ts.map((t) => [t.sensor_type, { warning: String(t.warning ?? ""), danger: String(t.danger ?? "") }])) as Draft;

export function ThresholdsView() {
  const thresholds = useRasd((s) => s.thresholds);
  const sensors = useRasd((s) => s.sensors);
  const [draft, setDraft] = useState<Draft>(() => toDraft(thresholds));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Adopt changes saved elsewhere unless the user is mid-edit.
  useEffect(() => {
    if (!dirty) setDraft(toDraft(thresholds));
  }, [thresholds, dirty]);

  const errors = Object.fromEntries(
    thresholds.map((t) => {
      const d = draft[t.sensor_type];
      if (!d) return [t.sensor_type, null];
      const w = d.warning === "" ? null : Number(d.warning);
      const x = d.danger === "" ? null : Number(d.danger);
      return [t.sensor_type, validateLimits({ warning: w, danger: x, direction: t.direction })];
    }),
  );
  const hasErrors = Object.values(errors).some(Boolean);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/thresholds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(thresholds.map((t) => ({ sensor_type: t.sensor_type, ...draft[t.sensor_type] }))),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDirty(false);
      toast.success("تم حفظ الحدود وإعادة تقييم الحالات");
    } catch (e) {
      toast.error((e as Error).message || "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  const input =
    "num mt-2 w-full rounded-xl border border-line-2 bg-bg px-4 py-3 text-center text-lg font-semibold outline-none transition focus:border-brand";

  return (
    <>
      <PageHeader title="إعداد حدود الخطورة" sub="اضبط مستويات التحذير والخطر لكل نوع حساس." />
      <KpiRow />
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-muted">
        <SlidersHorizontal className="size-5 shrink-0 text-brand" />
        الحدود محفوظة في قاعدة البيانات وتُطبَّق فورًا على القراءات الحالية عند الحفظ. يبدأ التحذير أو الخطر عندما تبلغ القراءة الحد أو تتجاوزه.
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {thresholds.map((t) => {
          const meta = SENSOR_META[t.sensor_type];
          const Icon = SENSOR_ICON[t.sensor_type];
          const d = draft[t.sensor_type] ?? { warning: "", danger: "" };
          const count = sensors.filter((s) => s.type === t.sensor_type).length;
          const below = t.direction === "below";
          const set = (k: "warning" | "danger", v: string) => {
            setDirty(true);
            setDraft((p) => ({ ...p, [t.sensor_type]: { ...p[t.sensor_type], [k]: v } }));
          };
          return (
            <Card key={t.sensor_type} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold">
                    <Icon className="size-5 text-brand" strokeWidth={1.8} /> حساس {meta.label}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    الوحدة: {meta.unitLabel} · المدى <span className="num">{t.min_value}</span> إلى <span className="num">{t.max_value}</span> ·{" "}
                    {below ? "الخطر عند الانخفاض" : "الخطر عند الارتفاع"}
                  </p>
                </div>
                <span className="rounded-md bg-surface-3 px-2 py-0.5 text-xs text-muted">{count} حساس</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <label className="text-sm text-warn">
                  حد التحذير
                  <input className={input} inputMode="decimal" value={d.warning} onChange={(e) => set("warning", e.target.value)} />
                </label>
                <label className="text-sm text-danger">
                  حد الخطر
                  <input className={input} inputMode="decimal" value={d.danger} onChange={(e) => set("danger", e.target.value)} />
                </label>
              </div>
              {errors[t.sensor_type] ? (
                <p className="mt-3 text-xs text-danger">{errors[t.sensor_type]}</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                  <span><span className="text-ok">●</span> طبيعي: {below ? "أعلى من" : "أقل من"} <span className="num">{d.warning}</span></span>
                  <span><span className="text-warn">●</span> تحذير: من <span className="num">{d.warning}</span></span>
                  <span><span className="text-danger">●</span> خطر: {below ? "من" : "من"} <span className="num">{d.danger}</span> {below ? "فأقل" : "فأعلى"}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button variant="primary" onClick={save} disabled={saving || hasErrors || !dirty}>
          <Check className="size-4" /> {saving ? "جارٍ الحفظ…" : "حفظ الحدود وتطبيقها"}
        </Button>
        <span className="text-sm text-muted">
          {dirty ? "لديك تعديلات غير محفوظة." : "الحدود الحالية محفوظة. تُحسب الحالات والتنبيهات على الخادم."}
        </span>
      </div>
    </>
  );
}
