import { riskRank } from "./l1";
import type { AreaDef, AreaResult, Exposure, RankRow, RiskLevel } from "./types";

/** RANK-v0.1 — documented, weight-free lexicographic order. */
export const EXPOSURE_RANK: Record<Exposure, number> = { critical_facility: 4, residential: 3, road: 2, farmland: 1 };
export const EXPOSURE_LABEL: Record<Exposure, { en: string; ar: string }> = {
  critical_facility: { en: "critical facility", ar: "منشأة حيوية" },
  residential: { en: "residential", ar: "سكنية" },
  road: { en: "road", ar: "طريق" },
  farmland: { en: "farmland", ar: "زراعية" },
};
export const RISK_LABEL: Record<string, { en: string; ar: string }> = {
  low: { en: "Low", ar: "منخفض" },
  moderate: { en: "Moderate", ar: "متوسط" },
  elevated: { en: "Elevated", ar: "مرتفع" },
  severe: { en: "Severe", ar: "شديد" },
  no_data: { en: "No Data", ar: "لا توجد بيانات" },
  unaffected: { en: "Unaffected", ar: "غير متأثرة" },
};

const areaRiskRank = (r: AreaResult["risk"]) => (r === "no_data" || r === "unaffected" ? 0 : riskRank(r as RiskLevel));
type Key = [number, number, number];
const keyOf = (a: AreaDef, r: AreaResult): Key => [areaRiskRank(r.risk), EXPOSURE_RANK[a.exposure], -(a.lag_ticks ?? 99)];
const cmp = (x: Key, y: Key) => y[0] - x[0] || y[1] - x[1] || y[2] - x[2];

/**
 * Order: risk level ↓, then exposure class ↓, then impact lag ↑ (sooner first).
 * Areas equal on all three share a rank and are flagged as a tie — no invented difference.
 */
export function rankAreas(defs: AreaDef[], results: AreaResult[]): RankRow[] {
  const byId = new Map(results.map((r) => [r.area_id, r]));
  const rows = defs
    .filter((a) => a.lag_ticks != null)
    .map((a) => ({ a, r: byId.get(a.id)!, k: keyOf(a, byId.get(a.id)!) }))
    .sort((x, y) => cmp(x.k, y.k) || x.a.id.localeCompare(y.a.id));
  const out: RankRow[] = [];
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    const next = rows[i + 1];
    const same = (o?: typeof row) => !!o && cmp(o.k, row.k) === 0;
    const rank = same(prev) ? out[i - 1].rank : i + 1;
    const tie = same(prev) || same(next);
    const R = RISK_LABEL[row.r.risk];
    const X = EXPOSURE_LABEL[row.a.exposure];
    // Explain which criterion separated this area from the one below it.
    let by = { en: "", ar: "" };
    if (next && !same(next)) {
      if (row.k[0] !== next.k[0]) by = { en: "ranked above the next area by risk level", ar: "تتقدم على المنطقة التالية بمستوى الخطر" };
      else if (row.k[1] !== next.k[1]) by = { en: "same risk as the next area; exposure class breaks the tie", ar: "نفس مستوى خطر المنطقة التالية؛ فئة التعرض تحسم الترتيب" };
      else by = { en: "same risk and exposure as the next area; shorter impact lag", ar: "نفس الخطر والتعرض للمنطقة التالية؛ زمن وصول أقصر" };
    }
    out.push({
      area_id: row.a.id,
      rank,
      tie,
      risk: row.r.risk,
      exposure: row.a.exposure,
      lag_ticks: row.a.lag_ticks!,
      reason: {
        en: `${R.en} risk · ${X.en} · impact lag ${row.a.lag_ticks} min${tie ? " · TIE (equal on all documented criteria)" : ""}${by.en ? " · " + by.en : ""}`,
        ar: `خطر ${R.ar} · ${X.ar} · زمن الوصول ${row.a.lag_ticks} د${tie ? " · تعادل (متساوية في جميع المعايير الموثقة)" : ""}${by.ar ? " · " + by.ar : ""}`,
      },
    });
  });
  return out;
}
