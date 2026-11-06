/** Bumped whenever engine behaviour changes; recorded on every run, assessment and export. */
export const ENGINE_VERSION = "1.0.0";
/** Rule set identifiers. All are Proposed scenario parameters (illustrative), not validated thresholds. */
export const RULESET = {
  l1: "L1-F03-v0.2",
  area: "AREA-v0.1",
  rank: "RANK-v0.1",
  decide: "DS-v0.1",
  plan: "PLAN-v0.1",
  route: "ROUTE-v0.1",
  whatif: "WHATIF-v0.1",
} as const;
