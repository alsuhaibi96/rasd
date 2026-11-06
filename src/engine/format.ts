/** Formats a number like the F-03 tables: integers without decimals, otherwise one decimal. */
export function n(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
/** Signed with a real minus sign (U+2212) for negatives, optional plus for positives. */
export function signed(v: number, plus = false): string {
  if (v < 0) return "−" + n(-v);
  return (plus ? "+" : "") + n(v);
}
export const mm = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
/** Rounds away float noise from window sums (0.1 + 0.2 …). */
export const round3 = (v: number) => Math.round(v * 1000) / 1000;
