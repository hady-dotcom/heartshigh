#!/usr/bin/env bash
# Restore the latest local backup into a scratch database and file folder, then compare counts.
# Never points at a remote production database. See docs/BACKUPS.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export HEARTS_RESTORE_OUT="${HEARTS_RESTORE_OUT:-$ROOT/.backups/restore-drill-report.json}"
exec npx --yes tsx scripts/restore-drill.ts "$@"
