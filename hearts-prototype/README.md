# HEARTS prototype

A portal CMS for the desk and a phone app for learners. The master desk opens portals. Each portal has its own admin, access codes, teachers and learners. Courses linked from the master library stay linked: when the library changes, the portal sees the change, and the portal cannot edit the original.

This page is meant to be honest. It says what works, what is a stand-in, and what is tested.

## Run it

You need Node 20 or newer. From a clean clone:

```bash
cd hearts-prototype
npm run go
```

`npm run go` installs packages, installs the Playwright browser (it carries on with a warning if that step fails), seeds `data/hearts.db`, and starts the app at [http://localhost:3000](http://localhost:3000).

Other ways in:

| Command | What it does |
| --- | --- |
| `npm run setup` | Install, browser and seed, without starting the app |
| `npm run dev` | Start the app. Seeds first if `data/hearts.db` is missing |
| `npm run reseed` | Drop every table in `data/hearts.db` and seed it again from scratch. Safe while the dev server is running: it empties the file in place, so the server picks up the clean data on the next request. Prints the new access codes at the end |
| `npm run seed` | Seed an empty database (the first run of `npm run go` does this) |
| `HEARTS_TEST_CLOCK=1 npm run dev` | Start with the test clock. Only the master desk can move it, and it is never on in a production build |
| `npx tsx scripts/import-transcripts.ts <folder>` | Clean a folder of YouTube `.vtt` captions into `content/transcripts/starters/` (one spoken line per cue, repeats removed) and rebuild its `index.json` of lengths |

### Accounts

| Who | Email | Password |
| --- | --- | --- |
| Master | master@hearts.test | hearts-master |
| Second master (to show a master cannot view as another) | master2@hearts.test | hearts-master |
| East London admin | elm-admin@hearts.test | portal-admin |
| East London teacher | elm-teacher@hearts.test | portal-teacher |
| East London learner (Maryam Begum, has six opening answers, three of them private) | elm-learner@hearts.test | portal-learner |
| East London learner (Hamza Ali) | elm-learner2@hearts.test | portal-learner |
| Leeds admin | leeds-admin@hearts.test | portal-admin |
| Leeds learner | leeds-learner@hearts.test | portal-learner |

Access codes are random on every seed, in the form `ELM-7KQX-M4TD`. The seed prints them, writes them to `data/seed-codes.json` (by label: `elm-teacher`, `elm-admin`, `elm-learner`, `elm-parent`, `leeds-teacher`, `leeds-learner`), and lists them on the master desk under Access codes. A join link looks like `/join?code=ELM-7KQX-M4TD`. Codes are not case sensitive and spaces are ignored. Each code on a portal's Access page shows its link, a QR code, its uses and whether it still works. The seeded admin code is already used, because admin codes are single-use.

## What is seeded

- The 41 clauses of Hadith Jibril, with three Ghunya seats under each clause, and the shelf list from `content/ghunya-shelf.txt`. Clauses 22, 23, 24, 25 and 27 have no teaching line in the source, so none is shown for them.
- Course 1: Yasir Fahmy, *How to Live Like the Prophet*, session 6, from `content/transcripts/fahmy-session6.md`. It has no YouTube link, so the app plays its clip cards. One cut is already approved.
- Course 2: Shaykh Mikaeel Smith, *The Names*, class 19, Ar-Rabb (`ECaTWkof57E`).
- Course 3: Shaykh Mikaeel Smith, *The Names*, class 20, Al-Nur: the full 47:41 class (`NIR88RRpat4`). `MK5q_zMiX1g` has the same YouTube title but is a 95-second clip of it, so it is a separate starter.
- Course 4: East London circle notes, a local course with no points.
- Two portals, East London Mosque and Leeds Chapter. Leeds cannot see East London's board, workbook or people, and the other way round.
- Welcome and intro films for learners and teachers on the East London portal.
- The opening, "Shine and dust": six scenes with their options, reply lines and privacy, the lanes, and the starter map of 31 talks across the lanes. Help contacts for the scene with the help option (Samaritans, Muslim Youth Helpline, 999).
- Timed English captions for all 30 starter videos in `content/transcripts/starters/`. Every starter's length is the end of its last caption, and the seed fails if any cut, tier or pop-up falls after the end of its talk.
- A three-tier record for each of the 31 starters, drafted from those captions and marked "Draft, needs a human check", with 2 or 3 draft pop-ups per talk. Learners never see a draft pop-up.

## What is real, what is a stand-in

### Real

- **Portals and roles.** Master, portal admin, teacher, learner and parent. Every action takes the portal from the signed-in account, never from an id in the form. A learner who opens an admin address is sent home. Only the master can open the Payload data console at `/admin`; anyone else is sent back to their own desk.
- **Codes and packs.** A code carries a role and a course pack. When a pack changes, the admin chooses whether to leave people as they are, add, remove or replace. A code can have a label, an expiry date and a maximum number of uses, and can be switched off. Admin codes are single-use unless the master sets otherwise. A blank code field makes a random 8-character code. Failed joins are rate-limited: 10 per address and 200 across the site in 10 minutes, then a "too many tries" page.
- **Placing.** Four questions map answers to clauses, and the first course follows from that. Picking the Prophet's answers starts on Fahmy (clause 3). Picking the Names starts on Ar-Rabb (clause 22).
- **Learner app.** A full-screen feed you can swipe up, down, left and right, with a bottom tab bar (Home, Lanes, Garden, Me), a home-screen manifest and icons. Built for a 390 by 844 phone. Home has the growth banner and a Continue row; Garden has Your path.
- **The opening** (`/p/<portal>/start`). The opener, six scenes with a pass on each, the help screen at its own address, the hand-off line, then the feed at `/feed`. Each scene has its own address, and Back replaces an earlier tap rather than adding one. Nothing from YouTube loads before the learner chooses a way in.
- **Privacy on the device.** Taps stay in `localStorage` until sign-up, and so does everything worked out from them: before sign-up the first feed is routed on the phone from the starter map sent with the page, and the feed API refuses anyone signed out. Signing up from the Keep my place sheet sends the six rows once. Private rows and private answers are only ever shown to their owner, not to teachers, admins or the master.
- **Routing** (`src/lib/heart.ts`). Taps become scale scores, lane scores and L1 and L2 signals, which choose the first feed. Guarding the gaze is offered only after opting in on the Me tab, and that choice stays on the device.
- **Workbook.** Where you started (with a lock on private rows), answers grouped by course, topic and video, shared and private filters, a consent toggle per answer, teacher replies, and Back to the moment, five seconds before the question. Mentors get a CSV of shared rows only.
- **Me tab.** Change your name, Keep my place, Share my opening answers, add my taps to trends, haptics, and Start again, which clears the opening here and on the server.
- **Pop-up questions.** Playback pauses at each question's second, the card rises, the answer saves, and playback carries on. Seeking past a question does not fire it. Answer later keeps it open. A strip under the player shows one mark per question. Triggers live in a registry in `src/lib/popups.ts`, so new kinds can be added beside the timestamp trigger.
- **Player layout flags.** A question card never covers the film. By default the paused video stays in view with the card below it; the strict layout keeps the whole player, chips and timeline included, clear of the card and its shade. The feed controls sit over the clip by default. The master switches either on the master Opening page. Signed-out visitors cannot read the flags.
- **Opening desks.** Master: scene wording with kill-list and publish checks (plurals, spelt-out letters, look-alike letters and markup are caught), the player flags, the lanes and their tag queue, trends (hidden below ten people, one row per account per week), and a simulator that runs the phone's routing on picked taps. Portal admin: a caption override, hiding at most two scenes (never the one with the help option), and help contacts, which take only phone numbers and https links and show as plain text. The same rules hold over REST, and a setup cannot be moved to another portal.
- **Three tiers per talk.** Each starter talk has a hors d'oeuvre (15 to 20 seconds), an appetiser (up to about 3 minutes, built on a hook, a turn and a land) and the main (the whole talk from 0:00, with pop-up questions). The appetiser stops at its out point. Next to the main there is an optional "Resume from where the appetiser ended" link. The master desk's Talk tiers page lists every talk; each talk opens an editor with sliders to scrub the in and out points, a preview that plays exactly that stretch, the caption lines to pick the hook, turn and land from, a button to mark it checked, and its pop-ups to edit, publish or add.
- **View as.** A portal admin can view as a learner in their portal, and the master as a portal admin or learner, never another master. A reason of at least 10 characters is required. Read-only by default, and that covers REST, globals and new records. Allowing changes needs its own reason of at least 10 characters and lasts ten minutes. Answers, the opening, Start again, privacy settings and joining with a code stay closed even then. Start, stop, refusals and writes go to the audit log. Leaving goes back to a path on the same site. The viewed person's device keys are kept apart from the viewer's and wiped on exit.
- **Unplayable clips.** When the player refuses a clip, the feed moves on and reports it. A clip is only taken off the feed when YouTube's own oEmbed answer confirms it cannot be embedded.
- **Points and unlocks.** A point can wait on an earlier one, with a countdown in days. The server refuses an early answer even if the form is forged.
- **Answers.** Private by default. A learner can share an answer to the portal's board.
- **Teacher replies** raise an unread badge and an in-app notification, and land in the learner's workbook.
- **Schedule.** Lessons are spread in order across the weekdays you pick. Earlier days take the remainder, so 6 sittings over 4 days come out as 2, 2, 1, 1. It is a guide, and missing a day does not lock the course. A sitting counts at 80% watched, or when the film ends. A plan covers a year at most, and an unnamed plan takes the season's name, such as "Autumn study days".
- **Nights and RSVP.** A ticket is earned by finishing a lesson in the last 7 days, and is held otherwise. Self check-in needs an earned ticket. Staff can check anyone in.
- **Garden.** A 14-day chart drawn from real completions.
- **The extractor** (`src/lib/extractor.ts`). It reads a timed transcript and proposes cuts. Every hook, turn, land and quote must match the transcript word for word, every timestamp must be a real cue start, and estimated timestamps are never marked high confidence. A reworded line is rejected.

### Stand-ins

- **Email is not sent.** Replies and feedback create an in-app notification and an "email not sent" note. Payload logs mail to the console.
- **AI is optional.** With `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` set, the extractor asks the model for suggestions and checks them against the transcript. Without a key it uses its own rules, which is how the seed and the tests run.
- **YouTube captions** are often refused from cloud machines. See the transcript chain below. When every step fails, the title is still saved from YouTube, and you can upload a `.vtt`, `.srt` or `.txt` transcript to run the extractor.
- **Video files.** Mux is not wired up. A non-YouTube share link is stored but not downloaded. Uploads over 200 MB are refused.
- **Follow, like and save** in the feed are kept on the device only.
- **Watch history** is stored only after the learner opts in.
- **Completion trusts the browser.** The seconds watched are reported by the page, so a determined learner could fake them.
- **Talk tiers are machine drafts.** Every starter talk and every main has hors d'oeuvre and appetiser cuts, hook, turn and land lines, and two or three pop-ups drafted from its shipped captions. All of them say "needs a human check" until someone opens Talk tiers on the master desk, trims them and marks them checked. Draft pop-ups are never shown to learners.
- **Some caption times are estimates.** Rolling auto captions repeat each line; the importer keeps the first full appearance, so a cut can be a second or two off.
- **Trends** count each person once per week, only for people who opted in, and hold back any week under ten people. The seed has no contributions, so the trends screens start empty.
- **Rate limits live in memory.** Code guessing and the "won't play" report are limited per address inside one server process. They reset on restart, are not shared between servers, and trust `x-forwarded-for`, so put the app behind a proxy that sets it.
- **npm audit is not clean.** `postcss`, `sharp` and `dompurify` are pinned to patched versions in `overrides`. The 17 advisories left all come from Payload 3.90: it accepts Next 15.4 or Next 16.3.3 and later, while every Next fix is in 15.5.24 or 16. Moving to Next 16 is a major upgrade that has not been done or tested yet. Until then the image optimiser is off (`images.unoptimized`), which closes the `/_next/image` route behind the two critical Next advisories. The rest are Payload's own `undici`, its `drizzle-kit`, `esbuild` and `chokidar`/`sass` build tools, and denial-of-service or proxy-bypass issues in Next 15.4 itself. `npm audit fix --force` would drop Payload to 3.85, so do not run it.
- **Haptics** use the browser's vibrate call, which iPhones ignore.
- **Lane tags** are confirmed or rejected by hand on the master Lanes page. Nothing tags clips automatically yet.
- **Help contacts** are the real public numbers, but no one has checked them for each portal's area.

## YouTube transcript chain

`src/lib/youtube.ts` tries each provider in turn and uses the first transcript it gets:

1. **yt-dlp**, if it is installed. Set `YT_DLP_PATH` to point at it, or `HEARTS_DISABLE_YTDLP=1` to skip it.
2. **Watch page.** Reads the caption track from the YouTube watch page, as the `youtube-transcript` package does.
3. **Your own service**, when `TRANSCRIPT_SERVICE_URL` is set. Handy for a yt-dlp box on a home connection that YouTube does not block.

The service contract:

- The app sends `GET $TRANSCRIPT_SERVICE_URL?id=<videoId>&url=<watchUrl>`, with `Authorization: Bearer $TRANSCRIPT_SERVICE_TOKEN` when the token is set. It waits up to 60 seconds.
- Reply with WebVTT or SRT text, or with JSON holding one of `vtt`, `transcript`, or `segments: [{ "start": 1.2, "end": 4.5, "text": "..." }]` (times in seconds).

To add a provider, write an object with `name` and `fetch(id)` that returns transcript text or `null`, and pass it in `ingestYoutubeUrl(input, { providers })`.

## Environment variables

None are needed to run locally.

| Variable | Use |
| --- | --- |
| `DATABASE_URL` | SQLite file. Defaults to `file:./data/hearts.db` |
| `PAYLOAD_SECRET` | Session signing. Set your own outside local use |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Optional AI help for the extractor (default model `claude-sonnet-4-5`) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | The same through OpenAI (default model `gpt-4o-mini`) |
| `TRANSCRIPT_SERVICE_URL`, `TRANSCRIPT_SERVICE_TOKEN` | Your own transcript service, as above |
| `YT_DLP_PATH`, `HEARTS_DISABLE_YTDLP` | Where yt-dlp is, or skip it |
| `HEARTS_TEST_CLOCK` | `1` turns on the test clock. Only the master desk can move it, signed-out reads are refused, and a production build ignores it |
| `HEARTS_E2E_PORT`, `HEARTS_E2E_REUSE` | Port for the server the e2e run starts (default 3100), or `1` to reuse one already running there |
| `HEARTS_NOW` | Pins the app's idea of "now" to a date, such as `2026-10-01T09:00:00Z`. For demos and tests |

On a Cloud Agent, put keys in the Cursor Dashboard under Cloud Agents, then Secrets. Do not commit them.

## The hoopoe

The icon, splash, empty states and logo mark use the artwork in `public/brand/`. After changing it, run `node scripts/brand-icons.mjs` to rebuild the home-screen icons in `public/icons/`.

## Tests

```bash
npm run test:unit      # 56 tests
npm run test:e2e       # 13 journey, 38 opening, 28 round 3, 12 view-as and 6 screenshot tests
npm run screenshots    # screenshots only
```

- **Unit tests** (`src/lib/*.test.ts` and `tests/unit/*.test.ts`) cover extractor quality on all three transcripts, placing, the clause map, seat suggestions, unlocks and countdowns, the transcript chain and VTT output, the opening's scoring and routing (`heart.test.ts`), and pop-up triggers, seeking and the trends threshold (`popups.test.ts`).
- **End-to-end tests** (`tests/e2e/journeys.spec.ts`) run in order and cover:
  - the master opening a portal, its pack and codes;
  - the admin adding a course, transcript, extraction, approval, points, films and a night;
  - placing by both routes, with a lower-case code that has spaces in it;
  - a waiting point, its countdown and a refused early answer;
  - private and shared answers;
  - teacher replies and notifications;
  - the schedule, RSVP and check-in;
  - isolation between portals and refused forged ids;
  - role guards;
  - swipe gestures;
  - a scan for console errors.
- **Opening tests** (`tests/e2e/opening.spec.ts`) follow section 8 of the opening build spec, numbered 1 to 37 to match it: the flow, the privacy checks (no request carries taps before sign-up, the feed request carries lane scores only, nothing from YouTube before a choice), help, the sheet, the workbook and its privacy, the CSV, the Me tab, Start again, reduced motion, pop-ups and the desks.
- **View-as tests** (`tests/e2e/view-as.spec.ts`) are 38 to 49: reasons, read-only refusals, private rows, device keys, exit, who may view as whom, the audit log, allowing changes, and what stays closed.
- The e2e run **reseeds the database** before it starts.
- **Round 3 tests** (`tests/unit/round3.test.ts` and `tests/e2e/round3.spec.ts`) hold one regression test per bug from the round 3 report, each named "Bug N: ...", plus the section T checks over all shipped transcripts. `tests/unit/safety.test.ts` and `tests/unit/config.test.ts` cover the kill list, reserved addresses, contact links, the clock rules and the e2e server settings.
- The e2e run starts its own server on port 3100 with `HEARTS_TEST_CLOCK=1`, so it does not need or touch `npm run dev`. Stop any dev server in this folder first, because both share `.next`. Set `HEARTS_E2E_REUSE=1` to reuse a server you started yourself on that port.
- Set `SCREENSHOT_DIR` to choose where screenshots go. The default is `artifacts/screenshots/`. Learner screens are 390 by 844 and desk screens 1440 by 900.
- `node scripts/compare-boards.mjs` puts design boards beside the matching screenshots. It expects the board images at `/tmp/panel1.png` to `/tmp/panel5.png` and `/tmp/g1.png` to `/tmp/g6.png`, or pass a folder: `node scripts/compare-boards.mjs <boards> <screenshots> <out>`.

Console messages from inside the YouTube player come from YouTube's own frame, and the console scan ignores them.

## Build

```bash
npm run build
```

The build passes with no type errors. Stop the dev server first. After a build, delete `.next` before starting the dev server again, or it may serve pages from a stale cache and return 500s.

## Shape

Payload CMS 3, Next.js 15 and SQLite. The multi-tenant plugin hangs portal data off `portals`. Forms post to `/api/hearts`, which checks the account and the portal, then redirects back with a notice or an error. Learner screens are in `src/screens/app`, desk screens in `src/screens/desk`, and server logic in `src/server`.
