#!/bin/bash
# Build #243 part 3 - ONLY after the owner has approved delete-list.txt. Run on dr-rke2:  bash delete.sh delete-list.txt
# Deletes exactly the recovery-point dumps named in the list (82 files, 2026-11-02..09, all but the newest of each
# day), nothing else: each name must be a plain onprem-*.dump file in ~/ndp-backups. Prints what it removed.
set -euo pipefail
cd /home/ubuntu/ndp-backups
n=0
while read -r day size name; do
  case $name in onprem-*.dump) ;; *) echo "skipped (not a recovery dump): $name"; continue;; esac
  [ -f "$name" ] || { echo "already gone: $name"; continue; }
  rm -f -- "$name"; n=$((n + 1)); echo "deleted $name"
done < "$1"
echo "deleted $n file(s)"; df -h / | tail -1
