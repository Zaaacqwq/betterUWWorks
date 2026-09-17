#!/usr/bin/env bash
# Opens Chrome so the extension's daily scrape can run, without anyone leaving
# Chrome open. Started by com.betteruwworks.scrape at the daily time.
#
# The scrape itself lives in the extension: on launch it notices the day's run
# has not been served yet (autorun.js catchUpIfOverdue) and runs a couple of
# minutes later. This script only has to make sure Chrome is running.
#
# Keep the plist's StartCalendarInterval equal to the extension's daily time
# (popup Settings → "Run every day at", default 06:00). The machine must be
# awake at that time; to wake it, run once:
#   sudo pmset repeat wakeorpoweron MTWRFSU 05:58:00
set -euo pipefail

# A short nudge so a display-asleep Mac is responsive when Chrome comes up.
/usr/bin/caffeinate -u -t 10 &

# Launch Chrome (or focus it if already running). onStartup in the extension
# fires on a cold launch and schedules the catch-up run.
/usr/bin/open -a "Google Chrome"

echo "$(date '+%Y-%m-%d %H:%M:%S') opened Chrome for the daily scrape"
