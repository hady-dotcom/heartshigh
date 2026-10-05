# PR #26 round-6 verification report

**Verifier:** read-only. No push to the code branch, no merge, no Railway, no production.

| Item | Value |
| --- | --- |
| PR | https://github.com/hady-dotcom/heartshigh/pull/26 |
| Branch tip | `cursor/courses-planning-3b48` @ `3ca8534c3604f586181f8958f2cb283d19ae5dd8` |
| Base tip | `cursor/compass-gather-demo-ed5a` @ `9d4c0a07f18dba0652012cb305290435e3dd2560` |
| Artifact branch | `artifacts/verify-pr26-r6` (orphan; report + proof only) |
| Date | 2026-10-05 |
| Database | PostgreSQL 16 only (not SQLite). Isolated DBs: `hearts_base`, `hearts_branch`, `hearts_migrate`, `hearts_base_e2e`, `hearts_branch_e2e`. User `hearts` / `hearts`. |
| Worktrees | `/tmp/verify-pr26/base` @ 9d4c0a0, `/tmp/verify-pr26/branch` @ 3ca8534 |

**Verdict: NOT READY for the integration merge.**

The round-6 functional claims hold in code and on a 390×844 walk. `tsc` is clean. Unit tests are 379/379. Fresh Postgres migrate-from-zero applied 15/15. There is no durable Playwright regression versus the base. The integration merge is still blocked: `git merge-tree --write-tree --name-only` conflicts against all four sibling lanes, and three product-polish issues remain (duplicate question numbers, purple garden-card gradient, blank talk thumbs on real YouTube ids).

---

## PASS / CONCERN / FAIL

| # | Claim / check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Harvest POST no longer waits on the caption marker; `lineAt` starts at `-1`; harvest fires on clip end, error, or swipe | **PASS** | `journey.tsx`: `useState(-1)`; `keepHarvest()` POSTs `/api/hearts/harvest` without reading `lineAt`; listeners on `hearts:ended` and `hearts:player-error`; `advance()` calls `keepHarvest()` before a swipe. Captions still wait: `lineShown = mode === 'hors' && lineAt >= 0 ? lineAt : -1`. |
| 2 | Question strip stays inside the player and is absent on the course overview (buffet) | **PASS** (with CONCERN on duplicate UI) | `CourseOverview` in `course.tsx` has no `question-strip`. Player renders `data-testid="question-strip"` under the film. Walk: buffet has no strip; player has the strip plus **Answer question 1**. `planner-demo.spec.ts` asserts strip count 0 on buffet and visible on the player. See D. |
| 3 | `tsc --noEmit` is clean (`series-group.ts` `FlagEnv`) | **PASS** | Branch and base: `tsc exit=0`. `FlagEnv = Record<string, string \| undefined>` at `src/lib/series-group.ts:55`. |
| 4 | Home **Your plan** contrast test fails when the card is missing | **PASS** | `feed-polish.spec.ts` `toBeVisible()` on `home-plan` plus “Maryam needs an open sitting”. Unit `contrast.test.ts` cream `#F1E4C6` on teal `#0F2E2C` ≥ 4.5. Full-suite: passed on the branch. Walk Home showed **Your plan** / **Tonight: Part 1, 97 min**. |
| 5 | Unit 379/379; full e2e 217/222 | **CONCERN** | Unit **379/379** confirmed. Full Playwright on Postgres was **219 passed / 2 failed / 1 skipped / 222** (35.8m), not 217/222. Failures: `screenshots` “week of use” timeout (also on base) and `sheet-creator` (flake; passed alone twice). `paused-scrim` skipped in the full suite. Maryam `limit=40` lookup: **Your plan** and harvest-lines passed; proof-course looks Maryam up by email. |
| A | Base vs branch on Postgres: npm ci, tsc, unit, full Playwright, compare by spec+title, rerun branch-only fails twice | **PASS** (no durable regression) | See numbers below. Only branch-not-base failure: `sheet-creator` “the creator drafts a sheet…”. Alone ×2: **1/1 pass**, **1/1 pass** → flake. |
| A* | `harvest-lines.spec.ts` | **PASS** | Base 2/2, branch 2/2. |
| A* | `planner-demo.spec.ts` | **PASS** | Branch-only spec; 1/1 in the full suite. |
| A* | `feed-levels.spec.ts` | **PASS** | Base 1/1, branch 1/1. |
| A* | `round4.spec.ts` paused-scrim | **CONCERN** | **Passes on base** in the full suite. Branch full suite: **skipped**. Isolated on branch: **fail** (paused-scrim not visible, 20s) then **skip**. YouTube-env flake; not a durable lane regression. |
| A* | `journeys.spec.ts` | **PASS** | Base 13/13, branch 13/13. No timeout in this Postgres run. |
| A* | `screenshots.spec.ts` | **CONCERN** | “a week of use…” **timed out 300s on both** tips. Other 6 screenshot tests passed on both. Shared flake, not a branch regression. |
| B | Migration for every schema change; fresh Postgres migrate-from-zero | **PASS** | Branch migrations are byte-identical to base (15 files + `index.ts`). No new collection/schema drift. `npm run migrate` on empty `hearts_migrate`: 15/15 applied, exit 0. |
| C | Phone 390×844 walk: buffet, schedule, My week, player | **PASS** | See C and `screenshots/`. Video: `phone_walk_buffet_week_player.mp4`. |
| D | Builder still 1: duplicate question numbers? Garden card purple vs teal/gold? | **CONCERN** | Duplicate: **yes**. Garden CSS is a purple→teal gradient (`#2a2448` → `#243628`), not `#0E2A2B` / `#D4A84B`. Walk capture reads more teal; builder still is purple. |
| D | Builder still 2: blank talk thumbs — test data only, or real talks too? | **CONCERN** | **Real talks too.** `shownPoster()` nulls `i.ytimg.com` and `/clips/`. `.buffet-row .thumb` is `#0F2E2C` on a `#0F2E2C` row. Course 31 (real YouTube main) also has no visible thumb. |
| E | `git merge-tree` (write nothing) vs four siblings | **FAIL** for integration | Conflicts vs **all four**. File lists below. |
| F | Tab bar Home · Lanes · My week · Garden · Me | **PASS** | `shell.tsx` tabs; walk screenshot `01_lanes_tabbar.png`. Base still says **Gather**. |
| F | Over a speaker, only the timed spoken line, never a title | **PASS** (code) | `spokenCaption()` drops title/series/empty. `lineShown` waits for `lineAt >= 0`. Walk used the course player (practice mode; fake id), not a live feed speaker overlay. |
| F | Mains are real long talks | **CONCERN** | `HEARTS_DEMOTE_SHORT_MAINS` off. Seed has real long mains (e.g. course 31, 27:34). Proof course **Ten sittings** is a test fixture: `youtubeId: 'xxTESTFAKEid'`, 97 min × 10. |

---

## A. Commands and numbers

Harness lived only under `/tmp/verify-pr26` (not on the code branch): `E2E_DATABASE` pointed at Postgres; seed `codesFile` accepts `_e2e`; `playwright.verify.config.ts` writes JSON + line reporters. `compass-demo.ts` was given `process.exit(0)` in the **base** worktree only after a 23-minute hang on Postgres (Payload pool). That patch is not on either published tip.

### Install / tsc / unit

```bash
# Postgres 16, role hearts/hearts, DBs hearts_base hearts_branch hearts_migrate hearts_base_e2e hearts_branch_e2e
cd /tmp/verify-pr26/base/hearts-prototype && npm ci
# DATABASE_URL=postgres://hearts:hearts@127.0.0.1:5432/hearts_base
npx tsc --noEmit
npm run test:unit

cd /tmp/verify-pr26/branch/hearts-prototype && npm ci
# DATABASE_URL=postgres://hearts:hearts@127.0.0.1:5432/hearts_branch
npx tsc --noEmit
npm run test:unit
```

| Side | HEAD | npm ci | tsc | unit |
| --- | --- | --- | --- | --- |
| base | 9d4c0a0 | exit 0, 587 packages / 14s | exit 0 | **349/349** pass, 48.1s |
| branch | 3ca8534 | exit 0, 587 packages / 14s | exit 0 | **379/379** pass, 47.7s |

### Full Playwright (one suite at a time, Postgres)

```bash
# /tmp/verify-pr26/run-e2e.sh
# HEARTS_E2E=1 HEARTS_TEST_CLOCK=1 HEARTS_SCRIPTURE_OFFLINE=1 HEARTS_DEMOTE_SHORT_MAINS=0
# DATABASE_ADAPTER=postgres
cd /tmp/verify-pr26/base/hearts-prototype
DATABASE_URL=postgres://hearts:hearts@127.0.0.1:5432/hearts_base_e2e \
HEARTS_E2E_PORT=3100 npx playwright test --config=playwright.verify.config.ts
# 206 passed / 3 failed / 2 skipped / 211  (53.4m)  exit 1

cd /tmp/verify-pr26/branch/hearts-prototype
DATABASE_URL=postgres://hearts:hearts@127.0.0.1:5432/hearts_branch_e2e \
HEARTS_E2E_PORT=3200 npx playwright test --config=playwright.verify.config.ts
# 219 passed / 2 failed / 1 skipped / 222  (35.8m)  exit 1
```

Playwright JSON stats:

| | expected | unexpected | skipped | duration |
| --- | --- | --- | --- | --- |
| base 9d4c0a0 | 206 | 3 | 2 | 3203516 ms (53.4m) |
| branch 3ca8534 | 219 | 2 | 1 | 2146991 ms (35.8m) |

Branch adds three spec files vs base: `courses-planning.spec.ts` (8), `planner-demo.spec.ts` (1), `planner-shots.spec.ts` (1), plus the Home **Your plan** contrast test.

### Compare by spec file + title

Compared with `/tmp/verify-pr26/parse-pw-json.py` on `results/base-e2e.json` and `results/branch-e2e.json`.

**Base non-pass (211 tests):**

| Status | Spec | Title |
| --- | --- | --- |
| failed | `compass.spec.ts` | a learner cannot fetch their own scores from any compass API |
| skipped | `compass.spec.ts` | the monthly look is five questions and a life check-in |
| skipped | `compass.spec.ts` | an imam sees the charts, the cohort, and why a talk was chosen |
| failed | `screenshots.spec.ts` | a week of use, so the garden has something in it |
| failed | `typography.spec.ts` | Typography panel lists the five styles and can stand in for the hors d’oeuvre |

The compass #1 failure is harness contamination: the first `npx tsx src/seed/compass-demo.ts` was killed after a ~23 min Payload-pool hang (script has no `process.exit` on Postgres). #2 and #3 then skipped. Typography timed out at `waitForURL` after login (180s). Neither reproduced on the branch.

**Branch non-pass (222 tests):**

| Status | Spec | Title |
| --- | --- | --- |
| skipped | `round4.spec.ts` | LOW: a question paused over the film fades YouTube’s pause panel under a soft scrim |
| failed | `screenshots.spec.ts` | a week of use, so the garden has something in it |
| failed | `sheet-creator.spec.ts` | the creator drafts a sheet, then a learner completes a task the imam can see |

**Branch fail/timeout that is not the same status on base:**

| Spec | Title | Branch | Base | Alone ×2 |
| --- | --- | --- | --- | --- |
| `sheet-creator.spec.ts` | the creator drafts a sheet, then a learner completes a task the imam can see | failed (`creator-candidate` count) | passed | **pass 1.1m**, **pass 1.1m** → **flake** |

No other branch-only failure.

### Isolated reruns (branch, Postgres, same `hearts_branch_e2e`)

```bash
# /tmp/verify-pr26/rerun-one.sh
npx playwright test --config=playwright.verify.config.ts -g 'the creator drafts a sheet, then a learner completes a task the imam can see'
# #1: 1 passed (1.1m)
# #2: 1 passed (1.1m)

npx playwright test --config=playwright.verify.config.ts -g 'a question paused over the film fades YouTube'
# #1: 1 failed — expect(getByTestId('paused-scrim')).toBeVisible() 20000ms
# #2: 1 skipped
```

### Special specs (from the full suites)

| Spec | Base | Branch |
| --- | --- | --- |
| `harvest-lines.spec.ts` | 2 passed | 2 passed |
| `planner-demo.spec.ts` | absent | 1 passed |
| `feed-levels.spec.ts` | 1 passed | 1 passed |
| `round4.spec.ts` paused-scrim | **passed** | **skipped** |
| other `round4.spec.ts` | 14 passed | 14 passed |
| `journeys.spec.ts` | 13 passed | 13 passed |
| `screenshots.spec.ts` week of use | timedOut 300s | timedOut 300s |
| other `screenshots.spec.ts` | 6 passed | 6 passed |
| `feed-polish.spec.ts` Your plan contrast | absent | passed |
| `courses-planning.spec.ts` | absent | 8 passed |
| `planner-shots.spec.ts` | absent | 1 passed |

Builder claim “journeys/screenshots timeouts that pass alone”: journeys **passed in the full suite** on both tips this run. Screenshots “week of use” **failed in the full suite on both** (not rerun alone; shared with base). Paused-scrim **does pass on base** in the full suite; it is not a clean skip-only-on-branch story.

---

## B. Migration drift

```bash
diff -rq /tmp/verify-pr26/base/hearts-prototype/src/migrations \
         /tmp/verify-pr26/branch/hearts-prototype/src/migrations
# no output — identical

DATABASE_URL=postgres://hearts:hearts@127.0.0.1:5432/hearts_migrate \
DATABASE_ADAPTER=postgres npm run migrate
# 15/15 applied, "Database migrations are up to date.", exit 0
```

Applied on empty `hearts_migrate`:

1. `20261003_103330_initial`
2. `20261003_124500_integration_part1`
3. `20261003_131651_integration_part2`
4. `20261003_140611_harvest`
5. `20261003_180616_jibril_doors`
6. `20261003_194500_line_tidy`
7. `20261003_200853_integration_final`
8. `20261003_220000_feedback`
9. `20261004_031500_gather`
10. `20261004_060000_shorts`
11. `20261004_061000_portal_time_zone`
12. `20261004_080000_lesson_picture_flags`
13. `20261004_120000_compass_v2`
14. `20261004_180000_gather_entry_code`
15. `20261004_210000_schedule_minutes`

`20261004_210000_schedule_minutes` is already on the base. This lane does not add a schema migration, and does not need one.

---

## C. Phone walk (390×844)

Walked on the branch worktree at `http://127.0.0.1:3000/p/east-london` after a local seed. Viewport 390×844 (Chrome device mode). Screenshots in `screenshots/`. Recording: `phone_walk_buffet_week_player.mp4`.

| Step | Result | Shot |
| --- | --- | --- |
| Tab bar | Home · Lanes · My week · Garden · Me | `01_lanes_tabbar.png` |
| Course 33 **Ten sittings** overview | 10 talks; **10 talks · about 16 hours**; **Start part 1**; **Schedule all of these**; no question strip / no **Answer question** | `02_ten_sittings_overview.png` |
| Course 31 real YouTube main | **Alhamdulillah! Allah Chose You to Be a Believer**; 1 talk · about 28 min; **Schedule this talk**; no visible thumb | `03_real_course_thumbs.png` |
| Schedule Ten sittings | Form: From 5 Oct 2026, Until 8 Oct 2026, 20 min/day, Mon–Thu | `04_schedule_form.png` |
| After schedule | Lands on My week; 3,3,2,2 talks Mon–Thu | `05_my_week_after_schedule.png` |
| Home | **Your plan** / **Tonight: Part 1, 97 min**; My week is the middle tab (one tap) | `06_home_after_plan.png` |
| My week from Home | One tap on the tab bar | `07_my_week_from_home.png` |
| Plan rows | Starts at part 1; day rows fit 390×844; no horizontal overflow | `08_plan_rows.png` |
| Player | Numbered dots on the film bar; **Answer question 1 →**; **Part 2 · Next (97 min)**; strip 1 2 3 4 under **Part 1 · Sitting 1**; Course garden | `09_player.png` |
| Question sheet | **Paused at question 1**; **Think about this for this session** | `10_think_about_this.png` |
| My week from player | One tap on the tab bar | (same tab bar) |

---

## D. Builder stills

The two stills attached to the brief (player with the question strip; buffet without it).

### Duplicate question numbers — yes

The player paints the same 1–4 twice on purpose:

1. Timeline dots on the film bar (`course-player.tsx` `.dot` / `data-testid="timeline-dot"`, each `<i>{point.number}</i>`).
2. The `q-strip` row under **Part 1 · Sitting 1** (`data-testid="question-strip"`, `data-testid="strip-dot"`).

Confirmed on the builder player still and on `09_player.png`. Claim 2 (strip inside the player, absent on the buffet) still holds. The extra numbered row is duplicate chrome, not a second question set.

### Course garden purple vs teal/gold

```css
.garden-card { background: linear-gradient(165deg, #2a2448 0%, #1c2830 58%, #243628 100%); }
```

`#2a2448` is purple-navy. The product tokens are deep teal `#0E2A2B` / `#0F2E2C` and warm gold `#D4A84B`. The builder still reads purple. The 390×844 walk (`09_player.png`) reads darker teal with a purple-left cast. Neither is a flat teal card with gold type.

### Blank thumbs — not only test data

`posterFor()` still builds `https://i.ytimg.com/vi/${id}/hqdefault.jpg` (or `/clips/${id}.jpg`). `shownPoster()` then **returns null** for both `i.ytimg.com` / `img.youtube.com` and `/^\/clips\//`.

Buffet rows always render an empty `.thumb` (72×44). CSS:

```css
.buffet-row { background: #0F2E2C; }
.buffet-row .thumb { width: 72px; height: 44px; background: #0F2E2C; }
```

Teal on teal: the reserved thumb is a blank gutter. **Ten sittings** uses `xxTESTFAKEid` (no real poster). **Course 31** is a real YouTube main and still shows no thumb (`03_real_course_thumbs.png`). The builder buffet still’s empty circles are the same `.thumb` boxes with more contrast in that capture. This is a `shownPoster` + CSS issue, not missing fixture art.

---

## E. merge-tree (write nothing)

```bash
git fetch origin cursor/r5d-desks-813d
git fetch origin cursor/r5c-look-words-privacy-923b
git fetch origin cursor/insights-missions-calendar-eef4
git fetch origin cursor/portal-features-0777

OURS=3ca8534c3604f586181f8958f2cb283d19ae5dd8
git merge-tree --write-tree --name-only --messages "$OURS" origin/<sibling>
# working tree not checked out; object-db only
```

Tips used (after fetch, 2026-10-05):

| Sibling | Tip |
| --- | --- |
| `origin/cursor/r5d-desks-813d` | `efe888b` Show the sheet error border on the first cell and scroll proof stills into view. |
| `origin/cursor/r5c-look-words-privacy-923b` | `926043e` Fix r5c round-4 Postgres regressions. |
| `origin/cursor/insights-missions-calendar-eef4` | `d2666b5` Fix round-7 verifier items: appetiser poster, tsc, Friday minutes, compass exit. |
| `origin/cursor/portal-features-0777` | `1ae7f2b` Hide the studio Next button once Features is open. |

### Conflicts vs `cursor/r5d-desks-813d` (1)

- `hearts-prototype/src/screens/desk/people.tsx`

### Conflicts vs `cursor/r5c-look-words-privacy-923b` (15)

- `hearts-prototype/src/app/(frontend)/journey.css`
- `hearts-prototype/src/app/(frontend)/p/[slug]/[[...screen]]/page.tsx`
- `hearts-prototype/src/app/(frontend)/theme.css`
- `hearts-prototype/src/components/app/course-player.tsx`
- `hearts-prototype/src/components/app/feed.tsx`
- `hearts-prototype/src/components/app/shell.tsx`
- `hearts-prototype/src/components/journey/journey.tsx`
- `hearts-prototype/src/lib/talk-title.test.ts`
- `hearts-prototype/src/lib/talk-title.ts`
- `hearts-prototype/src/screens/app/garden.tsx`
- `hearts-prototype/src/screens/app/home.tsx`
- `hearts-prototype/src/screens/app/me.tsx`
- `hearts-prototype/tests/e2e/fake-youtube.ts`
- `hearts-prototype/tests/e2e/feed-evening.spec.ts`
- `hearts-prototype/tests/e2e/journeys.spec.ts`

### Conflicts vs `cursor/insights-missions-calendar-eef4` (10)

- `hearts-prototype/src/app/(frontend)/journey.css`
- `hearts-prototype/src/app/(frontend)/p/[slug]/[[...screen]]/page.tsx`
- `hearts-prototype/src/components/app/feed.tsx`
- `hearts-prototype/src/components/app/shell.tsx`
- `hearts-prototype/src/components/journey/journey.tsx`
- `hearts-prototype/src/screens/app/me.tsx`
- `hearts-prototype/src/screens/desk/people.tsx`
- `hearts-prototype/src/server/handle.ts`
- `hearts-prototype/tests/e2e/fake-youtube.ts`
- `hearts-prototype/tests/e2e/feed-evening.spec.ts`

### Conflicts vs `cursor/portal-features-0777` (7)

- `hearts-prototype/src/components/app/shell.tsx`
- `hearts-prototype/src/components/journey/journey.tsx`
- `hearts-prototype/src/screens/app/course.tsx`
- `hearts-prototype/src/screens/app/garden.tsx`
- `hearts-prototype/src/screens/app/home.tsx`
- `hearts-prototype/src/screens/app/me.tsx`
- `hearts-prototype/src/screens/desk/people.tsx`

Shared hot files across siblings: `shell.tsx`, `journey.tsx`, `people.tsx`, `home.tsx`, `me.tsx`. Those need an integration resolver before a multi-lane merge.

Raw merge-tree transcripts: `results/merge-*.txt`.

---

## F. Product rules

**Tab bar.** Branch `TabBar`: Home, Lanes, My week, Garden, Me. Walk matches. Base still uses **Gather** in the middle slot.

**Over a speaker.** Feed captions use `spokenCaption(horsLine, [lessonTitle, courseTitle])`, which returns `''` for a title, series name, or empty line. Nothing is painted until `lineAt >= 0`. The course-player walk used practice mode (`xxTESTFAKEid` — “the film could not load here”), so a live spoken overlay was not on screen. Rule holds in code and unit (`spoken-caption.test.ts`).

**Mains are real long talks.** `HEARTS_DEMOTE_SHORT_MAINS` is off (`series-group.ts`). Seed mains include real YouTube talks (course 31, 27:34). The proof course **Ten sittings** is ten fake 97-minute rows with `youtubeId: 'xxTESTFAKEid'`. Fine as a planner fixture; it is not a real main.

---

## Claim 1 code (harvest vs captions)

```588:609:hearts-prototype/src/components/journey/journey.tsx
  // Captions wait on lineAt. Harvest does not: keep a line when the clip ends, errors or is swiped.
  const keepHarvest = useCallback(() => {
    if (!signedIn || props.viewAs) return
    // ...
    void fetch('/api/hearts/harvest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lessonId: current.lessonId, seconds, surface: level }),
    })
```

`keepHarvest()` is invoked from `advance()` (swipe), `hearts:ended`, and `hearts:player-error`. `lineAt` is `useState(-1)`. `lineShown` stays `-1` until a timed line is current. Harvest seconds come from `harvestAt(piece)`, not from the caption index.

---

## What the builder claimed vs what ran

| Builder | This run |
| --- | --- |
| unit 379/379 | **379/379** |
| e2e 217/222 | **219/222** (2 fail + 1 skip) |
| Maryam limit=40 fixed | **Your plan** + harvest-lines passed; `proof-course.ts` looks Maryam up by email at 3ca8534 |
| journeys/screenshots timeouts that pass alone | journeys **passed in the full suite**; screenshots week-of-use **timed out on both tips** |
| paused-scrim not this lane | **Passes on base** in the full suite; branch full suite skip; isolated fail then skip |

---

## Verdict

**NOT READY for the integration merge.**

Ready enough to keep this lane on its own base (`cursor/compass-gather-demo-ed5a`): claims 1–4 hold, tsc/unit/migrate are clean, and the only branch-not-base Playwright miss is a flake. Not ready to fold into the other open lanes until someone resolves the merge-tree conflicts (especially `shell.tsx` / `journey.tsx` / `people.tsx`) and the three polish items (duplicate question chrome, garden-card gradient, `shownPoster` blank thumbs).

---

## Raw URLs

After this orphan push, the files live at:

- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/REPORT.md
- https://github.com/hady-dotcom/heartshigh/blob/artifacts/verify-pr26-r6/REPORT.md
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/phone_walk_buffet_week_player.mp4
- https://github.com/hady-dotcom/heartshigh/raw/artifacts/verify-pr26-r6/phone_walk_buffet_week_player.mp4
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/screenshots/01_lanes_tabbar.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/screenshots/02_ten_sittings_overview.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/screenshots/03_real_course_thumbs.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/screenshots/04_schedule_form.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/screenshots/05_my_week_after_schedule.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/screenshots/06_home_after_plan.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/screenshots/07_my_week_from_home.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/screenshots/08_plan_rows.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/screenshots/09_player.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/screenshots/10_think_about_this.png
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/NOTES.txt
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/results/compare.txt
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/results/base-e2e.json
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/results/branch-e2e.json
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/results/merge-r5d-desks-813d.txt
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/results/merge-r5c-look-words-privacy-923b.txt
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/results/merge-insights-missions-calendar-eef4.txt
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/verify-pr26-r6/results/merge-portal-features-0777.txt
