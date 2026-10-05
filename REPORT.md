# HEARTS integration r5

Draft PR: https://github.com/hady-dotcom/heartshigh/pull/40  
Branch: `cursor/integration-r5` → `cursor/hearts-prototype-v1-cf40`  
Code tip: `ef8e43be23dbf6b589b45e311887a90037620825`  
Proof branch: `artifacts/integration-r5` (this branch; code-only PR stays clean)  
Date: 5 October 2026

## What landed

Merged, in order, onto cf40 `8ad0b33`:

1. #19 compass-gather  
2. #20 live (already in compass-gather; not double-merged)  
3. #22 Experiments  
4. #21 AI framing  
5. #23 clip-feed (`20e191c`; feed files win)  
6. #24 desks  
7. #25 look / words / privacy  
8. #26 courses-planning  
9. #27 insights / missions / calendar (proof files stripped from the code tree)  
10. #30 portal features  
11. #32 basics-safety last (S05 private-file lock kept)

Not merged: #31 delete-and-wipe, #33 admin-ops, #34 legal, #35 accounts, #36 talk-extracts. Not deployed to Railway. Turnstile env left unset.

## Hard rules (walk)

From `stills/notes.txt` and the 390×844 walk:

- Tab bar: Home · Lanes · My week · Garden · Me. Gather never replaces My week.
- Caption on the first card: none (no timed spoken line). No talk title over the speaker.
- Course overview: Schedule all of these, no question preview.
- Player: question strip waits until its moment.
- Friday / talk CTA: Watch the 3-minute version (39 min) on the feed still.
- Desk (laptop width): Beginner / Intermediate / In-depth in the #24 shell.
- Hostile file: learner B received **403** for learner A’s private answer media (`/api/hearts/file/1`).
- Look: evening garden, deep teal `#0E2A2B`, gold `#D4A84B`. No cream on learner screens.
- Lesson 3 stored title is the YouTube title (`NIR88RRpat4`), not 'The Names Class 20: Al-Nur'.
- British English UI; portal zone Toronto for the calendar demo.

## Suites (Postgres)

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| Unit (`DATABASE_URL=…/hearts_unit`) | **535 pass / 0 fail** |
| Playwright, first full pass on `hearts_e2e` | 229 pass / 21 fail / 4 skipped / 10 did not run (42.9m) |
| After green-up, every previously failing file re-run | pass (journeys 13/13, missions 4/4, live 2/2, walk, S05, nesting, screenshots circle, feed-evening, feed-touch, integration-final, page-help, round2 desks, round3 Bug 27, r5d desk proof) |
| Walk + S05 after last tip | **2 pass** |

A second full 264-test Playwright was not re-run after `ef8e43b`. New failures introduced by this merge, after the green-up: **none known**.

## New failures

None remaining from the files that failed the first full pass. Those were merge-rule mismatches (opt-in swarm, skip-seen pool ends, scenic `scene-next`, evening-only chrome, Lesson 3 YouTube title, desk `display:contents`, live question hydration). Product fix kept: swarm is opt-in again (`user.shareWithLearners` + portal switch), matching #32.

## Raw proof

- Report: https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-r5/REPORT.md
- Walk notes: https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-r5/stills/notes.txt
- Walk video: https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-r5/walk.webm
- Stills:
  - https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-r5/stills/01-tabbar-home.png
  - https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-r5/stills/02-feed-caption.png
  - https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-r5/stills/03-course-overview.png
  - https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-r5/stills/04-course-player.png
  - https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/integration-r5/stills/05-desk-depths.png
- Tree: https://github.com/hady-dotcom/heartshigh/tree/artifacts/integration-r5
