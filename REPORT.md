# HEARTS second-merge — `artifacts/integration-basics`

Branch under test: `cursor/integration-basics` @ `ac8f25b18c3d072fab547f2f4514aa4cd497821f`  
Draft PR: https://github.com/hady-dotcom/heartshigh/pull/41  
Base: `cursor/compass-gather-demo-ed5a` @ `9d4c0a07`  
Never pushed to live `cursor/hearts-prototype-v1-cf40`.  
Did not touch first-merge `cursor/integration-r5`.

## Merge order (PR heads)

| Order | PR | Branch | Tip |
|---|---|---|---|
| 1 | #35 | `cursor/basics-accounts-8207` | `36daa0a` |
| 2 | #34 | `cursor/basics-legal-0004` | `d6bdbe4` |
| 3 | #33 | `cursor/basics-admin-ops-dbc7` | `bb77982` |
| 4 | #36 | `cursor/talk-extracts-density-db78` | `506b1c4` |
| 5 | #31 LAST | `cursor/delete-and-wipe-3855` | `7234e60` |

`--no-ff` merge commits: `8cc4ab6` → `faa1253` → `c219978` → `c30ae1a` → `7aab908`.

## Hard rules kept

- Tab bar is always Home · Lanes · My week · Garden · Me (`learnerBar()`). Gather does not take the middle slot. See `stills/legal/still-search.png`.
- Captions stay the timed spoken line over a speaker.
- Evening garden teal `#0E2A2B` / gold `#D4A84B`. Cream join cards left alone.
- CSRF stays on in production (`payloadCsrf` ignores `HEARTS_E2E` when `NODE_ENV=production`).
- Consent grandfathering: seeded learners get `grantCurrentConsents`; new joiners hit `/consent` once.
- `db:orphans` is read-only unless `--fix`. Integration: quiet when later-PR tables are missing.
- Times: portal zone (Toronto / ET on the demo Activity log). British dates (`5 October 2026`).
- Single wipe path: `eraseUser` → `wipeUser` once. Accounts 14-day delete calls `eraseUser`. No second wipe.
- Proof lives on this orphan branch only.

## Ownership after conflicts

- Accounts owns Users email / 2FA / confirm / 14-day delete.
- Admin-ops owns `audit_log` and Recently removed.
- Delete-and-wipe owns `wipeUser`. Classes unlink through `classes_rels.users_id`.
- Migrations kept unique timestamps: portal_features → talk_extracts → admin_ops → accounts → trash (`021000`) → consent → erase_cascades (`130`) → erase_parent_cascades (`131`) → erase_s3_retries (`132`).

## Suite

**tsc:** clean (`TSC:0`).

**Unit:** 520 pass / 0 fail / 1 skip.

**Integration wipe (Postgres `hearts_erase`):** 5 / 5.

**Walks + hostile isolated (Postgres `hearts_e2e`):** 23 passed / 1 failed on `95797c0` (legal transcript raced the compass overview). Fixed in `ac8f25b`; that spec passed on the full tip run. Includes:

- forgot-password → reset mail catcher (`account-reset`, `account-proof`)
- consent gate once (`legal-consent`, `legal-stills`, `legal-walk`)
- Activity log Toronto / British dates (`basics-admin` D02)
- Recently removed restore (`basics-admin` C15)
- admin wipe dialog with real counts (`delete-wipe` seeded Maryam / East London)
- talk-extracts admin timeline with nested hors + learner feed (`talk-extracts`)
- hostile: portal admin cannot read another portal’s audit (`basics-admin`)
- hostile: learner B cannot wipe another learner (`delete-wipe`)

**Full Playwright on Postgres** (`ac8f25b`, `hearts_e2e`, log `logs/e2e-postgres-full.log`):

| Suite | Passed | Failed | Did not run | Duration |
|---|---|---|---|---|
| Tip `d482850` (pre last e2e fixes) | 260 | 13 | 3 | 49.1m |
| Walks `95797c0` | 23 | 1 | 0 | 3.3m |
| Tip `ac8f25b` full | **272** | **5** | 0 | **50.3m** |

**NEW on tip vs compass-gather base: none.**

Shared / flake (not introduced by this merge):

1. `tests/e2e/feed-polish.spec.ts:148` — Home Your plan heading contrast on the teal card
2. `tests/e2e/screenshots.spec.ts:33` — garden week-of-use timeout
3. `tests/e2e/r5d-desks-proof.spec.ts:97` — r5d desk proof shots (400s timeout on `door-tile`)
4. `tests/e2e/round4.spec.ts:319` — Still open workbook `open-question` missing
5. `tests/e2e/opening.spec.ts:511` — help contact; Next server restarted on memory mid-suite (`Server is approaching the used memory threshold`). Isolated rerun: **1 passed (49.3s)** (`logs/e2e-opening-511-isolated.log`)

Merge-induced failures that were fixed on this branch (not present on the tip):

- wipe `classes_rels` (`teachers_id` does not exist)
- join form required `join-consent`
- two `delete-account` test ids on `?account=delete`
- legal footer counted as door links
- duplicate `part-label` in the course player
- wipe / account e2e hitting `/consent` without a grant
- wipe `seedWork` replacing Maryam’s `courseList` (emptied later salah search)
- legal transcript spec racing the compass course overview

## Walks (stills)

| Walk | Still / film |
|---|---|
| Forgot → reset mail | `stills/accounts/01-forgot-notice.png`, `02-email-reset.png`, `email-reset.html` |
| Consent once | `stills/legal/still-consent.png`, `still-after-consent.png`, `video/legal-walk-join-consent-search.webm` |
| Search snippet + tab bar | `stills/legal/still-search.png` |
| Activity log Toronto | `stills/admin/d02_activity_toronto.png` |
| Recently removed | `stills/admin/c15_recently_removed_days_left.png` |
| Admin wipe counts | `stills/wipe/admin-seeded-learner-summary.png`, `video/wipe-seeded-counts.webm` |
| Talk-extracts timeline | `stills/talk-extracts/admin-timeline.png` |
| Learner feed | `stills/talk-extracts/learner-feed.png` |

## Raw URLs

Prefix: `https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-basics/`

- [REPORT.md](https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-basics/REPORT.md)
- [stills/accounts/01-forgot-notice.png](https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-basics/stills/accounts/01-forgot-notice.png)
- [stills/accounts/02-email-reset.png](https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-basics/stills/accounts/02-email-reset.png)
- [stills/legal/still-consent.png](https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-basics/stills/legal/still-consent.png)
- [stills/legal/still-search.png](https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-basics/stills/legal/still-search.png)
- [stills/admin/d02_activity_toronto.png](https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-basics/stills/admin/d02_activity_toronto.png)
- [stills/admin/c15_recently_removed_days_left.png](https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-basics/stills/admin/c15_recently_removed_days_left.png)
- [stills/wipe/admin-seeded-learner-summary.png](https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-basics/stills/wipe/admin-seeded-learner-summary.png)
- [stills/talk-extracts/admin-timeline.png](https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-basics/stills/talk-extracts/admin-timeline.png)
- [stills/talk-extracts/learner-feed.png](https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-basics/stills/talk-extracts/learner-feed.png)
- [video/legal-walk-join-consent-search.webm](https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-basics/video/legal-walk-join-consent-search.webm)
- [logs/e2e-postgres-full.log](https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-basics/logs/e2e-postgres-full.log)
- [logs/e2e-walks.log](https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-basics/logs/e2e-walks.log)
