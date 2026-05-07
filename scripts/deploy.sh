#!/usr/bin/env bash
# Deploy Deckhand to a remote host via rsync + docker compose.
# Assumes host already has .env and nginx/certs/ in place.
#
# Usage: ./scripts/deploy.sh [host] [--url <public-url>]
#   host: SSH target (default: deckhand-dev)
#   --url: Public URL to health-check (default: https://<host>)

set -euo pipefail

HOST="deckhand-dev"
URL=""
SSH_USER="admin"

while [[ $# -gt 0 ]]; do
  case $1 in
    --url) URL="$2"; shift 2 ;;
    --user) SSH_USER="$2"; shift 2 ;;
    -*) echo "Unknown option: $1" >&2; exit 1 ;;
    *) HOST="$1"; shift ;;
  esac
done

REMOTE="${SSH_USER}@${HOST}"
URL="${URL:-https://${HOST}}"

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
red()   { printf '\033[1;31m%s\033[0m\n' "$*" >&2; }

bold "==> Verifying remote host…"
if ! ssh -o ConnectTimeout=5 "$REMOTE" "test -f ~/deckhand/.env && test -f ~/deckhand/nginx/certs/cert.pem"; then
  red "Remote ~/deckhand/.env or nginx/certs/cert.pem missing."
  red "Run scripts/generate-env.sh on the host and provision TLS certs first."
  exit 1
fi

bold "==> Rsyncing source to ${REMOTE}:~/deckhand/…"
rsync -az --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude 'nginx/certs' \
  --exclude dist \
  --exclude '*.tsbuildinfo' \
  --exclude TODO.md \
  --exclude 'PLAN-*.md' \
  --exclude 'RESEARCH-*.md' \
  --exclude .DS_Store \
  ./ "${REMOTE}:~/deckhand/"

bold "==> Rebuilding and restarting all containers…"
ssh "$REMOTE" 'cd ~/deckhand && docker compose up -d --build'

# nginx caches the app container's IP — force re-resolve after a rebuild
bold "==> Restarting nginx to refresh upstream resolution…"
ssh "$REMOTE" 'docker restart deckhand-nginx-1'

bold "==> Waiting for ${URL}/api/health…"
for i in $(seq 1 30); do
  if curl -fsS --max-time 5 "${URL}/api/health" > /dev/null 2>&1; then
    green "==> Healthy at ${URL}"
    exit 0
  fi
  sleep 2
done

red "==> Health check failed after 60s. Check logs:"
red "    ssh ${REMOTE} 'cd ~/deckhand && docker compose logs --tail 50 app'"
exit 1
