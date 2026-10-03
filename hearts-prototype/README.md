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
| `npm run seed` | Wipe and reseed the database |
| `HEARTS_TEST_CLOCK=1 npm run dev` | Start with the test clock, which the e2e tests need |

### Accounts

| Who | Email | Password |
| --- | --- | --- |
| Master | master@hearts.test | hearts-master |
| East London admin | elm-admin@hearts.test | portal-admin |
| East London teacher | elm-teacher@hearts.test | portal-teacher |
| East London learner (Maryam Begum) | elm-learner@hearts.test | portal-learner |
| Leeds learner | leeds-learner@hearts.test | portal-learner |

Access codes: `ELM-ADMIN`, `ELM-TEACH`, `ELM-LEARN`, `ELM-PARENT`, `LEEDS-TEACH`, `LEEDS-LEARN`. A join link looks like `/join?code=ELM-LEARN`. Codes are not case sensitive and spaces are ignored. Each code on a portal's Access page shows its link and a QR code.

## What is seeded

- The 41 clauses of Hadith Jibril, with three Ghunya seats under each clause, and the shelf list from `content/ghunya-shelf.txt`. Clauses 22, 23, 24, 25 and 27 have no teaching line in the source, so none is shown for them.
- Course 1: Yasir Fahmy, *How to Live Like the Prophet*, session 6, from `content/transcripts/fahmy-session6.md`. It has no YouTube link, so the app plays its clip cards. One cut is already approved.
- Course 2: Shaykh Mikaeel Smith, *The Names*, class 19, Ar-Rabb (`ECaTWkof57E`).
- Course 3: Shaykh Mikaeel Smith, *The Names*, class 20, Al-Nur (`MK5q_zMiX1g`).
- Course 4: East London circle notes, a local course with no points.
- Two portals, East London Mosque and Leeds Chapter. Leeds cannot see East London's board, workbook or people, and the other way round.
- Welcome and intro films for learners and teachers on the East London portal.

## What is real, what is a stand-in

### Real

- **Portals and roles.** Master, portal admin, teacher, learner and parent. Every action takes the portal from the signed-in account, never from an id in the form. A learner who opens an admin address is sent home. Only the master can open the Payload data console at `/admin`; anyone else is sent back to their own desk.
- **Codes and packs.** A code carries a role and a course pack. When a pack changes, the admin chooses whether to leave people as they are, add, remove or replace.
- **Placing.** Four questions map answers to clauses, and the first course follows from that. Picking the Prophet's answers starts on Fahmy (clause 3). Picking the Names starts on Ar-Rabb (clause 22).
- **Learner app.** A full-screen feed you can swipe up, down, left and right, with a bottom tab bar (Home, Lanes, Garden, Me), a home-screen manifest and icons. Built for a 390 by 844 phone.
- **Points and unlocks.** A point can wait on an earlier one, with a countdown in days. The server refuses an early answer even if the form is forged.
- **Answers.** Private by default. A learner can share an answer to the portal's board.
- **Teacher replies** raise an unread badge and an in-app notification, and land in the learner's workbook.
- **Schedule.** Lessons are spread in order across the weekdays you pick. Earlier days take the remainder, so 6 sittings over 4 days come out as 2, 2, 1, 1. It is a guide, and missing a day does not lock the course. A sitting counts at 80% watched, or when the film ends.
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
- **Mascot.** The hoopoe artwork is not in the repo yet. See below.

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
| `HEARTS_TEST_CLOCK` | `1` shows a test clock on the course page so you can move time forward. Signed-in users only. Leave it off in real use |
| `HEARTS_NOW` | Pins the app's idea of "now" to a date, such as `2026-10-01T09:00:00Z`. For demos and tests |

On a Cloud Agent, put keys in the Cursor Dashboard under Cloud Agents, then Secrets. Do not commit them.

## The hoopoe

The icon, splash, empty states and logo mark use `public/brand/hoopoe.png` when it exists, and a plain gold "H" monogram until then. To use the real artwork:

1. Add `public/brand/hoopoe.png` (the bird on a transparent background) and, if you have it, `public/brand/hoopoe-sheet.png`.
2. Run `node scripts/brand-icons.mjs` to rebuild the home-screen icons in `public/icons/`.

## Tests

```bash
npm run test:unit      # 20 tests
npm run test:e2e       # 13 journey tests and 4 screenshot tests
npm run screenshots    # screenshots only
```

- **Unit tests** (`src/lib/*.test.ts`) cover extractor quality on all three transcripts, placing, the clause map, seat suggestions, unlocks and countdowns, the transcript chain and VTT output.
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
- The e2e run **reseeds the database** before it starts.
- If a dev server is already running on port 3000, the tests reuse it. That server must have been started with `HEARTS_TEST_CLOCK=1`. In CI (`CI` set) Playwright always starts its own.
- Set `SCREENSHOT_DIR` to choose where screenshots go. The default is `artifacts/screenshots/`. Learner screens are 390 by 844 and desk screens 1440 by 900.
- `node scripts/compare-boards.mjs` puts design boards beside the matching screenshots. It expects the board images at `/tmp/panel1.png` to `/tmp/panel5.png` and `/tmp/g1.png` to `/tmp/g6.png`.

Console messages from inside the YouTube player come from YouTube's own frame, and the console scan ignores them.

## Build

```bash
npm run build
```

The build passes with no type errors. Stop the dev server first. After a build, delete `.next` before starting the dev server again, or it may serve pages from a stale cache and return 500s.

## Shape

Payload CMS 3, Next.js 15 and SQLite. The multi-tenant plugin hangs portal data off `portals`. Forms post to `/api/hearts`, which checks the account and the portal, then redirects back with a notice or an error. Learner screens are in `src/screens/app`, desk screens in `src/screens/desk`, and server logic in `src/server`.
