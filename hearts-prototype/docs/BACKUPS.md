# HEARTS backups and restore

Leon (or whoever hosts the app) does these steps. The builder does not change Railway and does not put secrets in the repository.

Today the live app can lose reflections and voice notes if the database or the bucket is wiped. This page is the automatic daily backup, how long copies are kept, and how to prove a restore works.

## What is copied

1. **Postgres** — a `pg_dump --format=custom` of the whole database.
2. **S3 / the Railway bucket** — every uploaded file (voice notes, photos, worksheets).

The dump is encrypted with [age](https://github.com/FiloSottile/age) to a public key **Leon holds**. The private key never lives in this repository or on Railway.

## Retention

| Copy | Kept for |
|---|---|
| Daily | 14 days |
| Weekly (Monday dump) | 8 weeks |
| Monthly (1st of the month) | 12 months |

The backup bucket must have **versioning** on, and a **lifecycle** that matches the table.

## Railway steps (Leon)

Do this once. About twenty minutes. You will need the Railway project that already runs HEARTS.

### 1. A second bucket (off-site copy)

1. In the same Railway project (or another provider such as Cloudflare R2 or Amazon S3), click **New**, then **Bucket**.
2. Name it something like `hearts-backups`. This is **not** the live media bucket.
3. Turn **versioning** on.
4. Add a lifecycle: delete daily prefixes after 14 days, weekly after 8 weeks, monthly after 12 months. Railway’s bucket UI may only offer “delete after N days”; if so, keep 12 months and tidy weekly by hand at first.
5. Copy the backup bucket’s name, endpoint, region, access key and secret. You will paste them only into the cron service variables. Do not commit them.

### 2. An age key (Leon holds this)

On your own computer:

```bash
age-keygen -o hearts-backup.key
```

The file has a public key (`age1…`) and a private key. Put the private key in your password manager. You will need it to restore. The public key goes on Railway as `AGE_RECIPIENT`.

### 3. A cron service (not the web app)

Do **not** put backup keys on the public web service.

1. In Railway, **New** → **Empty Service** (or GitHub, same repo, same root `hearts-prototype`).
2. Set the start command to:

```bash
bash scripts/backup.sh
```

3. Schedule it daily (Railway cron, or a second service that sleeps). A second weekly run with `BACKUP_KIND=weekly` and a monthly run with `BACKUP_KIND=monthly` is ideal. If you can only have one cron, daily is enough; the script still writes a dated folder.
4. Variables on **this cron service only**:

| Variable | What to put |
|---|---|
| `DATABASE_URL` | Reference the **same** Postgres as the app (`${{Postgres.DATABASE_URL}}`). |
| `S3_BUCKET` / `BUCKET` | The **live** media bucket (to copy from). |
| `S3_ACCESS_KEY_ID` / `ACCESS_KEY_ID` | Live bucket key. |
| `S3_SECRET_ACCESS_KEY` / `SECRET_ACCESS_KEY` | Live bucket secret. |
| `S3_ENDPOINT` / `ENDPOINT` | Live bucket endpoint. |
| `S3_REGION` / `REGION` | Live bucket region. |
| `BACKUP_BUCKET` | The **backup** bucket name. |
| `BACKUP_ACCESS_KEY_ID` | Backup bucket key (if different). |
| `BACKUP_SECRET_ACCESS_KEY` | Backup bucket secret (if different). |
| `BACKUP_ENDPOINT` | Backup bucket endpoint (if different). |
| `AGE_RECIPIENT` | Leon’s `age1…` public key. |
| `BACKUP_KIND` | `daily` (or `weekly` / `monthly` on those crons). |
| `BACKUP_PREFIX` | `hearts` is fine. |

5. The cron image needs `pg_dump`, `age` and the AWS CLI (or `rclone`). A small Dockerfile that starts `FROM postgres:16` and installs `age` and the AWS CLI is enough. Do not add these to the public web image unless you must.

### 4. S3-to-S3 file copy

If the cron cannot pull every object down, add one line that copies the live bucket to the backup bucket:

```bash
aws s3 sync s3://$S3_BUCKET s3://$BACKUP_BUCKET/media/ --only-show-errors
```

Keep versioning on the backup bucket so a bad sync does not destroy yesterday.

### 5. Uptime on `/api/health`

The health page is already at `/api/health`. Point Railway’s health check, or a cheap uptime monitor, at `https://YOUR-APP/api/health`. If you want an email when it fails, use the monitor’s own mail — do not put Leon’s mailbox password in the app.

Error tracking (Sentry or similar) is optional. If you add it later: **no request bodies, no cookies**, matching `lib/log.ts`.

## Restore (when something is wrong)

1. Create a **new** Postgres and a **new** bucket. Never restore over the live ones until you have checked the drill.
2. Download the latest `*.age` from the backup bucket.
3. Decrypt with Leon’s private key:

```bash
age -d -i hearts-backup.key hearts-YYYY-MM-DD.age > hearts.dump
```

4. Restore Postgres:

```bash
pg_restore --dbname="$NEW_DATABASE_URL" --no-owner --no-acl --clean --if-exists hearts.dump
```

5. Copy files into the new bucket (`aws s3 sync backup/media s3://new-bucket`).
6. Point a **staging** app at the new database and bucket. Open `/api/health`. Sign in. Check a known learner’s workbook and one voice note.
7. Only then, if you mean to, switch the live app’s `DATABASE_URL` and bucket variables.

## Monthly restore drill

On a laptop, from `hearts-prototype`:

```bash
bash scripts/restore-drill.sh
```

This builds a small fixture, backs it up, restores into `.backups/scratch`, and writes `docs/restore-drill-last.json` with row counts and file counts. It **refuses** a remote `DATABASE_URL`.

After a live drill, record it on the master desk **System** page (or `POST /api/hearts` with `action=ops-record`, `kind=restore`, `ok=yes`). The System page shows the last good drill.

## What the builder already did

- `scripts/backup.sh` — dump, optional age, optional upload.
- `scripts/restore-drill.sh` — local proof with counts.
- `scripts/retention.ts` — nightly clean-up (watch sessions, old audit rows, IP hashes). Railway can cron `npx tsx scripts/retention.ts` on a private service.
- Master desk → **System** (In-depth) shows database, storage, email, last backup and last drill.

## Do not

- Do not commit dumps, `.age` files, or `hearts-backup.key`.
- Do not reuse the old Guide Education habit of putting SQL dumps in the git repo.
- Do not run `pg_restore` against the live database as a first try.
