# Lane D proof — `artifacts/basics-admin` (Round 2)

Branch under test: `cursor/basics-admin-ops-dbc7` @ `e451fe4`  
Draft PR: https://github.com/hady-dotcom/heartshigh/pull/33  
Base: `cursor/compass-gather-demo-ed5a`  
Compared with: `cursor/portal-features-0777` @ `1ae7f2b`  
Never pushed to live `cursor/hearts-prototype-v1-cf40`.

## Per brief

| ID | Status | Proof |
|---|---|---|
| D01 Must | Done | `server/audit.ts`. Other lanes call `audit()`. |
| D02 Should | Done | Activity in portal TZ (America/Toronto). British dates + day/month/year fields. Still: `stills/d02_activity_toronto.png`. |
| D03 Must | Done | Real Postgres + s3rver + age drill. Encrypted dump refused without the key. Log: `restore-drill-postgres.log`. |
| D04 Should | Done | Retention table + nightly job. System page lists every rule. |
| D05 Should | Done | Bulk bar on Teach. Tick in the name cell. |
| A12 Should | Done | Playwright A12 passed (sqlite + postgres Lane D). |
| A13 Should | Done | Playwright A13 + hostile CSV 403. |
| K03 Should | Done | Playwright K03 passed. |
| C15 Should | Done | Course + access code in Recently removed, 30 days left, restore course (completion lives), clock + retention empties the code. Still: `stills/c15_recently_removed_days_left.png`. |
| D06 Should | Done | System checked time in ET, not UTC. Still: `stills/d06_system_health_et.png`. |

## Test numbers

**Unit (HEAD `e451fe4`):** 398 pass / 0 fail.

**Lane D Playwright** (`tests/e2e/basics-admin.spec.ts`): **7 pass / 0 fail** on sqlite (shots) and on Postgres (inside the full branch suite).

**Full Playwright on Postgres, this branch `866211f` (222 tests, 2.0h):**
- 70 passed, 30 unexpected, 122 skipped (skipped after hook/login timeouts as the Next server exhausted RAM).
- The one assertion failure (not a timeout): `integration-r3` export log showed `GMT-4` instead of `ET`. Fixed in `8872df4` (`zonedTime` now uses the ET letter).
- The other 29 were timeouts (`waitForURL` / `page.goto` / `beforeAll` login) after the Next process grew past ~4 GB.

**Full Playwright on Postgres, PF `1ae7f2b`:** running (restarted after compass-demo hung without `process.exit(0)`; that patch is local to the worktree only). Results will be appended.

## Restore drill counts (real Postgres)

From `restore-drill-last.json` — `hearts_demo` → age → `hearts_restore`, files via s3rver:

| table / files | Before | After |
|---|---|---|
| users | 21 | 21 |
| answers | 31 | 31 |
| audit_log | 0 | 0 |
| courses | 32 | 32 |
| portals | 2 | 2 |
| access_codes | 6 | 6 |
| completions | 74 | 74 |
| lessons | 32 | 32 |
| media | 0 | 0 |
| files | 3 | 3 |
| encrypted.refusedWithoutKey | true | |
| ok | **true** | |

Log: `restore-drill-postgres.log`. The private age key is not in the repository.

## Hostile activity

On Postgres Lane D: portal admin 403 on `/api/audit-log/:leedsId` and `/api/hearts/audit.csv?portal=leeds`. Master CSV includes East London and Leeds, ISO times with offset. Learner 403 on people/audit CSV.

## Raw proof URLs

- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/REPORT.md
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/restore-drill-last.json
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/restore-drill-postgres.log
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/unit-counts.txt
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/e2e-branch-postgres.log
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/e2e-branch-failures.txt
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/d02_activity_toronto.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/d06_system_health_et.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/c15_recently_removed_days_left.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/d02_activity_log.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/c15_recently_removed.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/d06_system_health.png

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
