#!/usr/bin/env bash
# Real restore drill: Postgres + S3-compatible storage + age encryption.
# Local only. Writes docs/restore-drill-last.json and a log. No secrets are printed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
WORK="$ROOT/.backups/postgres-drill"
LOG="${HEARTS_RESTORE_LOG:-$WORK/restore-drill.log}"
mkdir -p "$WORK/s3" "$WORK/keys" "$WORK/scratch"
exec > >(tee -a "$LOG") 2>&1

echo "HEARTS real restore drill $STAMP"

if ! command -v pg_dump >/dev/null || ! command -v age >/dev/null || ! command -v aws >/dev/null; then
  echo "Need pg_dump, age and the aws cli on this machine."
  exit 1
fi

if ! pg_isready -h 127.0.0.1 -p "${PGPORT:-5432}" >/dev/null 2>&1; then
  echo "Postgres is not accepting connections on 127.0.0.1."
  exit 1
fi

SOURCE_DB="${HEARTS_DRILL_SOURCE_DB:-hearts_demo}"
RESTORE_DB="${HEARTS_DRILL_RESTORE_DB:-hearts_restore}"
PGUSER="${PGUSER:-hearts}"
PGPASSWORD="${PGPASSWORD:-hearts-pg}"
PGHOST="${PGHOST:-127.0.0.1}"
export PGUSER PGPASSWORD PGHOST
SOURCE_URL="postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT:-5432}/${SOURCE_DB}"
RESTORE_URL="postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT:-5432}/${RESTORE_DB}"

S3_PORT="${S3_PORT:-9000}"
S3_DIR="$WORK/s3-root"
mkdir -p "$S3_DIR"
npx --yes s3rver -a 127.0.0.1 --port "$S3_PORT" --directory "$S3_DIR" --no-vhost-buckets --silent >/tmp/s3rver.log 2>&1 &
S3_PID=$!
trap 'kill $S3_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${S3_PORT}/" >/dev/null 2>&1; then break; fi
  sleep 0.3
done

export AWS_ACCESS_KEY_ID=S3RVER
export AWS_SECRET_ACCESS_KEY=S3RVER
export AWS_DEFAULT_REGION=us-east-1
export AWS_EC2_METADATA_DISABLED=true
AWS=(aws --endpoint-url "http://127.0.0.1:${S3_PORT}" --no-cli-pager)
"${AWS[@]}" s3 mb "s3://hearts-media" 2>/dev/null || true
"${AWS[@]}" s3 mb "s3://hearts-backups" 2>/dev/null || true
"${AWS[@]}" s3 mb "s3://hearts-restore-media" 2>/dev/null || true
printf 'voice-note' > "$WORK/voice-1.webm"
printf 'photo-bytes' > "$WORK/photo-1.jpg"
printf 'worksheet' > "$WORK/sheet.pdf"
"${AWS[@]}" s3 cp "$WORK/voice-1.webm" s3://hearts-media/voice-1.webm
"${AWS[@]}" s3 cp "$WORK/photo-1.jpg" s3://hearts-media/photo-1.jpg
"${AWS[@]}" s3 cp "$WORK/sheet.pdf" s3://hearts-media/sheet.pdf
FILES_BEFORE="$("${AWS[@]}" s3 ls s3://hearts-media --recursive | wc -l | tr -d ' ')"

echo "Seeding $SOURCE_DB"
DATABASE_URL="$SOURCE_URL" npx tsx src/seed/seed.ts --reset

count_table() {
  local db="$1" table="$2"
  psql --dbname="$db" -Atc "SELECT COUNT(*) FROM ${table}" 2>/dev/null || echo 0
}

TABLES=(users answers audit_log courses portals access_codes completions lessons media)
declare -A BEFORE
echo "Row counts before backup:"
for table in "${TABLES[@]}"; do
  BEFORE[$table]="$(count_table "$SOURCE_DB" "$table")"
  echo "  $table ${BEFORE[$table]}"
done
echo "  files $FILES_BEFORE"

rm -f "$WORK/keys/hearts-backup.key"
RECIPIENT="$(age-keygen -o "$WORK/keys/hearts-backup.key" 2>&1 | sed -n 's/^Public key: //p')"
if [[ ! "$RECIPIENT" =~ ^age1 ]]; then
  echo "Could not read the age public key."
  exit 1
fi
echo "age public key generated (private key stays in $WORK/keys, not the repo)"

export DATABASE_URL="$SOURCE_URL"
export S3_BUCKET=hearts-media
export S3_ACCESS_KEY_ID=S3RVER
export S3_SECRET_ACCESS_KEY=S3RVER
export S3_ENDPOINT="http://127.0.0.1:${S3_PORT}"
export S3_REGION=us-east-1
export S3_FORCE_PATH_STYLE=1
export BACKUP_BUCKET=hearts-backups
export BACKUP_ACCESS_KEY_ID=S3RVER
export BACKUP_SECRET_ACCESS_KEY=S3RVER
export BACKUP_ENDPOINT="http://127.0.0.1:${S3_PORT}"
export AGE_RECIPIENT="$RECIPIENT"
export BACKUP_KIND=daily
export BACKUP_DIR="$WORK/plain"
export BACKUP_KEEP_PLAIN=1
export AWS_ENDPOINT_URL="http://127.0.0.1:${S3_PORT}"

mkdir -p "$BACKUP_DIR"
bash scripts/backup.sh

AGE_FILE="$(ls -1t "$WORK"/plain*.age "$WORK"/*.age 2>/dev/null | head -1 || true)"
if [[ -z "${AGE_FILE}" ]]; then
  # backup.sh writes DEST.age next to the folder
  AGE_FILE="$(find "$WORK" -name '*.age' | head -1)"
fi
echo "encrypted dump: ${AGE_FILE:-none}"

UNREADABLE=0
if [[ -n "${AGE_FILE}" ]]; then
  if age -d "$AGE_FILE" >"$WORK/scratch/should-fail.bin" 2>"$WORK/scratch/age-without-key.txt"; then
    echo "ERROR: the encrypted dump opened without a key"
    UNREADABLE=0
  else
    echo "encrypted dump refused without the key:"
    cat "$WORK/scratch/age-without-key.txt"
    UNREADABLE=1
  fi
  age -d -i "$WORK/keys/hearts-backup.key" "$AGE_FILE" > "$WORK/scratch/restored.tar"
  mkdir -p "$WORK/scratch/unpacked"
  tar -C "$WORK/scratch/unpacked" -xf "$WORK/scratch/restored.tar"
fi

DUMP="$(find "$WORK" -name 'hearts.dump' | head -1)"
if [[ -z "$DUMP" ]]; then
  echo "No hearts.dump after decrypt. Looking in the plain folder."
  DUMP="$(find "$BACKUP_DIR" -name 'hearts.dump' | head -1)"
fi
echo "dump: $DUMP"

psql --dbname="$RESTORE_DB" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
pg_restore --dbname="$RESTORE_URL" --no-owner --no-acl --clean --if-exists "$DUMP" || pg_restore --dbname="$RESTORE_URL" --no-owner --no-acl "$DUMP"

if [[ -d "$WORK/scratch/unpacked/s3" ]]; then
  "${AWS[@]}" s3 sync "$WORK/scratch/unpacked/s3" s3://hearts-restore-media --only-show-errors
elif [[ -d "$BACKUP_DIR/s3" ]]; then
  "${AWS[@]}" s3 sync "$BACKUP_DIR/s3" s3://hearts-restore-media --only-show-errors
fi
FILES_AFTER="$("${AWS[@]}" s3 ls s3://hearts-restore-media --recursive | wc -l | tr -d ' ')"

COUNTS="$WORK/counts.json"
: > "$COUNTS"
echo "Row counts after restore:"
OK=1
echo '{' > "$COUNTS"
echo '  "before": {' >> "$COUNTS"
for i in "${!TABLES[@]}"; do
  table="${TABLES[$i]}"
  sep=','
  [[ "$i" -eq $((${#TABLES[@]} - 1)) ]] && sep=''
  echo "    \"${table}\": ${BEFORE[$table]}${sep}" >> "$COUNTS"
done
echo '  },' >> "$COUNTS"
echo '  "after": {' >> "$COUNTS"
for i in "${!TABLES[@]}"; do
  table="${TABLES[$i]}"
  after="$(count_table "$RESTORE_DB" "$table")"
  echo "  $table ${BEFORE[$table]} -> $after"
  [[ "${BEFORE[$table]}" == "$after" ]] || OK=0
  sep=','
  [[ "$i" -eq $((${#TABLES[@]} - 1)) ]] && sep=''
  echo "    \"${table}\": ${after}${sep}" >> "$COUNTS"
done
echo '  }' >> "$COUNTS"
echo '}' >> "$COUNTS"
echo "  files $FILES_BEFORE -> $FILES_AFTER"
[[ "$FILES_BEFORE" == "$FILES_AFTER" ]] || OK=0
[[ "$UNREADABLE" == 1 ]] || OK=0

REPORT="$ROOT/docs/restore-drill-last.json"
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs'
const counts = JSON.parse(readFileSync('$COUNTS', 'utf8'))
const files = { before: Number('$FILES_BEFORE'), after: Number('$FILES_AFTER'), matched: '$FILES_BEFORE' === '$FILES_AFTER' }
const report = {
  ok: $OK === 1,
  at: '$STAMP',
  source: '$SOURCE_DB',
  destination: '$RESTORE_DB',
  database: { before: counts.before, after: counts.after, matched: JSON.stringify(counts.before) === JSON.stringify(counts.after) },
  files,
  encrypted: { refusedWithoutKey: $UNREADABLE === 1 },
  notes: [
    'Real Postgres custom dump, age encryption, and an S3-compatible bucket on this VM.',
    'The private age key is not in the repository.',
  ],
}
writeFileSync('$REPORT', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
"

echo "report: $REPORT"
[[ "$OK" == 1 ]]
