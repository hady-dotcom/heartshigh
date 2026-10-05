# Lane D proof — `artifacts/basics-admin`

Branch under test: `cursor/basics-admin-ops-dbc7`  
Draft PR: https://github.com/hady-dotcom/heartshigh/pull/33  
Base: `cursor/compass-gather-demo-ed5a`  
Never pushed to live `cursor/hearts-prototype-v1-cf40`.

## Per brief

| ID | Status | Proof |
|---|---|---|
| D01 Must | Done | `server/audit.ts`. Unit: 397 pass. Other lanes call `audit()`. |
| D02 Should | Done | Activity log desk. Playwright 7/7 including D02. Still: `d02_activity_log.png`. |
| D03 Must | Done | `docs/BACKUPS.md`, `scripts/backup.sh`, `scripts/restore-drill.sh`. Local drill matched. |
| D04 Should | Done | Retention table + nightly job. System page lists every rule. |
| D05 Should | Done | Bulk bar on Teach. Still: `d05_teach_people.png`. |
| A12 Should | Done | Playwright A12 passed. Still: `a12_people_import.png`. |
| A13 Should | Done | Playwright A13 + hostile CSV scope. |
| K03 Should | Done | Playwright K03 passed. Still: `k03_classes.png`. |
| C15 Should | Done | Separate commit. Playwright C15 restore passed. Still: `c15_recently_removed.png`. |
| D06 Should | Done | Playwright D06 passed. Still: `d06_system_health.png`. Email Off when transport off. |

## Test numbers

**Before Lane D (this checkout):** not captured — work was already on the branch.

**After Lane D, before C15:** unit 395 pass / 0 fail.

**After C15:**
- Unit: **397 pass / 0 fail**
- Lane D Playwright (`tests/e2e/basics-admin.spec.ts`): **7 pass / 0 fail** (D02, A12, A13, K03, C15, D06, hostile)
- Full suite: see `e2e-full.log` (222 tests). Added when the run finishes.

## Restore drill counts

From `restore-drill-last.json` (local SQLite fixture; no `pg_dump`/`age`/`aws` in this environment):

| | Before | After |
|---|---|---|
| users | 2 | 2 |
| answers | 2 | 2 |
| audit_log | 2 | 2 |
| files | 3 | 3 |
| ok | **true** | |

Production uses `pg_dump --format=custom`, age encryption, and a second bucket.

## Raw proof URLs

Once this orphan branch is on `origin/artifacts/basics-admin`:

- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/REPORT.md
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/restore-drill-last.json
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/e2e-basics-admin.log
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/d02_activity_log.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/k03_classes.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/a12_people_import.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/d05_teach_people.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/c15_recently_removed.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/d06_system_health.png

## Railway steps (Leon — not done here)

1. Create a **second** versioned backup bucket (`hearts-backups`).
2. On Leon’s machine: `age-keygen -o hearts-backup.key`. Only `AGE_RECIPIENT` (the `age1…` public key) goes on Railway.
3. Add a **cron service** (not the public web app) that runs `bash scripts/backup.sh` daily.
4. Variables on that cron only: `DATABASE_URL`, live bucket keys, `BACKUP_BUCKET`, `AGE_RECIPIENT`, `BACKUP_KIND=daily`.
5. Optional weekly/monthly crons. Lifecycle: daily 14 days, weekly 8 weeks, monthly 12 months.
6. `aws s3 sync` the live media bucket to the backup bucket (versioning on).
7. Point uptime at `/api/health`.

Full text: `docs/BACKUPS.md` on the PR branch. No secrets in the repo. No Railway changes from this builder.

## Integrator notes

See `docs/LANE-D-INTEGRATOR.md` on the PR.

Erase registry (`src/server/erase/`) was **not** on PF. Register:

| Collection | User wipe | Portal wipe |
|---|---|---|
| `classes` | Remove person from learners/teachers | Delete the class |
| `class-join-rules` | Nothing | Delete portal rules |
| `ops-events` | Nothing | Drop portal; keep backup rows |
| `audit-log` | `pseudonymiseAuditForUser` | Keep rows |

Wipes must `hardDelete` / `payload.delete({ trash: true })`. Trash is a 30-day grace on content only.

Lane A may add `email: emailAdapter()` to `payload.config.ts`. Merge A first if both touch that object.
