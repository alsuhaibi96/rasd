# Data model (additive and idempotent; see `db/schema.sql`)

| Table | Purpose |
|---|---|
| `stations`, `sensors`, `thresholds` | Existing. `sensors` gained `last_data_source` and `last_scenario_id`. New sensor `RAIN-01` (rainfall, mm/min, no L0 limit by design) |
| `readings` | Existing. Added `data_source` (real/simulated/test/external), `scenario_id`, `run_id`, `tick`, `quality_status`. Device rows were backfilled as `external` |
| `alerts` | Existing. Same additions. Dedup is run-scoped for scenario alerts |
| `scenario_runs` | kind (scripted/parametric), segments (parameters per tick range), engine version, ruleset, L0 limits snapshot, status, tick, speed, started_by |
| `alert_transitions` | Every L0 state change, with its previous and new value |
| `assessments` | L1 per tick: indicators, rule fired, explanation (ar/en), recommendation, input reading ids, ruleset |
| `area_assessments` | Per area per tick: risk, affected, indicators, reason, input ticks |
| `recommendations` | Spec §9.2 fields, plus `supersedes_id`, `active`, review status and reviewer |
| `plan_versions` | Snapshot, structured diff (`changes`), change reason, plan status. The version number acts as the optimistic lock |
| `events` | Append-only audit log: seq, event_id, tick, type, source, area/entity, prev, next, reason |
| `test_records` | Manual verification records (TC-11a, TC-11b, AT-24) with tester and notes |
