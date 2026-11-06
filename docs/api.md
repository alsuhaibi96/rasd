# API (all routes require the session cookie except `/api/auth/login`, `/api/health` and `/api/ingest`)

| Method & path | Purpose |
|---|---|
| `GET /api/scenario` | Current run view |
| `POST /api/scenario` | Start a run. Body is `{kind:"scripted"}` or `{kind:"parametric", intensity, rate, seed}` |
| `POST /api/scenario/[run]/control` | `{action: pause, resume, restart, stop, speed, params}`. `params` applies only to parametric runs, from the next tick |
| `GET /api/scenario/[run]/export?format=html\|json` | Watermarked evidence report |
| `POST /api/recommendations/review` | `{recommendation_id, status, plan_version}`. Returns 409 if the plan version is stale |
| `POST /api/routes` | `{edge, closed}` to toggle a virtual closure, or `{target}` to set the route target area |
| `GET /api/plans?run=` | Plan versions with their diffs |
| `GET /api/events?run&type&area&source&limit` | Audit log |
| `GET /api/runs` | Previous runs |
| `POST /api/whatif` | `{horizon: 15\|30, rain: persist\|taper\|stop, damping}`. Projection only, nothing persisted |
| `GET /api/verification` | Runs every TC and AT check and returns the verdict and evidence |
| `POST /api/verification/records` | Manual record, only for TC-11a, TC-11b and AT-24 |
| `GET /api/system/status` | Computed module and capability status |
| Existing | `/api/snapshot`, `/api/stream` (SSE), `/api/ingest`, `/api/alerts/[id]/ack`, `/api/thresholds`, `/api/simulate`, `/api/sensors/[id]/readings` |
