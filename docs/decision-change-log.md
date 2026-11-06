# Decision & change log

| Date | Decision | Reason |
|---|---|---|
| 2026-11-05 | One pure engine shared by the runner, What-if, verification and tests | Golden F-03 tests check the exact production code path |
| 2026-11-05 | Alert dedup scoped per run (not the 10-min wall clock) for scenario alerts | Determinism on restart (TC-03) |
| 2026-11-05 | 60/80 cm limits reclassified as a verified website configuration value | Found in the seed and editable. Not hydrologically validated |
| 2026-11-05 | ESP32 readings classified as `external`, not `real` | Spec §4.3: not operationally verified |
| 2026-11-05 | Static response cycle replaced by the live Operational Chain | Spec §1.2.8 forbids decorative status |
| 2026-11-05 | Priority alert wording changed to "simulated reading" for generated data | F-03 TC-01 |
| 2026-11-05 | Restricted actions (evacuation, road closure, team deployment) never generated | Spec: only catalog actions, human decision required |
| 2026-11-05 | What-if computed on the server over a cloned state, logged as an event only | Isolation (AT-22) with an audit trail |
| 2026-11-05 | Offline tests recorded manually, never auto-claimed | Spec honesty rule |
| 2026-11-05 | Arabic default with an English toggle. Spec-mandated labels kept verbatim in English | Audience plus spec traceability |
