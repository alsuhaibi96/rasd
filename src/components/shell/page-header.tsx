"use client";
import { Cpu, Play } from "lucide-react";
import { useState } from "react";
import { dataSource } from "@/lib/derive";
import { fmtDay } from "@/lib/format";
import { useRasd } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { Button } from "../ui";
import { SimulateDialog } from "./simulate-dialog";

export function PageHeader({ title, sub }: { title: string; sub: string }) {
  const [open, setOpen] = useState(false);
  const connected = useRasd((s) => s.connected);
  const sensors = useRasd((s) => s.sensors);
  const now = useNow(Date.parse(useRasd.getState().serverTime));

  return (
    <>
      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className={connected ? "size-1.5 rounded-full bg-brand" : "size-1.5 animate-pulse rounded-full bg-warn"} />
            {connected ? "مزامنة مباشرة" : "جارٍ الاتصال…"}
          </div>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-muted">{sub}</p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <span className="text-xs text-muted" suppressHydrationWarning>{fmtDay(new Date(now))}</span>
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Play className="size-4 -scale-x-100" /> محاكاة قراءة جديدة
          </Button>
        </div>
      </div>
      {dataSource(sensors, now) === "simulator" && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-line-2 bg-surface-2/60 px-4 py-3 text-sm text-muted">
          <Cpu className="size-5 shrink-0 text-fg" strokeWidth={1.6} />
          <span>
            <b className="font-semibold text-fg">وضع التجربة:</b> لم يُربط أي جهاز فعلي بعد. القراءات أدناه محاكاة محفوظة في قاعدة البيانات،
            وتتحول تلقائيًا إلى بيانات حية فور وصول أول قراءة من جهاز ESP32.
          </span>
        </div>
      )}
      <SimulateDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
