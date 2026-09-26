# رَصد · RASD — نظام الاستجابة الفورية للكوارث الطبيعية

Real-time monitoring prototype: **sensor → ingest → classify (طبيعي / تحذير / خطر) → live dashboard → alert**.

- **Next.js 15** (App Router, standalone) + **PostgreSQL** — one process, no separate backend.
- **Live updates** with no polling: every reading triggers Postgres `NOTIFY` → one `LISTEN` connection per server → **Server-Sent Events** (`/api/stream`) → every open dashboard.
- **Saudi map**: MapLibre GL with self-hosted GeoJSON (13 administrative regions from geoBoundaries, neighbours from Natural Earth). No tile provider or API key. Regions are tinted by their worst live status, and stations are shown as pulsing markers.
- Editable per-sensor-type thresholds, alert log with acknowledgement, and a response path (رصد ← تحليل ← تنبيه ← تأكيد الاطلاع).
- A built-in **simulator** keeps the demo alive (random walk with occasional hazard surges). A sensor switches to live automatically when a real device reports for it.

## Quick start

```bash
pnpm install
cp .env.example .env.local        # set DATABASE_URL etc.
pnpm db:setup                     # schema + 12 demo stations + 1h of history (add -- --reset to reseed)
pnpm dev                          # http://localhost:3000  (login with ADMIN_USER / ADMIN_PASSWORD)
pnpm test                         # severity / escalation unit tests
```

## Sending readings (ESP32 or anything else)

```bash
curl -X POST https://rasd.alsuhaibi96.com/api/ingest \
  -H "x-device-key: $INGEST_API_KEY" -H "content-type: application/json" \
  -d '{"sensor":"WTR-01","value":85}'
# also accepted: [{"sensor":"WTR-01","value":85}, ...]  or  {"readings":{"WTR-01":85,"GAS-01":340}}
```

The response contains each reading's computed status and any alert it opened. Firmware for an ESP32 with an ultrasonic water-level sensor and an MQ-2 smoke/gas sensor is in [`firmware/esp32_rasd`](firmware/esp32_rasd/esp32_rasd.ino).

| Sensor code | Type | Station |
|---|---|---|
| WTR-01…05 | water level (cm) | حائل، الرياض، مكة، جازان، نجران |
| GAS-01/02 | smoke / gas (raw 0–4095) | أبها، الباحة |
| TMP-01/02, HUM-01 | temperature °C / humidity % | جدة، الدمام |
| PRS-01/02 | pressure hPa (danger when **low**) | الدمام، سكاكا |
| VIB-01/02 | vibration g | تبوك، حرة لونير |

## Alert rules
- A level starts when the reading **reaches** its limit (≥, or ≤ for pressure).
- An alert opens only on **escalation** (e.g. طبيعي→تحذير, تحذير→خطر). It is not repeated while that level stays open and unacknowledged for 10 minutes.
- Saving thresholds re-classifies every sensor's latest value immediately. Any resulting escalations raise alerts.

## Deploy
`deploy/deploy.sh` builds locally, rsyncs the standalone bundle to `/var/www/rasd`, runs the idempotent DB setup, and restarts `rasd.service`. The server needs `/var/www/rasd/.env` (see `.env.example`), the systemd unit `deploy/rasd.service`, and the nginx site `deploy/nginx.conf` (SSE-safe proxying).

## Map data
Rebuild with `pnpm geo:build <geoBoundaries-SAU-ADM1.geojson> <ne_50m_admin_0_countries.geojson>` (mapshaper simplification). Sources: geoBoundaries (CC BY 4.0) and Natural Earth (public domain).
