"use client";
import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { useTr } from "@/lib/i18n";
import { useRasd } from "@/lib/store";

/** Spec §11.5: the label stays visible on every screen while a simulated scenario is active. */
export function SimulatedBanner() {
  const run = useRasd((s) => s.run);
  const tr = useTr();
  if (!run) return null;
  const t = Math.max(0, run.tick);
  const status = { running: tr("قيد التشغيل", "running"), paused: tr("متوقف مؤقتًا", "paused"), completed: tr("مكتمل", "completed"), stopped: tr("متوقف", "stopped"), interrupted: tr("مقطوع", "interrupted") }[run.status];
  return (
    <div className="sticky top-16 z-20 border-b border-[#c2410c]/50 bg-[repeating-linear-gradient(135deg,#431407_0_14px,#3b1206_14px_28px)] text-[#fed7aa]">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-xs sm:px-7">
        <span className="flex items-center gap-2 font-bold tracking-wide" dir="ltr">
          <FlaskConical className="size-4" /> SIMULATED SCENARIO – NOT LIVE DATA
        </span>
        <span className="num rounded bg-black/30 px-1.5 py-0.5">{run.scenario_id}</span>
        <span>{tr("تشغيل", "Run")} <span className="num">#{run.run_id}</span> · {status}</span>
        <span>
          <span className="num font-semibold">T{String(t).padStart(2, "0")}</span> / <span className="num">T{String(run.length - 1).padStart(2, "0")}</span> · {tr("زمن محاكى", "simulated time")} (+<span className="num">{t}</span> {tr("د", "min")})
        </span>
        {!run.limits_match_f03 && <span className="rounded bg-black/40 px-1.5 py-0.5 text-warn">{tr("حدود L0 تختلف عن 60/80 سم المفترضة في F-03", "L0 limits differ from the 60/80 cm assumed by F-03")}</span>}
        <Link href="/simulation" className="ms-auto rounded border border-[#fed7aa]/40 px-2 py-0.5 hover:bg-black/20">
          {tr("مركز المحاكاة", "Simulation Center")}
        </Link>
      </div>
    </div>
  );
}
