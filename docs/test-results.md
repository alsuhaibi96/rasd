# Test results (2026-11-05)

## Unit tests (`pnpm test`, vitest): 74 / 74 pass
- Severity and escalation (existing).
- F-03 golden tests: all 32 ticks of L0 and L1, the exact §7 explanations, §9 key-tick counters, two alerts (Warning at T15, Critical at T18), determinism (two runs produce identical outputs), What-if isolation, ranking ties, route closure and no-route, plan diff reasons, forbidden-word guard, and validation (duplicate, missing, out-of-range, wrong unit).

## In-app Verification Center (`/verification`), against persisted F-03 run #3 in dev
- **39 pass, 0 fail, 4 not tested.** Verdict: **Inconclusive** until the manual offline tests are recorded.
- Not tested, by design:
  - TC-11a / TC-11b / AT-24 (offline). These must be performed with the network disabled and recorded through the form.
  - TC-15 (AI hold-out). No AI model exists, so there is nothing to test. F-03 has never been used for training.

## Static checks
`pnpm typecheck`, `pnpm lint` and `pnpm build` are clean.

Results prove behaviour on the simulated F-03 scenario only, not real-world performance.
