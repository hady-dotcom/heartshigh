# Round 7 proof — PR #27

Code tip: `26584360d1590e5e89c4024f5cdf04eec3d9ca2d` on `cursor/insights-missions-calendar-eef4`.

Fair base: PR #23 `20e191c` merged with PR #24 `efe888b` = local `250c272`. Both suites on empty Postgres, Playwright `workers=1`.

## Suites

| Tree | Unit | tsc | Playwright |
| --- | --- | --- | --- |
| Tip `2658436` | 435 pass / 0 fail | 32 | **219 passed, 11 failed, 2 did not run** (40.8m) |
| Fair base `250c272` | 379 pass / 1 fail (env.ts patch) | 32 | **182 passed, 18 failed, 25 did not run** (39.4m) |

The eight new tsc errors from VERIFY.md are gone. Compass finished on both (base only after a worktree-only `process.exit(0)` on `demo:compass`; the product fix is on the tip).

`tests/e2e/feed-evening.spec.ts:217` **passed on the tip** and **failed on the fair base** in this environment (same `data-poster` race the verifier saw on the branch). No tip-only product fail remains.

## Friday gold pill

`phone-feed-friday-minutes.png` — 390×844. The hors CTA is two lines:

**Watch a Friday reminder before Jumu'ah (39 min) ›**

39 minutes is the target talk’s stored length, not a made-up number.

## New failures on the tip (target: none)

None that did not also fail on the fair base (or that the verifier already classed as inherited / flake):

- `feed-evening.spec.ts:133` inherited
- `feed-polish.spec.ts:50` inherited
- `feed-touch.spec.ts:68` inherited
- `harvest-lines.spec.ts:65` inherited
- `integration-final.spec.ts:67` inherited
- `integration-r3.spec.ts:57` inherited
- `journeys.spec.ts:417` inherited
- `nesting-progress.spec.ts:22` inherited
- `round4.spec.ts:171` also failed on base
- `screenshots.spec.ts:25` flake (failed on base; verifier flake)
- `r5d-desks-proof.spec.ts:97` flake (failed on base; verifier flake)
