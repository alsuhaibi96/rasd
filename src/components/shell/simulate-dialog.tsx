"use client";
import clsx from "clsx";
import { Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { indexBy } from "@/lib/derive";
import { SENSOR_META, STATUS_LABEL } from "@/lib/sensor-meta";
import { useRasd } from "@/lib/store";
import { Button, StatusBadge } from "../ui";

const LEVELS = ["normal", "warning", "danger"] as const;

export function SimulateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sensors = useRasd((s) => s.sensors);
  const stations = useRasd((s) => s.stations);
  const stationById = useMemo(() => indexBy(stations), [stations]);
  const [sensor, setSensor] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("danger");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && !sensor && sensors[0]) setSensor(sensors[0].code);
  }, [open, sensor, sensors]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const selected = sensors.find((s) => s.code === sensor);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sensor, level, value: value === "" ? undefined : Number(value) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`أُرسلت القراءة ${data.value} إلى ${data.sensor}`, { description: `الحالة: ${STATUS_LABEL[data.status as "normal"]}` });
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "تعذر إرسال القراءة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal className="relative w-full max-w-lg rounded-2xl border border-line-2 bg-surface p-6 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 end-4 rounded-lg p-1.5 text-muted hover:bg-surface-3" aria-label="إغلاق">
          <X className="size-5" />
        </button>
        <h3 className="text-lg font-bold">محاكاة قراءة جديدة</h3>
        <p className="mt-1 text-sm text-muted">تمر القراءة بنفس مسار الأجهزة: حفظ ← تحليل ← تحديث اللوحة ← تنبيه.</p>

        <label className="mt-5 block text-sm text-muted">الحساس</label>
        <select
          value={sensor}
          onChange={(e) => setSensor(e.target.value)}
          className="mt-2 w-full rounded-xl border border-line-2 bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand"
        >
          {sensors.map((s) => (
            <option key={s.id} value={s.code}>
              {s.code} · {SENSOR_META[s.type].label} — {stationById.get(s.station_id)?.name_ar}
            </option>
          ))}
        </select>
        {selected && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted">
            الحالة الحالية: <StatusBadge status={selected.last_status} />
          </div>
        )}

        <label className="mt-5 block text-sm text-muted">المستوى المطلوب</label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLevel(l);
                setValue("");
              }}
              className={clsx(
                "rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                level === l && value === ""
                  ? l === "danger"
                    ? "border-danger/50 bg-danger/15 text-[#ff9aab]"
                    : l === "warning"
                      ? "border-warn/50 bg-warn/10 text-warn"
                      : "border-ok/50 bg-ok/10 text-ok"
                  : "border-line-2 text-muted hover:bg-surface-2",
              )}
            >
              {STATUS_LABEL[l]}
            </button>
          ))}
        </div>

        <label className="mt-5 block text-sm text-muted">
          أو قيمة محددة {selected && <span className="text-dim">({SENSOR_META[selected.type].unitLabel})</span>}
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="اتركها فارغة لتوليد قيمة حسب المستوى"
          className="num mt-2 w-full rounded-xl border border-line-2 bg-surface-2 px-3 py-2.5 text-start text-sm outline-none placeholder:text-dim focus:border-brand"
          dir="rtl"
        />

        <div className="mt-6 flex gap-3">
          <Button variant="primary" className="flex-1" onClick={submit} disabled={busy || !sensor}>
            <Send className="size-4 -scale-x-100" /> {busy ? "جارٍ الإرسال…" : "إرسال القراءة"}
          </Button>
          <Button onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </div>
  );
}
