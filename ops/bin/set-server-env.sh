#!/usr/bin/env bash
# Sets one value in the server's web/.env.local and restarts the web app, so a
# secret goes from your keyboard to the server without landing in a chat, a
# file on this machine, or shell history. Run it yourself, in a terminal:
#
#   ops/bin/set-server-env.sh AUTH_GOOGLE_SECRET
#   DEPLOY_HOST=other ops/bin/set-server-env.sh NAME
set -euo pipefail

NAME="${1:-}"
HOST="${DEPLOY_HOST:-mac}"
REMOTE_ENV="${DEPLOY_DIR:-Documents/Code/betterUWWorks}/web/.env.local"

if [[ ! "$NAME" =~ ^[A-Z][A-Z0-9_]*$ ]]; then
  echo "usage: $0 NAME   (e.g. AUTH_GOOGLE_SECRET)" >&2
  exit 1
fi

read -r -s -p "Value for $NAME (hidden): " VALUE
echo
[[ -n "$VALUE" ]] || { echo "Nothing entered; left unchanged." >&2; exit 1; }
[[ "$VALUE" != *$'\n'* ]] || { echo "The value can't contain a newline." >&2; exit 1; }

# The value travels on stdin, never on a command line.
printf '%s' "$VALUE" | ssh "$HOST" "set -e; umask 077
  value=\$(cat)
  env_file=\"\$HOME/$REMOTE_ENV\"
  { grep -v '^$NAME=' \"\$env_file\" || true; printf '%s=%s\n' '$NAME' \"\$value\"; } > \"\$env_file.new\"
  mv \"\$env_file.new\" \"\$env_file\"
  launchctl kickstart -k gui/\$(id -u)/com.betteruwworks.web
  echo 'Saved $NAME on the server and restarted the web app.'"
