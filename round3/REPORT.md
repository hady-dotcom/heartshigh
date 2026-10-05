# Round 3 proof

Tip (code, after kinetic early-return fix): `2f1fba166184c34f32f9b262b8ed965eeb7411de`  
Recorded dual suite tip: `b1de78dee629120868db7abd89e1671793e7058e`  
Learner `data-extract` fix on tip: `a31a5c55f6b9d0e77c0debeab18e650e8cdd1607`  
Base: `3ca8534c3604f586181f8958f2cb283d19ae5dd8` on `cursor/courses-planning-3b48` (PR #26)  
This branch: `cursor/talk-extracts-density-db78` (PR #36) into `cursor/compass-gather-demo-ed5a`  
Feed CTA branch: `cursor/clip-feed-fixes-b8ea` (PR #23)  
Desk tokens branch: `cursor/r5d-desks-813d` (PR #24)

Same environment, Postgres, one clean full run of unit + tsc + all Playwright for each side.

| | unit | tsc | Playwright |
|---|---|---|---|
| Base `3ca8534` | 378 pass / 1 fail (`round4.test.ts:172`, local `e2eDatabase` hook so base can run on Postgres; not a product fail on courses-planning) | 0 | 174 pass / 19 fail / 28 did not run / 1 skipped (27.8m) |
| Tip `b1de78d` | 404 pass / 0 fail | 0 | 217 pass / 5 fail / 1 skipped (30.2m) |

After `a31a5c5`, isolated `tests/e2e/talk-extracts.spec.ts` on Postgres: **1 passed (51.5s)**.

## New on this branch

A fail is new only when it is absent from the base run. Line-only drift of the same assertion is a flake.

| file:line | Verdict |
|---|---|
| `tests/e2e/talk-extracts.spec.ts:22` | **Was new on the recorded suite.** Empty `data-extract` on the learner clip. Fixed in `a31a5c5` (carrier-cut alias → opening clip). Isolated re-run passed. Not a remaining new fail. |
| `tests/e2e/planner-demo.spec.ts:58` | **Still new on the recorded suite.** `question-strip` expected 0, received 1 when opening the course player from a plan row (`planner-demo.spec.ts:131`). Lives in `course-player.tsx` (`views.length`). Base passed this spec. Not the approved-extract → learner-feed path; left alone. |
| `tests/e2e/feed-polish.spec.ts:147` | **Flake.** Same “Your plan” AA contrast assertion as base `feed-polish.spec.ts:148` (cream on translucent teal). Line drift only. |

**Remaining new after the `data-extract` fix: 1** (`planner-demo.spec.ts:58`). Target was none new.

## Flakes (also fail on base)

| file:line | Why |
|---|---|
| `tests/e2e/screenshots.spec.ts:33` | 5-minute timeout waiting for `answer-share` after `answer-form` is visible. `course-player.tsx` replaces the share checkbox with `task-imam` when `point.showImam` is set. Same error on base. Not caused by this branch; not fixed. |
| `tests/e2e/harvest-lines.spec.ts:65` | 60s wait on `/api/hearts/harvest`. Same on base. |
| `tests/e2e/feed-polish.spec.ts:147` / `:148` | Home “Your plan” heading contrast. Same on both. |

Base’s other 16 fails plus 28 did-not-run are the missing `data/seed-codes-test.json` path on that checkout (this branch writes the test file when `HEARTS_E2E=1`). Not new product fails.

## Learner `data-extract`

The device feed reads SSR `opening.clips`, not POST `/api/hearts/feed`. Old cut ids must resolve onto the talk’s carrier clip (`opening.alias` + `clipFromOpening`) and `extractFields` must stamp the first approved hors before `presentClips` / `mixFeed`. Isolated spec then sees a non-empty `data-extract`.

## Kinetic stutter

Display-only: `kineticExtractWords` / `kineticExtractLine` drop an exact adjacent repeat and a 2–4 word false start that sits next to its restart. Stored quote and transcript stay as said.

The Good Company card (`You're not You're not the uncle…`) is a single-hors seed clip. `expandTalkExtracts` used to return that item unchanged once `extractId` was stamped, so the tidy never ran. `tidyHorsDisplay` now runs on the seed and single-hors paths as well, and scenic kinetic beats always go through the same tidy. Unit test: `src/lib/extracts.test.ts` (“kinetic extract lines drop a repeated word…”), including stamped `extractId` and empty `extracts`. Tip SHA for that extra path: `2f1fba1`.

## LEARN MORE (PR #23)

This card is from the courses-planning base. This branch still paints `Learn more` on the journey CTA (`journey.tsx`) and the teaching card.

PR #23 (`cursor/clip-feed-fixes-b8ea`) already replaces it:

- `clipStepUpLabel()` → “Watch the 3-minute version”
- `talkStepUpLabel()` → “Watch the whole talk (N min)” / course count
- `READY_FOR_MORE` chip
- teaching-card CTA “Watch the 3-minute version”
- `forbiddenLearnerWords` treats “Learn more” as retired

No CTA change on this branch.

## Admin timeline colour (PR #24)

Cream values left alone. Timeline uses shared desk classes and `--desk-*` tokens so the R5d desks merge picks up the teal desk look.

**Classes:** host `desk evening` (MasterFrame); root `panel extract-desk`.

**Tokens (no hard-coded cream hex on `.extract-desk`):** `--desk-sidebar`, `--desk-gold`, `--desk-gold-ink`, `--desk-on-dark`, `--desk-card`, `--desk-line`, `--desk-muted`.

## Raw URLs

https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/talk-extracts/round3/REPORT.md  
https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/talk-extracts/round3/compare.txt  
https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/talk-extracts/round3/admin-timeline.png  
https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/talk-extracts/round3/learner-feed.png  
https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/talk-extracts/round3/base-playwright-summary.txt  
https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/talk-extracts/round3/tip-playwright-summary.txt  
https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/talk-extracts/round3/base-exits.txt  
https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/talk-extracts/round3/tip-exits.txt  
https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/talk-extracts/round3/base-meta.txt  
https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/talk-extracts/round3/tip-meta.txt  
