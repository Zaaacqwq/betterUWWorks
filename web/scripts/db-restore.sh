#!/usr/bin/env bash
# Replaces the local database's contents with a dump made by db-backup.sh.
# Everything written since that dump is lost, so it asks first.
#
#   npm run db:restore -- ../backups/betteruwworks-YYYYMMDD-HHMMSS.dump
set -euo pipefail

CONTAINER="${PG_CONTAINER:-buw-postgres}"
FILE="${1:-}"

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: npm run db:restore -- <path to .dump file>" >&2
  echo "Backups: $(cd "$(dirname "$0")/../.." && pwd)/backups" >&2
  exit 1
fi

read -r -p "Replace the local database with $FILE? Everything since then is lost. [y/N] " answer
[[ "$answer" == "y" || "$answer" == "Y" ]] || { echo "Cancelled."; exit 1; }

docker exec -i "$CONTAINER" pg_restore -U buw -d betteruwworks --clean --if-exists --no-owner < "$FILE"
docker exec "$CONTAINER" psql -U buw -d betteruwworks -At \
  -c "select count(*) || ' jobs, ' || count(ai_skills) || ' with skills' from jobs"
