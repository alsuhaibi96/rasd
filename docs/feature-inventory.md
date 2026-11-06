# Feature inventory & reconciliation (spec §1.1, §2.2–2.3)

Generated from `src/lib/audit.ts` (the same source the /system page renders). Status vocabulary follows spec §1.1.

| Feature | Where | Found in audit | Action | Status now | Notes |
|---|---|---|---|---|---|
| Live monitoring dashboard | `/` | Existing and working (generator data) | enhance | **Existing – Enhanced** | Added L1 panel, risk strip, stage toggle, active vs cumulative counters, scenario scope. |
| L0 alert engine | `src/lib/severity.ts` | Existing: single threshold, escalation-only alerts, 10-min wall-clock dedup | enhance | **Existing – Enhanced** | Reused classifier; transitions now recorded; run-scoped alerts make replays deterministic. |
| Alert history & acknowledge | `/alerts` | Existing and verified | retain | **Existing and Verified** | Ack never deletes; scenario alerts filterable by scenario_id. |
| Thresholds 60/80 cm | `/thresholds, db seed` | Found in code (seed) and editable | retain | **Existing and Verified** | Reclassified: verified website configuration value — NOT a validated hydrological threshold. Snapshotted per run. |
| Data source classification | `readings/alerts.data_source` | Only device|simulator | implement | **Implemented & tested** | real | simulated | test | external; device = external until verified. |
| Data validation | `src/engine/validate.ts` | Only finite-number check | implement | **Implemented & tested** | Completeness, type, unit, timestamp, duplicate, missing, range, source identity. |
| Replay engine | `/simulation` | Not implemented | implement | **Implemented & tested** | F-03 scripted + parametric, play/pause/resume/restart/speed, tick clock, deterministic scrubber. |
| L1 rule-based risk | `src/engine/l1.ts` | Not implemented | implement | **Implemented & tested** | F-03 rules, warm-up, recession, template explanations (exact Section 7 strings). |
| AI risk intelligence | `/system` | Not implemented (no model) | defer | **Proposed / Future** | Runtime status probe only: Not Configured. Shown disabled and labeled Proposed. |
| Saudi stations map | `/` | Existing (maplibre, local geojson) | retain | **Existing and Verified** | Works offline (no tile server). |
| Virtual areas & area risk | `/simulation` | Not implemented | implement | **Implemented & tested** | 8 virtual areas, AREA-v0.1 lag/offset association, No Data / Unaffected states. |
| Area ranking | `/simulation` | Not implemented | implement | **Implemented & tested** | RANK-v0.1 lexicographic with explicit ties. |
| Decision support | `/simulation` | Fixed text on priority alert only | implement | **Implemented & tested** | Area-linked recommendations, supersede history, review workflow. |
| Response plan + versions | `/plans` | Not implemented | implement | **Implemented & tested** | Auto-versioned on condition change, diff with reasons, optimistic locking. |
| Virtual routes & closures | `/simulation` | Not implemented | implement | **Implemented & tested** | Dijkstra on a virtual network; operator closures; no-route state. Not real navigation. |
| What-if projection | `/simulation` | Not implemented | implement | **Implemented & tested** | Flood only, 15/30 min, explicit assumptions, isolated from L0/L1. |
| Event & audit log | `/events` | Not implemented | implement | **Implemented & tested** | Append-only with prev/new/reason/source/area. |
| Response cycle strip | `dashboard` | Static decorative animation (violates §1.2.8) | replace | **Implemented & tested** | Replaced by the live Operational Chain showing each stage's real runtime status. |
| Verification Center | `/verification` | Not implemented | implement | **Implemented & tested** | Runs F-03 TC-01…17 and AT-01…25 against engine + persisted runs. |
| Offline operation | `—` | Verification Pending | complete | **Verification Pending** | Core is local (fonts self-hosted, local geojson, no external APIs). Claims only from recorded TC-11a/b runs. |
| Real sensors / real geography / forecasting | `—` | Not implemented | defer | **Proposed / Future** | R4 — outside the current commitment. |

## Stack

- **Frontend:** Next.js 15 App Router, React 19, Tailwind 4, zustand store, Recharts, MapLibre GL (local GeoJSON, no tiles)
- **Backend:** Next.js route handlers (Node), single process; SSE stream fed by pg LISTEN/NOTIFY + in-process emit
- **Database:** PostgreSQL (pg driver, idempotent schema.sql); tables: stations, sensors, readings, alerts, thresholds, scenario_runs, assessments, area_assessments, recommendations, plan_versions, alert_transitions, events, test_records
- **Engine:** src/engine — pure, deterministic, isomorphic TypeScript (server runner, What-if, Verification, unit tests)
- **Auth:** Signed cookie session (jose); all pages and APIs except login/ingest/health require it; ingest uses an API key
- **Deployment:** Standalone build shipped by deploy/deploy.sh to a 2 GB VPS; systemd + nginx + certbot
- **Secrets:** Server .env only (AUTH_SECRET, ADMIN_PASSWORD, INGEST_API_KEY); nothing secret in the client bundle
