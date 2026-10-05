# R5c round 5 proof

Orphan branch only. Not for merge. No deploy.

Code tip: `926043e` on `cursor/r5c-round5-fixes-923b` (PR #37 into `cursor/r5c-look-words-privacy-923b`).
Round 4 subject: PR #25 at `432555c` vs base `20e191c`.

All Playwright below is on **Postgres** (`postgres://hearts@127.0.0.1/hearts_e2e`, port 3125).

## Per-file reruns

| File | Result | Notes |
| --- | --- | --- |
| `compass.spec.ts` | 3 passed, 0 failed, 0 skipped (66s) | Seed now exits after success; the Postgres pool no longer hangs `beforeAll`. |
| `feed-levels.spec.ts` | 1 passed (43s) | `data-cuts` matches `/\d+ \d+/`. Learn more stays on the watched item’s own parent. |
| `journeys.spec.ts` | 11 passed, 1 failed, 1 skipped (172s) | Admin extract finished inside 180s. The one failure is the inherited swipe test; the following console-errors test is skipped because the suite is serial. |
| `round4.spec.ts` | 15 passed, 0 failed (80s) | N1/N2 did not die. Server stayed up. |
| `screenshots.spec.ts` | 7 passed, 0 failed (187s) | No `Page crashed` on this VM, including “a week of use”. |
| `opening.spec.ts` (extra isolated check) | 43 passed (4.4m) | Kill-list publish (full-suite timeout) passes alone. |

JSON: `compass-clean.json`, `feed-levels-clean.json`, `journeys-clean.json`, `round4-clean.json`, `screenshots-clean.json`.

## Full suite

`full-report.json` / `full-clean.json`

- **213 passed**, **11 failed**, **5 skipped**, 0 flaky (33.2m)
- Skipped: 3 gated `r5c-evidence` tests (`HEARTS_R5C_EVIDENCE` unset) plus 2 serial follow-ons after inherited failures.

Failed (same families as the inherited eight, plus two full-suite-only timeouts that pass in isolation):

1. `feed-evening` scenic swipe bare side
2. `feed-evening` extended-cut poster (90s timeout in the suite)
3. `feed-polish` Tap for sound
4. `feed-touch` swipe left/right
5. `harvest-lines` sample then real line
6. `integration-final` join / placing / Learn more
7. `integration-r3` Short caption
8. `journeys` swipe / Learn more parent
9. `nesting-progress` swipe did not change cut
10. `opening` kill-list word (180s timeout in the suite; **43/43 passed isolated**)
11. `screenshots` garden week of use (300s timeout in the suite; **7/7 passed isolated**)

No new code failure versus base that still fails when the file is run alone.

## Phone walk

390×844. `?from=Aisha` still names **Idris**. Home and Me both show **day 3**.

- [phone_walk.mp4](./phone_walk.mp4) (full)
- [recording_demo.mp4](./recording_demo.mp4) (compressed)
- [phone/join_from_aisha_shows_idris.png](./phone/join_from_aisha_shows_idris.png)
- [phone/home_day_3.png](./phone/home_day_3.png)
- [phone/me_day_3.png](./phone/me_day_3.png)
- [phone/learn_more_appetiser.png](./phone/learn_more_appetiser.png)
