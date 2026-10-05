# Lane D proof — `artifacts/basics-admin` (Round 3)

Branch under test: `cursor/basics-admin-ops-dbc7` @ `bb779824162311f44af56370655f41d680d225a3`  
Draft PR: https://github.com/hady-dotcom/heartshigh/pull/33  
Base: `cursor/compass-gather-demo-ed5a`  
Compared with: `cursor/portal-features-0777` @ `1ae7f2b`  
Never pushed to live `cursor/hearts-prototype-v1-cf40`.

## Round 3

Nested `audit_log` inserts from `afterChange` raced the uncommitted `users`/`packs` row on Postgres (FK 500 or pool hang). Audit and class-join writes are now enqueued after commit; audit errors never fail the staff write; noisy onboarding PATCH fields are skipped.

**Isolated (the four, twice each, Postgres):** 8/8 exit 0.

**Clean full Playwright on Postgres** (leftover servers killed; PF then tip):

| Suite | Passed | Failed | Skipped | Duration |
|---|---|---|---|---|
| PF `1ae7f2b` | 211 | 4 | 0 | 40.2m |
| Tip `bb77982` | 219 | 3 | 0 | 37.9m |

**NEW on tip vs PF:** none (target: none).

Shared failures (not new): `r5d-desks-proof.spec.ts:97:1`, `screenshots.spec.ts:25:1`, `sheet-creator.spec.ts:60:1`. PF also failed `view-as.spec.ts:108:3`; tip passed it.

Unit: **399 / 0**. Detail: `round3/REPORT.md`.

## Per brief

| ID | Status | Proof |
|---|---|---|
| D01 Must | Done | `server/audit.ts`. Other lanes call `audit()`. |
| D02 Should | Done | Activity in America/Toronto. British dates. Day/month/year fields. Still: `stills/d02_activity_toronto.png`. |
| D03 Must | Done | Real Postgres + s3rver + age. Encrypted dump refused without the key. `restore-drill-postgres.log`. |
| D04 Should | Done | Retention table + nightly job. |
| D05 Should | Done | Bulk bar on Teach. Tick in the name cell. |
| A12 Should | Done | Playwright A12 passed. |
| A13 Should | Done | Playwright A13 + hostile CSV 403. |
| K03 Should | Done | Playwright K03 passed. |
| C15 Should | Done | Course + access code, 30 days left, restore course (completion lives), clock + retention empties the code. Still: `stills/c15_recently_removed_days_left.png`. |
| D06 Should | Done | System checked time in ET, not UTC. Still: `stills/d06_system_health_et.png`. |

## Test numbers

**Unit (`e451fe4`):** 398 pass / 0 fail.

**Lane D Playwright** (`basics-admin.spec.ts`): **7 / 7** on sqlite and on Postgres.

**Full Playwright on Postgres**

| Suite | Passed | Failed | Skipped | Duration |
|---|---|---|---|---|
| This branch `866211f` | 70 | 30 | 122 | 2.0h |
| PF `1ae7f2b` | 211 | 3 | 1 | 36.9m |

The first branch run ran out of RAM (leftover :3000 Next + 4 GB e2e server). Most of the 30 were login/`waitForURL` timeouts after that.

**New on this branch vs PF (28 titles).** Isolated reruns, twice each, on Postgres:

- **24 passed twice**, including the only assertion failure (`GMT-4` vs `ET`, fixed in `8872df4`).
- **4 still failed both tries:**
  1. `integration-final` — 240s timeout
  2. `portal-features` Gather off — 180s timeout on `users` PATCH
  3. `security` — master REST create of a teacher returned not-ok
  4. `sheet-packs` pack column — `beforeAll` 180s timeout

Shared with PF (not new): `r5d` desk proof shots; screenshots garden week. PF-only: sheet-packs push-to-existing-learners.

Logs: `e2e-branch-postgres.log`, `e2e-pf-postgres.log`, `reruns.log`, `rerun-summary.txt`.

## Restore drill (real Postgres)

`hearts_demo` → age → `hearts_restore`, files via s3rver:

| | Before | After |
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

## Hostile activity

Portal admin 403 on `/api/audit-log/:leedsId` and `/api/hearts/audit.csv?portal=leeds`. Master CSV includes East London and Leeds, ISO times with offset. Learner 403 on people/audit CSV. Passed on Postgres.

## Raw proof URLs

- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/REPORT.md
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/restore-drill-last.json
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/restore-drill-postgres.log
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/unit-counts.txt
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/e2e-branch-postgres.log
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/e2e-pf-postgres.log
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/reruns.log
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/rerun-summary.txt
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/d02_activity_toronto.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/d06_system_health_et.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-admin/stills/c15_recently_removed_days_left.png

## Railway steps (Leon — not done here)

1. Second versioned bucket `hearts-backups`.
2. `age-keygen` on Leon’s machine. Only `AGE_RECIPIENT` goes on Railway.
3. Cron service runs `bash scripts/backup.sh` daily.
4. Cron vars: `DATABASE_URL`, live bucket keys, `BACKUP_BUCKET`, `AGE_RECIPIENT`, `BACKUP_KIND=daily`.
5. Optional weekly/monthly. Lifecycle: daily 14d, weekly 8w, monthly 12m.
6. `aws s3 sync` live media to the backup bucket.
7. Uptime at `/api/health`.

Full text: `docs/BACKUPS.md`. No secrets. No Railway changes from this builder.

## Integrator notes

See `docs/LANE-D-INTEGRATOR.md`. Erase registry was not on PF. Register `classes`, `class-join-rules`, `ops-events`, `audit-log`. Wipes must hard-delete (`payload.delete({ trash: true })`).
