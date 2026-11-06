# Deploy

```bash
deploy/deploy.sh   # builds locally → rsync standalone to root@134.209.99.9:/var/www/rasd → db-setup (idempotent migrations) → systemctl restart rasd
```
- Never build on the server (2 GB VPS).
- Secrets live only in `/var/www/rasd/.env` (`DATABASE_URL`, `AUTH_SECRET`, `ADMIN_USER`, `ADMIN_PASSWORD`, `INGEST_API_KEY`). Optional: `AI_MODEL_PATH`.
- systemd unit: `deploy/rasd.service`. nginx: `deploy/nginx.conf` (SSE-safe, buffering off).
- Migrations are additive (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`). `db-setup` also adds RAIN-01 and marks stale running runs as interrupted.
- Smoke test: `systemctl is-active rasd`, `/api/health`, log in, start F-03, then open `/verification`.
