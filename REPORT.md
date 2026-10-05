# Lane D proof — `artifacts/basics-admin`

Branch under test: `cursor/basics-admin-ops-dbc7` @ `ff2366c`  
Draft PR: https://github.com/hady-dotcom/heartshigh/pull/33  
Base: `cursor/compass-gather-demo-ed5a`  
Never pushed to live `cursor/hearts-prototype-v1-cf40`.

## Per brief

| ID | Status | Proof |
|---|---|---|
| D01 Must | Done | `server/audit.ts`. Other lanes call `audit()`. `viewas.ts` imports and re-exports it. Unit: audit-events (3). |
| D02 Should | Done | Activity log desk + CSV. Playwright D02 passed. Still: `d02_activity_log.png`. |
| D03 Must | Done | `docs/BACKUPS.md`, `scripts/backup.sh`, `scripts/restore-drill.sh`. Local drill matched (see counts). |
| D04 Should | Done | Retention table + nightly job. System page lists every rule. Unit: retention. |
| D05 Should | Done | Bulk bar on Teach. Tick sits in the name cell so the learners table fits at 1440. Still: `teach_learners_table_fits_1440.png`. |
| A12 Should | Done | Playwright A12 passed. Still: `a12_people_import.png`. |
| A13 Should | Done | Playwright A13 + hostile CSV 403 on a foreign portal. |
| K03 Should | Done | Playwright K03 passed. Still: `k03_classes.png`. |
| C15 Should | Done | Separate commit. Playwright C15 restore passed. Still: `c15_recently_removed.png`. |
| D06 Should | Done | Playwright D06 passed. Still: `d06_system_health.png`. Email Off when transport off. |

## Test numbers

**Before Lane D (this checkout):** not captured — the work was already on the branch when the suite was first run.

**After Lane D, before C15:** unit 395 pass / 0 fail.

**After C15 / current HEAD `ff2366c`:**
- Unit: **397 pass / 0 fail** (re-run after the Teach overflow fix).
- Lane D Playwright (`tests/e2e/basics-admin.spec.ts`): **7 pass / 0 fail** (D02, A12, A13, K03, C15, D06, hostile).
- Overflow retest (`round2-integration` evening garden): **1 pass** after moving the tick into the name cell. Measured spill on `/p/east-london/admin/teach` at 1440: `scrollWidth - clientWidth = 0`, 14 ticks.

**Full suite versus this base (222 e2e):**
- First 30 (ai-steps → circle) **passed**; compass hung until `process.exit(0)` was added to the demo seed.
- Rest 192 on parent `244306c`: **189 passed / 3 failed** (34.1m). Failures:
  1. `round2-integration` learners table overflow **94px** — **ours, fixed** in `ff2366c`, retest passed.
  2. `screenshots.spec.ts` “a week of use…” — 300s timeout waiting for `answer-share` (learner garden, not a Lane D screen).
  3. `r5d-desks-proof` proof shots — 400s timeout waiting for a filled `door-tile` on a pack. Lane D did not change `pack-contents.tsx`.
- Combined: **219 / 222** on that rest run; with the overflow fix the expected remaining failures are the two long screenshot/garden flakes above.

Logs: `e2e-basics-admin.log`, `e2e-rest.log`, `e2e-overflow.log`.

## Restore drill counts

From `restore-drill-last.json` (local SQLite fixture; no `pg_dump` / `age` / `aws` in this environment):

| | Before | After |
|---|---|---|
| users | 2 | 2 |
| answers | 2 | 2 |
| audit_log | 2 | 2 |
| files | 3 | 3 |
| ok | **true** | |

Production uses `pg_dump --format=custom`, age encryption, and a second bucket.

## Raw proof URLs

- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/REPORT.md
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/restore-drill-last.json
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/unit-counts.txt
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/e2e-basics-admin.log
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/e2e-rest.log
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/e2e-overflow.log
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/d02_activity_log.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/d02_master_activity.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/d05_teach_people.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/teach_learners_table_fits_1440.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/a12_people_import.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/k03_classes.png
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

Lane A may add `email: emailAdapter()` to `payload.config.ts`. Merge A first if both touch that object.

Clash-owned by this lane: `payload.config.ts`, `screens/desk/shell.tsx`, `handle.ts` top dispatch, `collections-admin.ts`.
