#!/usr/bin/env bash
# Hourly, from launchd (ops/launchd/com.betteruwworks.health.plist): tells the
# owner's phone when the site is down or the daily scrape has stopped
# arriving. Each problem is reported once every ALERT_EVERY_HOURS rather than
# every hour it lasts, and again straight away if it clears and comes back.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$REPO/web/.env.local"
STATE_DIR="$HOME/Library/Application Support/betteruwworks"
CONTAINER="${PG_CONTAINER:-buw-postgres}"
STALE_HOURS="${STALE_HOURS:-30}"
ALERT_EVERY_HOURS="${ALERT_EVERY_HOURS:-6}"

env_value() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2-; }
NTFY_TOPIC="$(env_value NTFY_TOPIC)"
# src/proxy.ts turns away anything without an Access login or the API key.
API_KEY="$(env_value API_KEY)"
mkdir -p "$STATE_DIR"

# alert <key> <title> <message> — messages are fixed text, never quoted input.
alert() {
  local stamp="$STATE_DIR/alert-$1"
  if [[ -f "$stamp" ]] && (( $(date +%s) - $(stat -f %m "$stamp") < ALERT_EVERY_HOURS * 3600 )); then
    return 0
  fi
  touch "$stamp"
  echo "$(date '+%F %T') ALERT $2: $3"
  [[ -n "$NTFY_TOPIC" ]] || return 0
  curl -fsS -m 15 https://ntfy.sh -H 'Content-Type: application/json' \
    -d "$(printf '{"topic":"%s","title":"%s","message":"%s","priority":4,"tags":["warning"]}' "$NTFY_TOPIC" "$2" "$3")" \
    > /dev/null || echo "$(date '+%F %T') could not reach ntfy"
}
clear_alert() { rm -f "$STATE_DIR/alert-$1"; }

if curl -fsS -m 15 -o /dev/null -H "x-api-key: $API_KEY" http://127.0.0.1:3000/api/me; then
  clear_alert web
else
  alert web "betterUWWorks is down" "The web app on the Mac mini is not answering. Logs: ~/Library/Logs/betteruwworks/web.log"
fi

if hours="$(docker exec "$CONTAINER" psql -U buw -d betteruwworks -At \
  -c "select coalesce(floor(extract(epoch from now() - max(updated_at)) / 3600), 9999)::int from jobs" 2>/dev/null)"; then
  clear_alert db
  if (( hours > STALE_HOURS )); then
    alert stale "WaterlooWorks sync is overdue" "No postings have synced for ${hours} hours. Check the extension popup on the Mac mini."
  else
    clear_alert stale
  fi
else
  alert db "betterUWWorks database is unreachable" "docker exec into ${CONTAINER} failed. Is Docker running on the Mac mini?"
fi

# The embedding model (web/src/lib/line-check/embed.ts) lives on the external
# Data drive; if the drive isn't mounted, Ollama is up but has no model. The
# site keeps working without it, only finding lines by name after a skill edit.
EMBED_MODEL="$(env_value EMBED_MODEL)"
EMBED_MODEL="${EMBED_MODEL:-qwen3-embedding:8b}"
if curl -fsS -m 10 http://127.0.0.1:11434/api/tags 2>/dev/null | grep -q "\"$EMBED_MODEL\""; then
  clear_alert embed
else
  alert embed "Embedding model unavailable" "Ollama on the Mac mini is not serving ${EMBED_MODEL}. Is Ollama running and the Data drive mounted?"
fi
