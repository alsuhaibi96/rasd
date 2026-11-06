# Rule sets. All parameters are **Proposed / illustrative scenario values**, not validated thresholds

## L0 (existing, reused)
Water level: Warning ≥ 60 cm, Critical ≥ 80 cm. These are website configuration values, snapshotted per run. An alert opens on escalation only. "Critical" exists only in L0.

## L1-F03-v0.2 (F-03 §3, §6)
- `rise_3` = level(t) − level(t−3). `R10` = sum of rainfall over the last 10 minutes.
- RF: `R10 ≥ 2.0 mm`. LR: `rise_3 ≥ 5 cm`. LH: level > 30 cm (baseline maximum).
- Rules, applied in order:
  - **R1 Severe**: ≥2 indicators, `rise_3 ≥ 10`, and level ≥ 50.
  - **R2 Elevated**: ≥2 indicators and not falling.
  - **R3 Moderate**: ≥2 indicators but falling (recession rule), or exactly 1 indicator.
  - **R4 Low**: otherwise.
- Warm-up T00–T02: `rise_3` is not computable. Confidence: *not applicable – rule-based*.
- Explanations come from templates filled only with logged values (exact §7 strings). "Severe" exists only in L1.

## AREA-v0.1: virtual area association
Each area has `lag_ticks` and `elevation_offset_cm`. Its effective level is level(t − lag) − offset, and the L1 rules are applied to it (rainfall is shared). Insufficient history gives **No Data**. Areas with no hydraulic link (AR-08) are **Unaffected**. An area is "affected" when its effective level exceeds 30 cm.

| Area | Exposure | Lag (min) | Offset (cm) |
|---|---|---|---|
| AR-01 Wadi Bank District | residential | 0 | 0 |
| AR-02 Al-Adirea Farms | farmland | 1 | 5 |
| AR-03 Wadi Crossing | road | 2 | 10 |
| AR-04 Health Center Zone | critical facility | 3 | 20 |
| AR-05 South Residential | residential | 4 | 15 |
| AR-06 Low Farmland | farmland | 5 | 0 |
| AR-07 School & Services | critical facility | 6 | 45 |
| AR-08 Northern Highlands | residential | — (unlinked) | — |

## RANK-v0.1
Lexicographic ordering with no weights: risk ↓, then exposure ↓ (critical facility > residential > road > farmland), then lag ↑. Full equality is shown as **Tie**.

## DS-v0.1: decision catalog
Severe → Escalate + Prepare. Elevated → Notify. Moderate → Verify (or Monitor when receding). Low → Monitor. No Data → Verify.
Every recommendation ends with the mandatory footer. A forbidden-word guard blocks evacuate, predict, forecast and official warning. Evacuation, real road closure and team deployment are **never generated**. They are listed as requiring expert approval.

## PLAN-v0.1
A new plan version is created when an area's risk changes, the affected set changes, priorities are re-ranked, or a road is closed or opened. The diff kinds are `risk`, `priority`, `added`, `withdrawn` ("no longer suitable") and `route`, each with a reason. An approval carries forward only while the action is unchanged.

## ROUTE-v0.1
Dijkstra over a virtual road network (OPS, A1–A8, K1–K4, S1–S3). Segments can be closed only by the operator. The engine can flag a segment "at risk (virtual)" but never closes it. When no path exists the result is "No alternative route in virtual network".

## WHATIF-v0.1 (flood only; not a forecast)
`rain(k+1)`: persist keeps the current value, taper subtracts 0.1 (floor 0), stop sets it to 0.
`Δ(k+1) = damping·Δ(k) + 4·(rain − 0.5)`, and the level is clamped between 22 and 200 cm. `Δ(0)` is the mean change per minute over the last 3 minutes.
