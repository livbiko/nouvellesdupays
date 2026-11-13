#!/bin/bash
# Build #245: retention for the recovery-point dumps New-RecoveryPoint.ps1 leaves in dr-rke2:~/ndp-backups
# (onprem-*.dump, ~1 GB each, written by onprem-dump.sh). The nightly dumps in daily/ are not touched (their
# CronJob keeps 14 itself). Rule, by the UTC day in the file name:
#   - the last 3 days (today and the 2 before): keep every dump
#   - 4 to 14 days old: keep the newest dump of each day
#   - older than 14 days: delete (the nightly dumps cover those days)
#   - the newest dump overall is always kept (Invoke-Rollback.ps1 -Latest)
# The owner approves every list before anything is deleted, so this never runs on a schedule. Copy to dr-rke2:
#   bash onprem-prune-recovery.sh list > list.txt     # prints "<MB> <name>" per dump the rule would delete
#   bash onprem-prune-recovery.sh apply list.txt      # deletes exactly those, if the rule still says so
set -euo pipefail
list=$( [ -n "${2:-}" ] && realpath -- "$2" || true )   # before the cd: the list is usually in ~
cd /home/ubuntu/ndp-backups
keep_all=$(date -u -d '2 days ago' +%F)
keep_daily=$(date -u -d '13 days ago' +%F)

plan() {
  local newest; newest=$(ls -1 onprem-*.dump 2>/dev/null | sort | tail -1)
  ls -1 onprem-*.dump 2>/dev/null | sort -r | awk -v a="$keep_all" -v d="$keep_daily" -v n="$newest" '
    { day = substr($0, 8, 10) }
    $0 == n || day >= a { next }
    day < d || seen[day]++ { print }'
}

case "${1:-}" in
  list)
    plan | while read -r f; do echo "$(du -m -- "$f" | cut -f1) $f"; done ;;
  apply)
    [ -f "$list" ] || { echo "usage: $0 apply <list>"; exit 1; }
    eligible=$(plan); n=0
    while read -r size name; do
      case $name in onprem-*.dump) ;; *) echo "skipped (not a recovery dump): $name"; continue;; esac
      [ -f "$name" ] || { echo "already gone: $name"; continue; }
      grep -qxF -- "$name" <<<"$eligible" || { echo "skipped (rule keeps it now): $name"; continue; }
      rm -f -- "$name"; n=$((n + 1)); echo "deleted $name"
    done < "$list"
    echo "deleted $n file(s)"; df -h / | tail -1 ;;
  *) echo "usage: $0 list | apply <list>"; exit 1 ;;
esac
