# R5c look / words / first-time proof

Orphan branch only. Not for merge. No deploy.

Code: `cursor/r5c-look-words-privacy-923b` at `432555c`, based on `cursor/compass-gather-demo-ed5a` (`9d4c0a0`) plus PR #23 (`20e191c`).

## Suites (after the rebase)

- Unit: **367 passed**, 0 failed (`npm run test:unit`).
- Full Playwright after rebase: **209 passed**, 10 failed, 10 did not run, of 229 (39.8m).
- New checks that passed in that run: page-help slot, shared day count, spoken-overlay, r5c-evidence (contrast, stills, join film).
- After the opening-`?` fix (`432555c`), the opening Pass test and the journeys placing Pass clicks now pass. Remaining failures are legacy feed-swipe / harvest / integration / screenshot timeouts, not this look pass.

The 10 full-suite failures were:

1. `feed-evening` scenic swipe bare side
2. `feed-polish` Tap for sound / scenic chrome
3. `feed-touch` swipe left/right
4. `harvest-lines` sample then real line
5. `integration-final` join / placing / Learn more
6. `integration-r3` Short caption wait
7. `journeys` placing (page-help covered Skip — **fixed**)
8. `nesting-progress` swipe did not change cut
9. `opening` Pass (page-help covered Skip — **fixed**)
10. `screenshots` garden `answer-share` timeout

## Contrast

Per-route, per-element ratios at 10:00 and 20:00 America/Toronto:

- [contrast-10.json](./contrast-10.json) (262 KB)
- [contrast-20.json](./contrast-20.json)
- [contrast-summary.md](./contrast-summary.md)

Home, Lanes, Me and join had no measured fails. Workbook / course / me-plan rows are listed; several are evening-card false positives (cream type measured against a cream parent).

## Recording

Join to first talk, 390×844, normal speed, no Next.js Issues badge:

- [join-to-first-talk.mp4](./join-to-first-talk.mp4)
- [join-to-first-talk.webm](./join-to-first-talk.webm)

The card reads `Aisha from East London Mosque invited you`. The opener heading is `A calm place to start`. The hand-off is only `We'll begin with a calmer heart` — no EXTENDED CUT, no talk title, no Read it instead over that line. Speaker chrome is `On Trust`, not a YouTube title.

## Stills

- [after/home-20.png](./after/home-20.png) — 3 days with us; `?` in its own slot
- [after/lanes-20.png](./after/lanes-20.png) — Allah / Qur'an; Day 3
- [after/workbook-20.png](./after/workbook-20.png) — clean talk titles, no pipes
- [after/me-20.png](./after/me-20.png) — day 3
- [after/join-20.png](./after/join-20.png) — compact evening-garden card, named inviter
- [after/page-help.png](./after/page-help.png)
- [after/swarm-like-mine.png](./after/swarm-like-mine.png) — solid chips
- [after/compass-proposed.png](./after/compass-proposed.png) — deep teal desk
