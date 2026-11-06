/**
 * RASD – Flood Scenario Specification F-03 v0.2, Section 4 (approved as illustrative values).
 * Data only: this file intentionally contains NO assessments (F-03 TC-06). Expected outputs live in
 * f03.expected.ts and are only used by tests and the Verification Center.
 */
export const F03 = {
  id: "FLOOD-F03",
  version: "0.2",
  title: { en: "Rapid Water-Level Rise After Rainfall", ar: "ارتفاع سريع لمستوى المياه بعد هطول الأمطار" },
  hazard: "flood" as const,
  station: "ST-01",
  location: { en: "Wadi Al-Adirea, Hail (virtual point of WTR-01)", ar: "وادي الأديرع، حائل (نقطة افتراضية لـ WTR-01)" },
  sensors: { level: "WTR-01", rain: "RAIN-01" },
  phases: ["A", "A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "C", "C", "C", "C", "C", "C", "C", "C", "C", "D", "D", "D", "E", "E", "E", "E", "E", "E", "E", "F", "F"],
  level: [22, 23, 22, 24, 23, 22, 23, 24, 24, 25, 27, 31, 37, 45, 54, 63, 71, 77, 82, 86, 88, 88, 86, 82, 76, 68, 58, 48, 40, 33, 28, 25],
  rain: [0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.0, 1.2, 1.2, 1.0, 1.0, 0.8, 0.8, 0.6, 0.4, 0.4, 0.2, 0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

export const PHASE_LABEL: Record<string, { en: string; ar: string }> = {
  A: { en: "Baseline", ar: "الوضع الاعتيادي" },
  B: { en: "Rainfall onset, level stable", ar: "بدء الأمطار، المستوى مستقر" },
  C: { en: "Rapid rise", ar: "ارتفاع سريع" },
  D: { en: "Peak", ar: "الذروة" },
  E: { en: "Recession", ar: "انحسار" },
  F: { en: "Return to baseline", ar: "العودة للوضع الاعتيادي" },
};
