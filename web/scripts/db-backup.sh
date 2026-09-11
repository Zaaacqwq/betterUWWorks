#!/usr/bin/env bash
# Dumps the local database to backups/ at the repo root, so scraped postings
# and their extracted skills can be put back without scraping again.
#
#   npm run db:backup
set -euo pipefail

CONTAINER="${PG_CONTAINER:-buw-postgres}"
DIR="$(cd "$(dirname "$0")/../.." && pwd)/backups"
FILE="$DIR/betteruwworks-$(date +%Y%m%d-%H%M%S).dump"

mkdir -p "$DIR"
docker exec "$CONTAINER" pg_dump -U buw -d betteruwworks -Fc > "$FILE"
docker exec -i "$CONTAINER" pg_restore -l < "$FILE" > /dev/null
echo "Backed up to $FILE ($(du -h "$FILE" | cut -f1))"
