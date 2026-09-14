#!/usr/bin/env bash
# Dumps the local database to backups/ at the repo root, so scraped postings
# and their extracted skills can be put back without scraping again.
#
#   npm run db:backup
#
# Run daily on the server by launchd (ops/launchd), which also sets:
#   BACKUP_KEEP_DAYS    delete dumps older than this many days (default: keep all)
#   BACKUP_MIRROR_DIR   also copy each dump here, e.g. a folder in iCloud Drive,
#                       so a dead disk does not take the backups with it
set -euo pipefail

CONTAINER="${PG_CONTAINER:-buw-postgres}"
DIR="$(cd "$(dirname "$0")/../.." && pwd)/backups"
FILE="$DIR/betteruwworks-$(date +%Y%m%d-%H%M%S).dump"

mkdir -p "$DIR"
docker exec "$CONTAINER" pg_dump -U buw -d betteruwworks -Fc > "$FILE"
docker exec -i "$CONTAINER" pg_restore -l < "$FILE" > /dev/null
echo "Backed up to $FILE ($(du -h "$FILE" | cut -f1))"

prune() {
  [[ -n "${BACKUP_KEEP_DAYS:-}" ]] || return 0
  find "$1" -maxdepth 1 -name 'betteruwworks-*.dump' -mtime "+$BACKUP_KEEP_DAYS" -print -delete
}

prune "$DIR"

if [[ -n "${BACKUP_MIRROR_DIR:-}" ]]; then
  mkdir -p "$BACKUP_MIRROR_DIR"
  cp "$FILE" "$BACKUP_MIRROR_DIR/"
  prune "$BACKUP_MIRROR_DIR"
  echo "Copied to $BACKUP_MIRROR_DIR"
fi
