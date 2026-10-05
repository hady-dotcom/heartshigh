# Round 4 proof

Tip: `506b1c44b262eeb9c006aafa1ffad66af5491034`  
Fair base: `c0fe3224e7c36ce7229f695fc2bec1a8714c55cc` on `cursor/courses-planning-3b48` (PR #26)  
This branch: `cursor/talk-extracts-density-db78` (PR #36)  
Recorded tip-only Playwright (merge tip, before the alias-map one-liner): `30b92cf01982bf5549912506dfeae5dbac74ec5f`

## What was wrong

This branch never edited `course-player.tsx`. The strip appeared because `proof-course.ts` plants four published questions on sitting 1 (`views.length` is then 4). The old player painted numbered strip dots as soon as those views existed. That is why `planner-demo.spec.ts:58` expected `question-strip` 0 and received 1 against old #26 (`3ca8534`).

#26 `c0fe322` already hides question text until the film reaches that second: `questionRowRevealed` / `comingQuestionLabel` in `src/lib/question-list.ts`. The strip may list “Question N comes at M:SS” with `data-revealed=no`. It must not show the prompt or a bare `1`–`4` count until that moment.

Merged that tip. The planner spec is #26’s (not weakened). Isolated Postgres re-run: **planner-demo + talk-extracts passed**.

## Suites (Postgres)

Isolated after merge (`30b92cf`): `planner-demo.spec.ts:58` and `talk-extracts.spec.ts:22` — **2 passed (1.5m)**.

One clean tip-only Playwright at `30b92cf`: **220 passed / 6 failed (27.7m)**.

| file:line | Full-run error | vs fair base |
|---|---|---|
| `tests/e2e/planner-demo.spec.ts:58` | Next.js “1 Issue” badge on home (`hold` at line 67). Not the strip. Isolated pass twice after merge. | Flake (server overlay after a long run). |
| `tests/e2e/talk-extracts.spec.ts:22` | — | Passed in the full run and in isolation. |
| `tests/e2e/round4.spec.ts:65` | `TLCGBj4AlB0 is served through one carrier cut` expected 1 received 4 | **Was new.** `loadOpening` copied aliased cut ids onto `opening.clips`, so `Object.values(clips)` counted one talk four times. Fixed in `506b1c4` (aliases stay on `opening.alias`; `clipFromOpening` still resolves them). Isolated N4 **passed**. |
| `tests/e2e/courses-planning.spec.ts:211` | `popup` expected 0 received 1 after Answer later / Escape | Isolated B6 **passed**. Same player as #26. |
| `tests/e2e/feed-polish.spec.ts:148` | “Your plan” 1.19:1 | Same flake as on old #26. |
| `tests/e2e/screenshots.spec.ts:33` | `answer-share` 5-minute timeout (`showImam` → `task-imam`) | Same flake as on old #26. |
| `tests/e2e/typography.spec.ts:27` | `net::ERR_CONNECTION_RESET` after “Server is approaching the used memory threshold, restarting…” | Suite flake. |

Isolated retest after `506b1c4` (planner-demo, talk-extracts, N4, B6): **4 passed (1.8m)**.

**New product failures remaining vs `c0fe322`: none confirmed.** The recorded full run still lists six fails; four are shared/suite flakes, N4 is fixed, B6 and planner-demo pass when run clean.

## Still

`player-from-plan-row.png` — player just after opening sitting 1 from a plan row. Timeline dots exist. Strip rows say “Question N comes at …”. No prompt (“What stayed with you…”). No bare numbered count on the strip.

## Raw URLs

https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/talk-extracts/round4/REPORT.md  
https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/talk-extracts/round4/player-from-plan-row.png  
https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/talk-extracts/round4/playwright-summary.txt  
https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/talk-extracts/round4/isolated-after-fix.txt  
