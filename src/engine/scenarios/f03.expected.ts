/**
 * Expected outputs transcribed from F-03 v0.2 Sections 5, 6.3, 7 and 9 BEFORE implementation.
 * Used only by tests / the Verification Center — never by the engine.
 */
type R = "low" | "moderate" | "elevated" | "severe";
type A = "normal" | "warning" | "danger";
const L: R = "low", M: R = "moderate", E: R = "elevated", S: R = "severe";
const N: A = "normal", W: A = "warning", C: A = "danger";

// Section 6.3, columns: R10, rise_3 (null = n/a), RF, LR, LH, L1, L0, note
export const F03_EXPECTED: [number, number | null, 0 | 1, 0 | 1, 0 | 1, R, A, ("warm-up" | "receding" | null)][] = [
  [0.0, null, 0, 0, 0, L, N, "warm-up"],
  [0.0, null, 0, 0, 0, L, N, "warm-up"],
  [0.0, null, 0, 0, 0, L, N, "warm-up"],
  [0.0, 2, 0, 0, 0, L, N, null],
  [0.0, 0, 0, 0, 0, L, N, null],
  [0.0, 0, 0, 0, 0, L, N, null],
  [0.2, -1, 0, 0, 0, L, N, null],
  [0.6, 1, 0, 0, 0, L, N, null],
  [1.2, 2, 0, 0, 0, L, N, null],
  [2.0, 2, 1, 0, 0, M, N, null],
  [3.0, 3, 1, 0, 0, M, N, null],
  [4.0, 7, 1, 1, 1, E, N, null],
  [5.2, 12, 1, 1, 1, E, N, null],
  [6.4, 18, 1, 1, 1, E, N, null],
  [7.4, 23, 1, 1, 1, S, N, null],
  [8.4, 26, 1, 1, 1, S, W, null],
  [9.0, 26, 1, 1, 1, S, W, null],
  [9.4, 23, 1, 1, 1, S, W, null],
  [9.4, 19, 1, 1, 1, S, C, null],
  [9.0, 15, 1, 1, 1, S, C, null],
  [8.4, 11, 1, 1, 1, S, C, null],
  [7.6, 6, 1, 1, 1, E, C, null],
  [6.6, 0, 1, 0, 1, E, C, null],
  [5.4, -6, 1, 0, 1, M, C, "receding"],
  [4.4, -12, 1, 0, 1, M, W, "receding"],
  [3.4, -18, 1, 0, 1, M, W, "receding"],
  [2.6, -24, 1, 0, 1, M, N, "receding"],
  [1.8, -28, 0, 0, 1, M, N, null],
  [1.2, -28, 0, 0, 1, M, N, null],
  [0.8, -25, 0, 0, 1, M, N, null],
  [0.4, -20, 0, 0, 0, L, N, null],
  [0.2, -15, 0, 0, 0, L, N, null],
];

// Section 7, L1 explanation examples (expected exactly).
export const F03_EXPLANATIONS: Record<number, string> = {
  9: "Rainfall over the last 10 min reached 2.0 mm, at or above this scenario's 2.0 mm parameter. Water level 25 cm, stable within the 20–30 cm baseline. One indicator deviating.",
  11: "Rainfall total 4.0 mm in 10 min; level rose 7 cm in 3 min; level 31 cm is above the 30 cm baseline maximum. Three consistent indicators deviating.",
  14: "Level rose 23 cm in 3 min (at least 10) and is 54 cm (at least 50); rainfall 7.4 mm in 10 min. Rapid rise on top of Elevated conditions.",
  21: "Level 88 cm, rise slowed to +6 cm in 3 min, below the Severe rise condition; rainfall 7.6 mm in 10 min.",
  23: "Level is falling (−6 cm in 3 min) but remains 82 cm; rainfall 5.4 mm. Recession rule applied.",
  30: "Level 28 cm is back within baseline; no indicators deviating.",
};

// Section 9 key ticks: active warning, active critical, cumulative L0 alert records.
export const F03_DASHBOARD: Record<number, [number, number, number]> = {
  0: [0, 0, 0], 9: [0, 0, 0], 11: [0, 0, 0], 14: [0, 0, 0], 15: [1, 0, 1],
  18: [0, 1, 2], 21: [0, 1, 2], 23: [0, 1, 2], 26: [0, 0, 2], 30: [0, 0, 2],
};

// Section 8.3 recommendation wording (English).
export const F03_RECOMMENDATIONS: Record<string, string> = {
  low: "No action needed. Continue routine monitoring.",
  moderate: "Continue monitoring. Consider increasing monitoring frequency and verify sensor readings.",
  moderate_receding: "Water level is falling but still above baseline. Continue monitoring until it returns to baseline.",
  elevated: "Notify the authorized monitoring team, review the affected area, and verify readings.",
  severe: "Escalate to the authorized operator for a human decision. Consider predefined emergency procedures, if any exist.",
};
export const F03_FOOTER = "Decision support only. Not an official warning. Human review required. Simulated data.";
