#!/usr/bin/env bash
# Installs (or reinstalls) the server's launchd jobs from ops/launchd: the web
# app, the nightly backup and the hourly health check. Run on the server, from
# anywhere; safe to run again after changing a plist.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
NODE="${NODE_BIN:-/opt/homebrew/opt/node@22/bin/node}"
[[ -x "$NODE" ]] || NODE="$(command -v node)"
PATH_VALUE="$(dirname "$NODE"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

ICLOUD="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
MIRROR=""
[[ -d "$ICLOUD" ]] && MIRROR="$ICLOUD/betteruwworks-backups"

AGENTS="$HOME/Library/LaunchAgents"
mkdir -p "$AGENTS" "$HOME/Library/Logs/betteruwworks"

for template in "$REPO"/ops/launchd/*.plist; do
  label="$(basename "$template" .plist)"
  dest="$AGENTS/$label.plist"
  sed -e "s|__REPO__|$REPO|g" \
      -e "s|__HOME__|$HOME|g" \
      -e "s|__NODE__|$NODE|g" \
      -e "s|__PATH__|$PATH_VALUE|g" \
      -e "s|__MIRROR__|$MIRROR|g" \
      "$template" > "$dest"
  plutil -lint "$dest" > /dev/null
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$dest"
  echo "installed $label"
done

echo "node: $NODE"
echo "backup mirror: ${MIRROR:-none (iCloud Drive not found)}"
