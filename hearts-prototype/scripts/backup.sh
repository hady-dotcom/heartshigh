#!/usr/bin/env bash
# Daily backup of the HEARTS database and file storage.
# No secrets are printed. Run from the app root (hearts-prototype) or via Railway cron.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
KIND="${BACKUP_KIND:-daily}"
DEST="${BACKUP_DIR:-$ROOT/.backups/$KIND/$STAMP}"
mkdir -p "$DEST"

echo "HEARTS backup $STAMP ($KIND) -> $DEST"

if [[ -n "${DATABASE_URL:-}" && "$DATABASE_URL" == postgres* ]]; then
  if ! command -v pg_dump >/dev/null 2>&1; then
    echo "pg_dump is not installed. On Railway, add the postgres client to the cron service. See docs/BACKUPS.md."
    exit 1
  fi
  pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-acl --file="$DEST/hearts.dump"
  echo "database: postgres custom dump"
else
  DB_FILE="${SQLITE_PATH:-$ROOT/data/hearts.db}"
  DB_FILE="${DB_FILE#file:}"
  if [[ ! -f "$DB_FILE" ]]; then
    echo "No database file at $DB_FILE and DATABASE_URL is not Postgres. Nothing to dump."
    exit 1
  fi
  sqlite3 "$DB_FILE" ".backup '$DEST/hearts.sqlite'"
  echo "database: sqlite copy"
fi

MEDIA_SRC="${MEDIA_DIR:-$ROOT/media}"
if [[ -d "$MEDIA_SRC" ]]; then
  mkdir -p "$DEST/media"
  cp -a "$MEDIA_SRC/." "$DEST/media/"
  echo "files: copied local media"
fi

if [[ -n "${S3_BUCKET:-}" || -n "${BUCKET:-}" ]]; then
  if command -v aws >/dev/null 2>&1; then
    aws s3 sync "s3://${S3_BUCKET:-$BUCKET}" "$DEST/s3" --only-show-errors
    echo "files: synced from the live bucket to the backup folder"
  else
    echo "files: aws cli is not here. The cron service should sync the live bucket to the backup bucket. See docs/BACKUPS.md."
  fi
fi

if [[ -n "${AGE_RECIPIENT:-}" ]] && command -v age >/dev/null 2>&1; then
  tar -C "$DEST" -cf - . | age -r "$AGE_RECIPIENT" > "$DEST.age"
  echo "encrypted: $DEST.age (the key is Leon's, not in this repo)"
  if [[ "${BACKUP_KEEP_PLAIN:-}" != "1" ]]; then
    rm -rf "$DEST"
  fi
elif [[ -n "${AGE_RECIPIENT:-}" ]]; then
  echo "age is not installed. The dump is still in $DEST. Install age before a live run. See docs/BACKUPS.md."
fi

if [[ -n "${BACKUP_BUCKET:-}" ]] && command -v aws >/dev/null 2>&1; then
  TARGET="${BACKUP_PREFIX:-hearts/$KIND}/$STAMP"
  aws s3 sync "${DEST}.age" "s3://$BACKUP_BUCKET/$TARGET/" --only-show-errors 2>/dev/null || aws s3 sync "$DEST" "s3://$BACKUP_BUCKET/$TARGET/" --only-show-errors
  echo "uploaded: s3://$BACKUP_BUCKET/$TARGET"
fi

echo "done"
