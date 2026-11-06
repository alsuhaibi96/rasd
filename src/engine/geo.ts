import { assessL1, indicators, classifyL1, explain } from "./l1";
import { n } from "./format";
import type { AreaDef, AreaResult, RiskLevel, RoadEdge, RoadNode } from "./types";

const SRC = "RASD virtual basin v0.1 — drawn for simulation; NOT real geography";

function hex(lng: number, lat: number, r = 0.0062): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    pts.push([+(lng + r * 1.13 * Math.cos(a)).toFixed(5), +(lat + r * Math.sin(a)).toFixed(5)]);
  }
  pts.push(pts[0]);
  return pts;
}

const area = (id: string, en: string, ar: string, exposure: AreaDef["exposure"], lag: number | null, off: number, lng: number, lat: number): AreaDef => ({
  id,
  name: { en, ar },
  exposure,
  lag_ticks: lag,
  elevation_offset_cm: off,
  polygon: hex(lng, lat),
  geographic_status: "virtual",
  geographic_source: SRC,
});

/**
 * Virtual basin downstream of WTR-01 (Wadi Al-Adirea, Hail). Every attribute below is a
 * Proposed scenario parameter for AREA-v0.1 — not surveyed data.
 */
export const ADIREA_AREAS: AreaDef[] = [
  area("AR-01", "Wadi Bank District", "حي ضفة الوادي", "residential", 0, 0, 41.728, 27.515),
  area("AR-02", "Al-Adirea Farms", "مزارع الأديرع", "farmland", 1, 5, 41.742, 27.507),
  area("AR-03", "Wadi Crossing", "معبر الوادي", "road", 2, 10, 41.755, 27.499),
  area("AR-04", "Health Center Zone", "منطقة المركز الصحي", "critical_facility", 3, 20, 41.768, 27.491),
  area("AR-05", "South Residential", "الحي الجنوبي", "residential", 4, 15, 41.781, 27.484),
  area("AR-06", "Low Farmland", "المزارع المنخفضة", "farmland", 5, 0, 41.793, 27.476),
  area("AR-07", "School & Services", "المدرسة والخدمات", "critical_facility", 6, 45, 41.806, 27.469),
  area("AR-08", "Northern Highlands", "المرتفعات الشمالية", "residential", null, 0, 41.735, 27.535),
];

export const BASIN = {
  id: "ADIREA-V",
  name: { en: "Wadi Al-Adirea – VIRTUAL basin", ar: "حوض وادي الأديرع – افتراضي" },
  center: [41.765, 27.5] as [number, number],
  sensor: { code: "WTR-01", lng: 41.72, lat: 27.52 },
  /** Virtual wadi channel line (for drawing only). */
  channel: [[41.705, 27.526], [41.72, 27.52], [41.742, 27.507], [41.768, 27.491], [41.793, 27.476], [41.82, 27.462]] as [number, number][],
};

export const ROAD_NODES: RoadNode[] = [
  { id: "OPS", lng: 41.7, lat: 27.5, label: { en: "Virtual operations base", ar: "قاعدة عمليات افتراضية" } },
  ...ADIREA_AREAS.map((a) => {
    const [lng, lat] = centroid(a.polygon);
    return { id: "A" + a.id.slice(4), lng, lat, area_id: a.id };
  }),
  { id: "K1", lng: 41.715, lat: 27.53 },
  { id: "K2", lng: 41.755, lat: 27.525 },
  { id: "K3", lng: 41.782, lat: 27.51 },
  { id: "K4", lng: 41.81, lat: 27.49 },
  { id: "S1", lng: 41.725, lat: 27.485 },
  { id: "S2", lng: 41.765, lat: 27.472 },
  { id: "S3", lng: 41.795, lat: 27.458 },
];

const e = (id: string, a: string, b: string, en: string, ar: string, area_id?: string): RoadEdge => ({ id, a, b, name: { en, ar }, area_id });
export const ROAD_EDGES: RoadEdge[] = [
  e("E01", "OPS", "A1", "Wadi road 1", "طريق الوادي 1", "AR-01"),
  e("E02", "A1", "A2", "Wadi road 2", "طريق الوادي 2", "AR-02"),
  e("E03", "A2", "A3", "Wadi road 3", "طريق الوادي 3", "AR-03"),
  e("E04", "A3", "A4", "Wadi road 4", "طريق الوادي 4", "AR-04"),
  e("E05", "A4", "A5", "Wadi road 5", "طريق الوادي 5", "AR-05"),
  e("E06", "A5", "A6", "Wadi road 6", "طريق الوادي 6", "AR-06"),
  e("E07", "A6", "A7", "Wadi road 7", "طريق الوادي 7", "AR-07"),
  e("E10", "OPS", "K1", "Ridge road 1", "طريق المرتفع 1"),
  e("E11", "K1", "A8", "Ridge road 2", "طريق المرتفع 2", "AR-08"),
  e("E12", "A8", "K2", "Ridge road 3", "طريق المرتفع 3"),
  e("E13", "K2", "K3", "Ridge road 4", "طريق المرتفع 4"),
  e("E14", "K3", "K4", "Ridge road 5", "طريق المرتفع 5"),
  e("E15", "K2", "A3", "Crossing link", "وصلة المعبر"),
  e("E16", "K3", "A5", "South-district link", "وصلة الحي الجنوبي"),
  e("E17", "K4", "A7", "School link", "وصلة المدرسة"),
  e("E20", "OPS", "S1", "South road 1", "الطريق الجنوبي 1"),
  e("E21", "S1", "A2", "Farm link", "وصلة المزارع"),
  e("E22", "S1", "S2", "South road 2", "الطريق الجنوبي 2"),
  e("E23", "S2", "A4", "Health-center link", "وصلة المركز الصحي"),
  e("E24", "S2", "S3", "South road 3", "الطريق الجنوبي 3"),
  e("E25", "S3", "A6", "Low-farm link", "وصلة المزارع المنخفضة"),
];

export function centroid(poly: [number, number][]): [number, number] {
  const pts = poly.slice(0, -1);
  const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [+lng.toFixed(5), +lat.toFixed(5)];
}

/** AREA-v0.1: effective level at an area = WTR-01 level lag ticks earlier − elevation offset. */
export function effectiveLevels(levels: (number | null)[], a: AreaDef): (number | null)[] {
  if (a.lag_ticks == null) return levels.map(() => null);
  const L = a.lag_ticks;
  return levels.map((_, i) => (i - L >= 0 && levels[i - L] != null ? (levels[i - L] as number) - a.elevation_offset_cm : null));
}

/** Independent area-level assessment (spec §6.3). No Data instead of an invented level. */
export function assessArea(a: AreaDef, levels: (number | null)[], rains: (number | null)[], t: number, prev: AreaResult | undefined, everAbove: boolean): AreaResult {
  if (a.lag_ticks == null)
    return {
      area_id: a.id,
      risk: "unaffected",
      affected: false,
      indicators: null,
      warmup: false,
      receding: false,
      quality: "n/a",
      reason: { en: "Not hydraulically linked to WTR-01 in the virtual basin (AREA-v0.1).", ar: "غير مرتبطة هيدروليكيًا بالحساس WTR-01 في الحوض الافتراضي (AREA-v0.1)." },
      input_ticks: [],
    };
  const L = a.lag_ticks;
  const src = t - L;
  if (src < 0 || levels[src] == null) {
    const why =
      src < 0
        ? { en: `No Data: water from WTR-01 needs ${L} min to reach this area; not enough history yet.`, ar: `لا توجد بيانات: تحتاج المياه ${L} دقيقة للوصول من WTR-01 إلى هذه المنطقة؛ لا يوجد سجل كافٍ بعد.` }
        : { en: `No Data: the upstream WTR-01 reading at T${String(src).padStart(2, "0")} is missing or invalid.`, ar: `لا توجد بيانات: قراءة WTR-01 عند T${String(src).padStart(2, "0")} مفقودة أو غير صالحة.` };
    return { area_id: a.id, risk: "no_data", affected: false, indicators: null, warmup: false, receding: false, quality: "n/a", reason: why, input_ticks: src >= 0 ? [src] : [] };
  }
  const eff = effectiveLevels(levels, a);
  const ind = indicators(eff, rains, t);
  const { rainGaps: _g, ...pure } = ind;
  void _g;
  const { risk, receding } = classifyL1(pure);
  const warmup = pure.rise_3 == null;
  const prevRisk = prev && prev.risk !== "no_data" && prev.risk !== "unaffected" ? (prev.risk as RiskLevel) : null;
  const body = explain(pure, risk, receding, prevRisk, everAbove, warmup);
  const raw = levels[src] as number;
  const pre = {
    en: `Effective level = WTR-01 at T${String(src).padStart(2, "0")} (${n(raw)} cm) − ${a.elevation_offset_cm} cm offset = ${n(pure.level!)} cm. `,
    ar: `المستوى الفعّال = WTR-01 عند T${String(src).padStart(2, "0")} (${n(raw)} سم) − ${a.elevation_offset_cm} سم فرق ارتفاع = ${n(pure.level!)} سم. `,
  };
  const ticks = [src];
  if (src - 3 >= 0) ticks.push(src - 3);
  return {
    area_id: a.id,
    risk: risk ?? "no_data",
    affected: pure.LH,
    indicators: pure,
    warmup,
    receding,
    quality: ind.rainGaps ? "suspect" : "valid",
    reason: { en: pre.en + body.en, ar: pre.ar + body.ar },
    input_ticks: ticks,
  };
}

export { assessL1 };
