import { mm, n, round3, signed } from "./format";
import type { Indicators, L1Result, Quality, RiskLevel } from "./types";

/** F-03 §3 parameter registry — Proposed scenario parameters (illustrative), not validated thresholds. */
export const L1_PARAMS = {
  baselineMin: 20,
  baselineMax: 30,
  riseWindow: 3,
  rainWindow: 10,
  rfMinR10: 2.0,
  lrMinRise: 5,
  severeRise: 10,
  severeLevel: 50,
} as const;

const RANK: Record<RiskLevel, number> = { low: 1, moderate: 2, elevated: 3, severe: 4 };
export const riskRank = (r: RiskLevel | null | undefined) => (r ? RANK[r] : 0);

/** Indicators at index t of a level/rain history (nulls = missing or invalid readings). */
export function indicators(levels: (number | null)[], rains: (number | null)[], t: number): Indicators & { rainGaps: number } {
  const P = L1_PARAMS;
  const level = levels[t] ?? null;
  const past = t >= P.riseWindow ? levels[t - P.riseWindow] : null;
  const rise_3 = level != null && past != null ? round3(level - past) : null;
  let sum = 0;
  let rainGaps = 0;
  let any = false;
  for (let i = Math.max(0, t - P.rainWindow + 1); i <= t; i++) {
    const r = rains[i];
    if (r == null) rainGaps++;
    else {
      sum += r;
      any = true;
    }
  }
  const r10 = any ? round3(sum) : null;
  const RF = r10 != null && r10 >= P.rfMinR10;
  const LR = rise_3 != null && rise_3 >= P.lrMinRise;
  const LH = level != null && level > P.baselineMax;
  return { level, rise_3, r10, RF, LR, LH, count: +RF + +LR + +LH, rainGaps };
}

/** F-03 §6.2 rules, evaluated in order. Data quality can never raise the level. */
export function classifyL1(ind: Indicators): { risk: RiskLevel | null; rule: string; receding: boolean } {
  const P = L1_PARAMS;
  if (ind.level == null) return { risk: null, rule: "Unavailable: no valid water-level reading", receding: false };
  const rise = ind.rise_3;
  if (ind.count >= 2 && rise != null && rise >= P.severeRise && ind.level >= P.severeLevel) return { risk: "severe", rule: "R1 Severe", receding: false };
  if (ind.count >= 2 && (rise == null || rise >= 0)) return { risk: "elevated", rule: "R2 Elevated", receding: false };
  if (ind.count >= 2) return { risk: "moderate", rule: "R3 Moderate (recession rule)", receding: true };
  if (ind.count === 1) return { risk: "moderate", rule: "R3 Moderate (one indicator)", receding: false };
  return { risk: "low", rule: "R4 Low", receding: false };
}

const COUNT_EN = ["No", "One", "Two", "Three"];
const COUNT_AR = ["لا", "مؤشر واحد", "مؤشران", "ثلاثة مؤشرات"];

/** Explanation generated only from logged values (F-03 §7 template; never free text). */
export function explain(ind: Indicators, risk: RiskLevel | null, receding: boolean, prev: RiskLevel | null, everAbove: boolean, warmup: boolean): { en: string; ar: string } {
  const P = L1_PARAMS;
  if (risk == null || ind.level == null) return { en: "Unavailable: no valid water-level reading for this tick.", ar: "غير متاح: لا توجد قراءة صالحة لمستوى المياه في هذه الدقيقة." };
  const L = n(ind.level);
  const R10 = ind.r10 == null ? "n/a" : mm(ind.r10);
  const rise = ind.rise_3;
  const wu = warmup ? { en: " (warm-up: 3-minute rise not yet computable)", ar: " (فترة الإحماء: لا يمكن حساب الارتفاع خلال 3 دقائق بعد)" } : { en: "", ar: "" };

  if (risk === "severe")
    return {
      en: `Level rose ${n(rise!)} cm in 3 min (at least ${P.severeRise}) and is ${L} cm (at least ${P.severeLevel}); rainfall ${R10} mm in 10 min. Rapid rise on top of Elevated conditions.`,
      ar: `ارتفع المستوى ${n(rise!)} سم خلال 3 دقائق (${P.severeRise} على الأقل) وبلغ ${L} سم (${P.severeLevel} على الأقل)؛ الأمطار ${R10} مم خلال 10 دقائق. ارتفاع سريع فوق ظروف الخطر المرتفع.`,
    };
  if (receding)
    return {
      en: `Level is falling (${signed(rise!)} cm in 3 min) but remains ${L} cm; rainfall ${R10} mm. Recession rule applied.`,
      ar: `المستوى يتراجع (${signed(rise!)} سم خلال 3 دقائق) لكنه ما زال ${L} سم؛ الأمطار ${R10} مم. طُبّقت قاعدة الانحسار.`,
    };
  if (risk === "elevated" && prev === "severe" && rise != null)
    return {
      en: `Level ${L} cm, rise slowed to ${signed(rise, true)} cm in 3 min, below the Severe rise condition; rainfall ${R10} mm in 10 min.`,
      ar: `المستوى ${L} سم، تباطأ الارتفاع إلى ${signed(rise, true)} سم خلال 3 دقائق، دون شرط الارتفاع الشديد؛ الأمطار ${R10} مم خلال 10 دقائق.`,
    };
  if (risk === "low")
    return {
      en: `Level ${L} cm is ${everAbove ? "back " : ""}within baseline; no indicators deviating.${wu.en}`,
      ar: `المستوى ${L} سم ${everAbove ? "عاد " : ""}ضمن الوضع الاعتيادي؛ لا توجد مؤشرات منحرفة.${wu.ar}`,
    };
  if (risk === "moderate" && ind.count === 1 && ind.RF)
    return {
      en: `Rainfall over the last 10 min reached ${R10} mm, at or above this scenario's ${mm(P.rfMinR10)} mm parameter. Water level ${L} cm, stable within the ${P.baselineMin}–${P.baselineMax} cm baseline. One indicator deviating.${wu.en}`,
      ar: `بلغت الأمطار خلال آخر 10 دقائق ${R10} مم، عند معامل هذا السيناريو (${mm(P.rfMinR10)} مم) أو أعلى. مستوى المياه ${L} سم، مستقر ضمن نطاق ${P.baselineMin}–${P.baselineMax} سم. مؤشر واحد منحرف.${wu.ar}`,
    };
  // Generic composition (Elevated, or Moderate with LR / LH alone).
  const en: string[] = [];
  const ar: string[] = [];
  if (ind.RF) {
    en.push(`rainfall total ${R10} mm in 10 min`);
    ar.push(`إجمالي الأمطار ${R10} مم خلال 10 دقائق`);
  }
  if (ind.LR) {
    en.push(`level rose ${n(rise!)} cm in 3 min`);
    ar.push(`ارتفع المستوى ${n(rise!)} سم خلال 3 دقائق`);
  }
  if (ind.LH) {
    en.push(`level ${L} cm is above the ${P.baselineMax} cm baseline maximum`);
    ar.push(`المستوى ${L} سم أعلى من الحد الأقصى للوضع الاعتيادي (${P.baselineMax} سم)`);
  }
  if (risk === "moderate" && !ind.RF) {
    if (rise != null && rise < 0) {
      en.push(`level is falling (${signed(rise)} cm in 3 min)`);
      ar.push(`المستوى يتراجع (${signed(rise)} سم خلال 3 دقائق)`);
    }
    en.push(`rainfall ${R10} mm in 10 min`);
    ar.push(`الأمطار ${R10} مم خلال 10 دقائق`);
  }
  const head = en.join("; ");
  const tail = risk === "elevated" ? `${COUNT_EN[ind.count]} consistent indicators deviating.` : `${COUNT_EN[ind.count]} indicator deviating.`;
  const tailAr = risk === "elevated" ? `${COUNT_AR[ind.count]} متسقة منحرفة.` : `${COUNT_AR[ind.count]} منحرف.`;
  return { en: `${head[0].toUpperCase()}${head.slice(1)}. ${tail}${wu.en}`, ar: `${ar.join("؛ ")}. ${tailAr}${wu.ar}` };
}

/** F-03 §8.3 wording — decision support only. */
export const L1_RECOMMENDATION: Record<string, { en: string; ar: string }> = {
  low: { en: "No action needed. Continue routine monitoring.", ar: "لا يلزم إجراء. استمرار المراقبة الاعتيادية." },
  moderate: { en: "Continue monitoring. Consider increasing monitoring frequency and verify sensor readings.", ar: "استمرار المراقبة، والنظر في زيادة وتيرة المتابعة، والتحقق من قراءات الحساسات." },
  moderate_receding: { en: "Water level is falling but still above baseline. Continue monitoring until it returns to baseline.", ar: "مستوى المياه يتراجع لكنه ما زال أعلى من الوضع الاعتيادي. استمرار المراقبة حتى العودة إلى الوضع الاعتيادي." },
  elevated: { en: "Notify the authorized monitoring team, review the affected area, and verify readings.", ar: "إبلاغ فريق المراقبة المخوّل، ومراجعة المنطقة المتأثرة، والتحقق من القراءات." },
  severe: { en: "Escalate to the authorized operator for a human decision. Consider predefined emergency procedures, if any exist.", ar: "رفع الحالة إلى المشغّل المخوّل لاتخاذ القرار. يُنظر في إجراءات الطوارئ المعتمدة إن وُجدت." },
  unavailable: { en: "Assessment unavailable. Verify the sensor and data feed.", ar: "التقييم غير متاح. التحقق من الحساس وتدفق البيانات." },
};
export const RECOMMENDATION_FOOTER = {
  en: "Decision support only. Not an official warning. Human review required. Simulated data.",
  ar: "توصية داعمة للقرار وليست تحذيرًا رسميًا · تتطلب مراجعة بشرية · بيانات محاكاة",
};
/** Wording that must never appear in generated outputs (footer negation excluded). */
export const FORBIDDEN = [/evacuat/i, /official warning/i, /predict/i, /forecast/i, /إخلاء/, /تنبؤ/];

/** Full L1 assessment at index t. */
export function assessL1(levels: (number | null)[], rains: (number | null)[], t: number, prev: RiskLevel | null, everAbove: boolean, quality: Quality): L1Result {
  const ind = indicators(levels, rains, t);
  const { risk, rule, receding } = classifyL1(ind);
  const warmup = ind.level != null && ind.rise_3 == null;
  const q: Quality = quality !== "valid" ? quality : ind.rainGaps > 0 ? "suspect" : "valid";
  const key = risk == null ? "unavailable" : receding ? "moderate_receding" : risk;
  const { rainGaps: _g, ...pure } = ind;
  void _g;
  return {
    tick: t,
    risk_level: risk,
    indicators: pure,
    warmup,
    receding,
    quality: q,
    rule,
    explanation: explain(pure, risk, receding, prev, everAbove, warmup),
    recommendation: { key, ...L1_RECOMMENDATION[key] },
    confidence: "not_applicable_rule_based",
  };
}
