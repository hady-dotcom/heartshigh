# Round 3 — hang fix and clean Postgres suites

Tip: `cursor/basics-admin-ops-dbc7` @ `bb779824162311f44af56370655f41d680d225a3`  
Base compared: `cursor/portal-features-0777` @ `1ae7f2bfffffb6a2d65ed9ce8efe05ac67c9e25f`  
Draft PR: https://github.com/hady-dotcom/heartshigh/pull/33  
Same machine, leftover Next servers killed first. PF then tip, one suite at a time.

## Cause of the four isolated-double failures

Not mail, backup, retention, CSRF, or a timeout that needed raising.

Nested `payload.create({ collection: 'audit-log' })` from `staffAuditAfterChange` ran inside the parent Postgres transaction. The new `users` / `packs` row was not visible yet:

- Master REST teacher create: HTTP **500**, body `{"errors":[{"message":"Something went wrong."}]}`, server `audit_log_target_id_users_id_fk`.
- Gather-off `users` PATCH, sheet-packs `beforeAll` pack create, and `integration-final` waited on the pool until Playwright timed out.

## Fix (tip `bb77982`)

- `enqueueAudit` via `setImmediate` so the parent write can commit first.
- `audit()` swallows errors; a failed log never fails the staff write.
- Noisy fields (`onboarded`, `seenWelcome`, `sessions`, `collection`) are skipped so a simple PATCH does not enqueue a log.
- Class-join assignment after user create is also enqueued.

## Isolated reruns of the four (Postgres, twice each)

All eight runs **exit 0**.

| Run | Started (UTC) | Ended | Exit |
|---|---|---|---|
| security-1 | 07:21:06 | 07:21:36 | 0 |
| sheet-packs-1 pack column | 07:21:36 | 07:22:04 | 0 |
| portal-features-1 Gather off | 07:22:04 | 07:23:01 | 0 |
| integration-final-1 | 07:23:01 | 07:24:00 | 0 |
| security-2 | 07:24:00 | 07:24:28 | 0 |
| sheet-packs-2 pack column | 07:24:28 | 07:24:55 | 0 |
| portal-features-2 Gather off | 07:24:55 | 07:25:44 | 0 |
| integration-final-2 | 07:25:44 | 07:26:42 | 0 |

See `isolated.log`.

## Clean full Playwright on Postgres

| Suite | SHA | Passed | Failed | Skipped | Duration |
|---|---|---|---|---|---|
| PF `1ae7f2b` | `1ae7f2b` | 211 | 4 | 0 | 40.2m |
| Tip `bb77982` | `bb77982` | 219 | 3 | 0 | 37.9m |

Unit on tip: **399 pass / 0 fail**.

### PF failures (`file:line`)

1. `r5d-desks-proof.spec.ts:97:1` — r5d desk proof shots (timedOut)
2. `screenshots.spec.ts:25:1` — a week of use, so the garden has something in it (timedOut)
3. `sheet-creator.spec.ts:60:1` — the creator drafts a sheet, then a learner completes a task the imam can see (failed)
4. `view-as.spec.ts:108:3` — 43. Exit returns to where the view started and ends the session (timedOut)

### Tip failures (`file:line`)

1. `r5d-desks-proof.spec.ts:97:1` — r5d desk proof shots (timedOut)
2. `screenshots.spec.ts:25:1` — a week of use, so the garden has something in it (timedOut)
3. `sheet-creator.spec.ts:60:1` — the creator drafts a sheet, then a learner completes a task the imam can see (failed)

### NEW on tip vs PF

**none** (target: none). No isolated reruns required.

The four Round 3 titles are not in the tip failed list. Tip also passed `view-as` 43, which failed on PF in this same environment.

Logs: `e2e-pf-postgres.log`, `e2e-tip-postgres.log`, `new-failures.txt`.
