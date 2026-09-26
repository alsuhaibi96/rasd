#!/usr/bin/env bash
# Build locally (the server has only 2 GB RAM) and ship the standalone bundle.
# Usage: deploy/deploy.sh [user@host]   (default: root@134.209.99.9 with ~/.ssh/do-aqaraty)
set -euo pipefail
HOST="${1:-root@134.209.99.9}"
SSH="ssh -i ${SSH_KEY:-$HOME/.ssh/do-aqaraty}"
APP=/var/www/rasd

cd "$(dirname "$0")/.."
pnpm install --frozen-lockfile
pnpm build

STAGE=$(mktemp -d)
cp -r .next/standalone/. "$STAGE/"
mkdir -p "$STAGE/.next" && cp -r .next/static "$STAGE/.next/static"
cp -r public "$STAGE/public"
mkdir -p "$STAGE/db" "$STAGE/scripts" && cp db/schema.sql "$STAGE/db/" && cp scripts/db-setup.mjs "$STAGE/scripts/"

rsync -az --delete --exclude .env -e "$SSH" "$STAGE/" "$HOST:$APP/"
rm -rf "$STAGE"

$SSH "$HOST" "set -e; cd $APP; chown -R www-data:www-data $APP; set -a; . ./.env; set +a; node scripts/db-setup.mjs; systemctl restart rasd; sleep 2; systemctl is-active rasd"
echo "Deployed → https://rasd.alsuhaibi96.com"
