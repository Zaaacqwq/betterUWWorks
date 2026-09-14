#!/usr/bin/env bash
# Deploys what is pushed: the server pulls it, builds it and restarts the web
# app. Run from the development machine after `git push`:
#
#   ops/bin/deploy.sh
#   DEPLOY_HOST=other DEPLOY_DIR=path/from/home ops/bin/deploy.sh
#
# The server's checkout is ~/Documents/Code/betterUWWorks, on whatever branch
# it has checked out. Its web/.env.local, .env and backups/ are untracked and
# never touched. Schema changes are not applied: run the new SQL from
# web/drizzle on the server first. After an extension change, reload it in
# chrome://extensions on the server — not while a scrape is running, since the
# reload stops it.
set -euo pipefail

HOST="${DEPLOY_HOST:-mac}"
REMOTE_DIR="${DEPLOY_DIR:-Documents/Code/betterUWWorks}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"

# Only what has been pushed reaches the server; say so when that isn't everything.
[[ -z "$(git -C "$REPO" status --porcelain)" ]] || echo "note: uncommitted changes here are not deployed"
unpushed="$(git -C "$REPO" log --oneline '@{u}..' 2>/dev/null | wc -l | tr -d ' ')"
[[ "$unpushed" == "0" ]] || echo "note: $unpushed local commit(s) not pushed yet are not deployed"

ssh "$HOST" "export PATH=/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:\$PATH
  set -e
  cd '$REMOTE_DIR'
  git pull --ff-only
  echo \"deploying \$(git rev-parse --short HEAD) on \$(git rev-parse --abbrev-ref HEAD)\"
  cd web
  npm ci --no-audit --no-fund
  npm run build
  launchctl kickstart -k gui/\$(id -u)/com.betteruwworks.web
  sleep 5
  curl -fsS -m 20 -o /dev/null http://127.0.0.1:3000/privacy && echo 'web app is up'"
