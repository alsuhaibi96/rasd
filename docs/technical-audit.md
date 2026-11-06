# Technical audit (spec §2.1, AT-01)

The audit covers the prototype as of commit `6e85d31`, before the RASD-DEV-001 work. Every finding below was checked in code, not inferred from the UI.

| Area | Finding at audit | Evidence |
|---|---|---|
| Stack | Next.js 15 App Router, React 19, Tailwind 4, zustand, Recharts, MapLibre GL, `pg`, jose | `package.json` |
| Data flow | Reading → `ingestReadings` → classify → `NOTIFY` → SSE → store | `src/lib/ingest.ts`, `src/lib/realtime.ts` |
| Data sources | Only `device` / `simulator`. No `data_source`, `scenario_id`, `quality_status` | `db/schema.sql` |
| L0 alerts | `classify()` / `isEscalation()`. Alerts open on escalation only, with a 10-min **wall-clock** dedup, so replays were not deterministic | `src/lib/severity.ts`, `src/lib/repo.ts` |
| 60/80 cm limits | **Found in code**: seeded in `scripts/db-setup.mjs` and editable on /thresholds. Classed as a *verified website configuration value*, not a validated hydrological threshold | `THRESHOLDS.water_level` |
| L1 / AI / areas / ranking / recommendations / plan / routes / what-if / event log / replay | Not implemented | — |
| "Response cycle" strip | Static decorative animation. Violates §1.2.8 | `components/dashboard/response-cycle.tsx` (removed) |
| Priority alert | Called every reading "قراءة حية" (live reading), including generated data. Violates F-03 TC-01 | `components/dashboard/priority-alert.tsx` |
| Map | Local GeoJSON with no tile server, so it works offline | `public/geo/*` |
| Fonts | `next/font`, self-hosted at build time | `src/app/layout.tsx` |
| Auth | Signed cookie, middleware-protected. Ingest uses an API key | `src/middleware.ts` |
| Tests | Severity unit tests only | `src/lib/severity.test.ts` |

## Reconciliation decisions
- **Reused** (not duplicated): L0 classifier, alert table and acknowledge flow, realtime channel, sensor table, trend chart, thresholds page and map.
- **Enhanced**: alerts now carry `data_source`, `scenario_id`, `run_id` and `tick`. Dedup is scoped per run. The dashboard gained L1, active vs cumulative counters, a stage toggle and source tags.
- **Replaced**: the static response cycle is now the live Operational Chain, built from real runtime state.
- **New**: everything else, listed in `feature-inventory.md`.
