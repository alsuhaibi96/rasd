# Architecture

```
            ┌──────────── src/engine (pure, deterministic, isomorphic) ────────────┐
 scenario → │ validate → L0 → L1 → areas(AREA) → rank → decide → plan → routes      │ → EngineState
            │                          whatif (sandbox copy, never writes state)    │
            └───────────────────────────────────────────────────────────────────────┘
                 ▲ used by                 ▲                    ▲               ▲
       server runner              /api/whatif         Verification     vitest + client
   (src/lib/scenario/runner.ts)                       Center           review scrubber
         │ 1 DB transaction per tick
         ▼
 PostgreSQL ── NOTIFY (≤8 KB) / emitLocal (large) ──► /api/stream (SSE) ──► zustand store ──► UI
```

- **One engine.** Every consumer (server runner, What-if, Verification Center, tests, client review mode) calls the same `step()`. The F-03 golden tables are therefore checked against the exact code that runs in production.
- **Determinism.** The engine makes no wall-clock or random calls. Parametric runs use a seeded PRNG (mulberry32). Event ids (`EV-00001`) and simulated time (T00 + n min) are run-scoped. Restarting a run reproduces byte-identical outputs (TC-03, AT-07).
- **Replay isolation.** While a run is active, the background generator is paused. Dashboard counters switch to scenario scope, and a separate cumulative alert-log count is shown.
- **Runner.** A singleton stored on `globalThis`. It ticks at speed 0.5–8×, persists readings, alerts, assessments, area assessments, recommendations, plan versions and events in one transaction, then publishes a `run` event. On boot, runs left `running` are marked `interrupted` and are never silently resumed.
- **Single-process assumption.** `emitLocal` delivers payloads larger than the 8 KB NOTIFY limit in-process. That is correct for the single systemd process used here. Scaling horizontally would need payloads to move to a table and be referenced by id.
- **What-if** runs on the server over a cloned state and returns its result. Nothing is persisted except a `whatif_executed` audit event. L0 and L1 state are untouched (TC-12, AT-22).
- **i18n**: the `rasd_lang` cookie drives `<html lang dir>`, and `useTr()` / `useL()` pick the string. Spec-mandated labels stay in English verbatim.
