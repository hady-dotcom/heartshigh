# HEARTS prototype

A portal CMS for the desk and a phone app for learners. The master desk opens portals. Each portal has its own admin, access codes, teachers and learners. Courses linked from the master library stay linked: when the library changes, the portal sees the change, and the portal cannot edit the original.

Every agent must read [docs/DESIGN-WHY.md](docs/DESIGN-WHY.md) before changing a learner screen. It is the basis for why each screen exists. Keep each screen's reason. A better idea from testing can replace a detail in the deck.

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

Access codes are random on every seed, in the form `ELM-7KQX-M4TD`. The seed prints them, writes them to `data/seed-codes.json` (by label: `elm-teacher`, `elm-admin`, `elm-learner`, `elm-parent`, `leeds-teacher`, `leeds-learner`), and lists them on the master desk under Access codes. A join link looks like `/join?code=ELM-7KQX-M4TD`. Codes are not case sensitive and spaces are ignored. Each code on a portal's Access page shows its link, a QR code, its uses and whether it still works. The seeded admin code was made for one use and is already used.

## What is seeded

- The 41 clauses of Hadith Jibril, with three Ghunya seats under each clause, and the shelf list from `content/ghunya-shelf.txt`. Clauses 22, 23, 24, 25 and 27 have no teaching line in the source, so none is shown for them.
- The 20 working doors over those clauses (`doors` collection), from Leon's map in `content/jibril-doors.md`. The Postgres migration inserts them, and every seed (including `seed:starters`) writes them again.
- Course 1: Yasir Fahmy, *How to Live Like the Prophet*, session 6, from `content/transcripts/fahmy-session6.md`. It has no YouTube link, so the app plays its clip cards. One cut is already approved.
- Course 2: Shaykh Mikaeel Smith, *The Names*, class 19, Ar-Rabb (`ECaTWkof57E`).
- Course 3: Shaykh Mikaeel Smith, *The Names*, class 20, Al-Nur: the full 47:41 class (`NIR88RRpat4`). `MK5q_zMiX1g` has the same YouTube title but is a 95-second clip of it, so it is a separate starter.
- Course 4: East London circle notes, a local course with no points.
- Two portals, East London Mosque and Leeds Chapter. Leeds cannot see East London's board, workbook or people, and the other way round.
- Welcome and intro films for learners and teachers on the East London portal.
- The opening, "Shine and dust": six scenes with their options, reply lines and privacy, the lanes, and the starter map of 31 talks across the lanes. Help contacts for the scene with the help option (Samaritans, Muslim Youth Helpline, 999).
- Timed English captions for all 30 starter videos in `content/transcripts/starters/`. Every starter's length is the end of its last caption, and the seed fails if any cut, tier or pop-up falls after the end of its talk.
- A three-tier record for each of the 31 starters, drafted from those captions and marked "Draft, needs a human check", with 2 or 3 draft pop-ups per talk. Learners never see a draft pop-up.
- Five HEARTS circle answers on each question of courses 1 to 3, from the built-in drafts, so the swarm is not empty on day one.
- The harvest of every talk with a transcript, worked out at seed time. 27 of the 31 talks quote the Qur'an or a hadith. The other four genuinely quote neither, so they give nothing: Gems from Ibn Ata'illah ep. 1 (`rb2EkzjgO98`), Amjad Tarsin on anger (`fBzrLN77gng`), and Khalid Latif's *Moments of Solitude* (`f-3OxXUp9jc`) and *On Mosques, Companionship, & Knowledge* (`N_-YiwIb-u0`). Maryam (the East London learner) has finished three talks with their harvest in her Garden, the latest still marked New.

### Scripture sources

Everything is bundled in `content/scripture/`, so Harvest works offline.

- `quran.json.gz`: the full Qur'an, from the open Quran API by fawazahmed0 (github.com/fawazahmed0/quran-api, Unlicense). The Arabic is the Tanzil Simple text (tanzil.net, which asks that it be shown unchanged and credited), and the English is Saheeh International. Tanzil's transliteration, Yusuf Ali and Pickthall are there only to recognise a quotation and are never shown.
- `fallback.json.gz`: the tafsir of every ayah the bundled talks quote, from the open tafsir API by spa5k (github.com/spa5k/tafsir_api, MIT), which takes it from quran.com and Tarteel's QUL; and the hadith they quote from a named collection, with Arabic and grading, from the open hadith API by fawazahmed0 (Unlicense). When the network is up, other ayahs and collections are fetched from the same APIs and cached.
- `npx tsx scripts/scripture-fallback.ts` rebuilds the fallback from the shipped transcripts. It needs the network.

## What is real, what is a stand-in

### Real

- **Portals and roles.** Master, portal admin, teacher, learner and parent. Every action takes the portal from the signed-in account, never from an id in the form. A learner who opens an admin address is sent home. Only the master can open the Payload data console at `/admin`; anyone else is sent back to their own desk.
- **Codes and packs.** A code carries a role and a course pack. When a pack changes, the admin chooses whether to leave people as they are, add, remove or replace. A code can have a label, an expiry date and a maximum number of uses, and can be switched off. A portal admin decides how many admins their portal has: an admin code can have any use limit, or none, and an expiry. It only ever makes portal admins for that admin's own portal, never master and never another portal; it can be switched off at any time; and the Access page shows its uses and who joined with it, and when. A blank code field makes a random 8-character code. Failed joins are rate-limited (see Join limits below).
- **Placing.** Four questions map answers to clauses, the answers vote by door, and the first course follows from the winning door. Picking the Prophet's answers starts on Fahmy (door 2, the sitting). Picking the Names starts on Ar-Rabb (door 10, Believe in Allah). An answer on the desk can name a door (`With prayer | W5`); it is saved as that door's first clause.
- **Hadith Jibril as 20 doors** (`src/lib/doors.ts`). Learners meet the hadith as 20 doors, W1 to W20, each with a section (Sitting, Islam, Iman, Ihsan, Hour, Trunk) and a title, and never see a clause number. Talks, tags, questions and the sheet keep their clause, and a talk's door always comes from it, so nothing was retagged.
  - **Learners.** The Garden's Jibril map shows the 20 doors by section with their titles, and flowers a door when a finished talk sits on any of its clauses. Each door has one page (`/garden/jibril/<door>`) with the hadith's words for that door, its teaching lines, its Ghunya seats and its talks. Al-Ghuniyya groups seats by door. Course cards show the doors their talks sit in. Harvest groups by door. "Where you began" names the door.
  - **Routing.** The feed's spine walks talks in door order, one per door, from the door before the learner's starting door. A lane ranks every talk in a door by the best rank of any of its clauses there, and a first-week exclusion covers the whole door. A phone that saved its spine position in clauses moves it to doors on the next open.
  - **Desk.** The talk editor shows the door first (`W3 · About Islam`) with the clause beside it, and the clause picker is grouped by door. The placing-question desk and the simulator name doors too.
- **Learner app.** A full-screen feed you can swipe up, down, left and right, with a bottom tab bar (Home, Lanes, Garden, Me), a home-screen manifest and icons. Built for a 390 by 844 phone. Home has the growth banner and a Continue row; Garden has Your path.
- **The opening** (`/p/<portal>/start`). The opener, six scenes with a pass on each, the help screen at its own address, the hand-off line, then the feed at `/feed`. Each scene has its own address, and Back replaces an earlier tap rather than adding one. Nothing from YouTube loads before the learner chooses a way in.
- **Privacy on the device.** Taps stay in `localStorage` until sign-up, and so does everything worked out from them: before sign-up the first feed is routed on the phone from the starter map sent with the page, and the feed API refuses anyone signed out. Signing up from the Keep my place sheet sends the six rows once. Private rows and private answers are only ever shown to their owner, not to teachers, admins or the master.
- **Routing** (`src/lib/heart.ts`). Taps become scale scores, lane scores and L1 and L2 signals, which choose the first feed. Guarding the gaze is offered only after opting in on the Me tab, and that choice stays on the device.
- **Workbook.** Where you started (with a lock on private rows), answers grouped by course, topic and video, shared and private filters, a consent toggle per answer, teacher replies, and Back to the moment, five seconds before the question. Mentors get a CSV of shared rows only.
- **Harvest lines.** Besides the verses and hadith of finished talks, the harvest keeps spoken lines from what a learner watches in the feed. The words are copied from the talk transcript at that timestamp, and each line can play the talk from there, or open the surrounding lines ("See it in context"). Everything in the harvest can be grouped by talk, by the 20 working doors (W1 to W20) or by speaker, and filtered by door and speaker. A learner with nothing kept yet sees a sample of real lines until a short clip plays; Maryam's account is seeded with that sample. "What do the scholars say" on a line appears only when the transcript names a scholar and gives their words, or when a quote or further-reading resource already stored on the lesson has a real body. A hors d'oeuvre or appetiser fills the harvest and never marks a course part watched.
- **Me tab.** Change your name, Keep my place, Share my opening answers, add my taps to trends, haptics, and Start again, which clears the opening here and on the server.
- **Pop-up questions.** Playback pauses at each question's second, the card rises, the answer saves, and playback carries on. Seeking past a question does not fire it. Answer later keeps it open. A strip under the player shows one mark per question. Triggers live in a registry in `src/lib/popups.ts`, so new kinds can be added beside the timestamp trigger.
- **Player layout flags.** A question card never covers the film. By default the paused video stays in view with the card below it; the strict layout keeps the whole player, chips and timeline included, clear of the card and its shade. The feed controls sit over the clip by default. The master switches either on the master Opening page. Signed-out visitors cannot read the flags.
- **Opening desks.** Master: scene wording with kill-list and publish checks (plurals, spelt-out letters, look-alike letters and markup are caught), nudge chips on each option, the player flags, the lanes and their tag queue, the ten scales (season left blank), trends (hidden below ten people, one row per account per week), a persona lens with balanced published ranges, and a simulator that runs the phone's routing on picked taps. Portal admin: a caption override, hiding at most two scenes (never the one with the help option), and help contacts, which take only phone numbers and https links and show as plain text. The same rules hold over REST, and a setup cannot be moved to another portal. Persona bands are master-only.
- **Compass.** After the opening, and again about once a month, the private reading steers talks toward the scales that sit below the middle, with a second scale kept in the mix. Learners see warm words only (`Growing`, `Steady`, `Flourishing`, or a line such as “Focusing on: patience, thankfulness”), two or three next steps, and a sentence about movement. The framing is editable on the master desk. Exact rungs stay with the system, the portal admin and the imam: each learner’s signed scale over time, the chapter summary, and the talks watched between looks. A home card invites the monthly look, which uses different wording and a short life check.
- **One tier record per talk.** The `talk-tiers` record is the only source of the hors d'oeuvre and appetiser times and lines, everywhere a learner meets them: the feed, the Lanes screen, a speaker's Watch intro, where the appetiser stops, and the resume link. A talk with several cuts is served once, through one carrier cut; the other cuts only lend it their lane tags.
- **Lanes.** Each lane card on the Lanes screen opens `/feed?lane=<key>`, which plays that lane's starter talks first (first, next, mains), then clips confirmed for the lane.
- **Review** (`/master/review`). One talk at a time: watch the hors d'oeuvre (H) and the appetiser (P), read the hook, turn and land with their times, then Approve (A), Adjust (E, which opens the tier editor) or Reject (R); J or → and K or ← move through the queue. `/master/review/popups` does the same for pop-up questions, with Approve and publish. The master flag "Show unchecked talks to learners" sits at the top: on, drafts are served as well as approved talks (this is how the demo is seeded); off, which is the default in production, learners see approved talks only. Rejected talks are never served.
- **Words learners read.** Pop-up questions and their options go through one check: the kill list after folding (NFKC, look-alike letters, accents, invisible characters, spelt-out and spaced letters such as "q u i z", stretched spellings such as "QUIZZ", words built on a listed root such as "quizlet", and rating a person, such as "rate yourself" or "out of 10") and a plain-text check that refuses HTML, entities and script. Hook, turn and land are the speaker's own words, so they must be plain text and appear word for word in the talk's transcript; when a talk has no transcript, they go through the kill list instead. Course, lesson, cut and ladder text is checked for markup.
- **Join limits.** A code that works is never refused because of anyone else's failures. Failed joins count against the address and the code tried together (5 in 10 minutes), and against the address alone (10 in 10 minutes) only when the address can be trusted. Join, sign-in and password-reset also have a basic attempt limit (see below). `X-Forwarded-For` is read only when `HEARTS_TRUSTED_PROXY_HOPS` says how many proxies of yours sit in front of the app, and then from the right, so a visitor cannot pick their own address. Without it the address is unknown, and only the address-and-code count applies; the 38 bits in each random code are what stop guessing.
- **Spam protection.** Join, sign-in and password reset (`/forgot`, `/reset`) show Cloudflare Turnstile when both keys are set, and the server checks the token before creating an account or starting a session. When the keys are missing (local, e2e, or a host that has not added them yet) the check is a no-op. Sign-in, join, forgot-password and reset also count attempts; answers count per learner and per address. Nothing here changes Cloudflare or Railway for you — see **Cloudflare in front of HEARTS** below.
- **Trends rule.** An account counts towards trends only when it has finished at least one video (marked as watched) and is at least 24 hours old. Contributions from other accounts are accepted and dropped, so accounts made in bulk cannot tilt the trends.
- **Three tiers per talk.** Each starter talk has a hors d'oeuvre (15 to 30 seconds), an appetiser (up to about 3 minutes, built on a hook, a turn and a land) and the main (the whole talk from 0:00, with pop-up questions). They nest: the hors d'oeuvre sits inside the appetiser (inside one of its hook, turn or land cuts when it has them), and the appetiser sits inside the talk. A tier that breaks this is refused by the desk, the sheet and the API. The appetiser stops at its out point. Next to the main there is an optional "Resume from where the appetiser ended" link. The master desk's Talk tiers page lists every talk; each talk opens an editor with sliders to scrub the in and out points, a preview that plays exactly that stretch, the caption lines to pick the hook, turn and land from, a button to mark it checked, and its pop-ups to edit, publish or add.
- **View as.** A portal admin can view as a learner in their portal, and the master as a portal admin or learner, never another master. A reason of at least 10 characters is required. Read-only by default, and that covers REST, globals and new records. Allowing changes needs its own reason of at least 10 characters and lasts ten minutes. Answers, the opening, Start again, privacy settings and joining with a code stay closed even then. Start, stop, refusals and writes go to the audit log. Leaving goes back to a path on the same site. The viewed person's device keys are kept apart from the viewer's and wiped on exit.
- **Unplayable clips.** When the player refuses a clip, the feed moves on and reports it. A clip is only taken off the feed when YouTube's own oEmbed answer confirms it cannot be embedded.
- **Points and unlocks.** A point can wait on an earlier one, with a countdown in days. The server refuses an early answer even if the form is forged.
- **Answers.** Private by default. A learner can share an answer to the portal's board.
- **HEARTS circle answers** (`/master/circle`, and `/p/<portal>/admin/circle` for portal admins). Answers that sit in a question's "What others said" beside real learners' shared answers, so nobody meets an empty list.
  - **Drafting.** Per talk or per question, choose how many (1 to 12), which tones (warm, honest, practical, searching, quiet) and which lengths (short, medium, long). The AI writes them when a key is set, using the question, its choices and what the speaker says around that moment. Otherwise, or when the AI reply fails the checks, the built-in drafts fill the count.
  - **Looking after them.** Staff can write their own (marked "Written by staff"), edit, delete, and switch any answer off or on, one at a time or all at once for a talk or a whole course. An answer that is switched off stays on the desk.
  - **What learners see.** The answers are mixed in among real ones, in the same style, with a light label under the name. The label is "From the HEARTS circle" by default, and the master can change it on the circle page.
  - **Stepping back.** As real shared answers arrive, fewer circle answers are shown (at most six at a time). At the threshold (default 8, set by the master) none are shown, though they stay available on the desk. The talk page tells the admin how many a learner sees right now. Which answers a learner sees, and where they sit, stays the same for that learner on reload.
  - **Scope.** The master desk can add them to any talk, and they show in every portal. A portal admin can add them only to their own portal's courses, and those show only in that portal. Teachers do not get the page.
  - **Checks.** Every name and answer goes through the kill list and the plain-text check, on the desk and in the collection hook, and so does the label.
  - **Never counted.** They live in their own `circle-answers` collection, which only the swarm, the circle desk, the master sheet and the seed read. Analytics, trends, the profile, the workbook, the CSV and the teacher's and imam's progress views read `answers`, so circle answers never reach them. Learners only see them when they have opted in to the swarm.
  - **Activation tasks.** A task can carry circle answers like any other question, so "What others said" under it is not empty. They never mark a task done, never reach the imam's view of who did it, and never count towards progress. A workbook reflection takes none, because nobody sees a swarm in the workbook.
- **Master sheet** (`/master/sheet`, and `/p/<portal>/admin/sheet` for portal admins). One Excel workbook loads talks, pop-up questions, activation tasks, resources, circle answers and speakers in bulk, and the same workbook comes back out as an export. Google Sheets can open it.
  - **Tabs.** Talks, Questions, Resources, CircleAnswers and Speakers. Each tab starts with a note row that explains its columns. The blank template and an example export of the seeded library are in `content/` (`npx tsx scripts/sheet-examples.ts` writes them again).
  - **Speakers.** A speaker has a name, honorific, display name, aliases, a short bio, a photo, links and sources. Talks and courses keep the speaker’s words and also point at that record. A known alias on a talk, such as “Sh. Mohammad Elshinawy” or “Alaeddin Albakri”, is stored as the one speaker. The learner app shows the bio at `/p/<portal>/speaker/<slug>`.
  - **Dry run first.** An upload shows every add, change, removal and problem by tab, row and column. Nothing is saved until the preview is applied, and apply stays off while any row has a problem. The last import can be undone.
  - **CircleAnswers tab.** One row is one circle answer under a question, named by the question_id from the Questions tab. Leave circle_id blank to add one, fill it in to change that answer, or put delete in status to remove it. Rows go through the same kill list and plain-text checks as the circle desk. A row is refused when the question is a workbook reflection, is rejected, or is deleted by the same sheet. Re-importing a row with no circle_id does not add a copy. Deleting a question or a talk through the sheet takes its circle answers with it, and undo brings them back under the restored question.
  - **Scope.** A portal admin can only import into courses made in their own portal. Circle answers they add belong to that portal.
  - **Packs.** An imported course can land straight in a pack that portals already use. Either fill the optional `pack` column on the Talks tab (the pack's name or number), or, in the preview, choose a pack for all the new courses in the sheet. The master desk can use any pack; a portal admin only their own portal's packs. From then on, people who join with that pack's codes get the course.
  - **Pushing to existing learners.** Learners who joined earlier keep the course list they joined with. A tick box in the preview, off by default, also gives the new pack courses to learners who already hold the pack, through their code or a personal grant. Both choices go in the audit log (`sheet.import`, plus `sheet.pack_push` with the learners reached), and undo takes the courses back out of the pack and out of those learners' lists.
  - **Doors.** The Talks tab has a `jibril_door` column (W1 to W20) just before `jibril_clause`, and the export fills both. A sheet can fill either: a door alone keeps the talk's clause when it already sits in that door, and otherwise takes the door's first clause. `W3` in the clause column is read as a door too, and a bare 1 to 20 works in the door column. When both are filled, the clause must sit in that door. Sheets without the column import as before.
  - **Re-applying a sheet.** A question row with no question_id is matched to its question by talk, time and text before anything is compared, so applying the same sheet again reports no updates.
- **Teacher replies** raise an unread badge and an in-app notification, and land in the learner's workbook.
- **Schedule.** Lessons are spread in order across the weekdays you pick. Earlier days take the remainder, so 6 sittings over 4 days come out as 2, 2, 1, 1. It is a guide, and missing a day does not lock the course. A sitting counts at 80% watched, or when the film ends. A plan covers a year at most, and an unnamed plan takes the season's name, such as "Autumn study days".
- **Nights and RSVP.** A ticket is earned by finishing a lesson in the last 7 days, and is held otherwise. Self check-in needs an earned ticket. Staff can check anyone in.
- **Garden.** A 14-day chart drawn from real completions.
- **Harvest** (`/p/<portal>/garden/harvest`). When a learner finishes a talk, the verses and hadith the speaker quotes are added to their Garden automatically, in the speaker's own words. Nobody reviews them first.
  - **Each card** shows the quote, the talk and the time. Tapping it replays the talk from 5 seconds before the quote. A placed ayah shows the Arabic above the Saheeh International translation.
  - **Filters and grouping.** Filter by Qur'an or hadith. Group by talk, or by the door of the hadith of Jibril the talk sits in. Cards the learner has not opened yet are marked New, and the Garden's Harvest ring shows how many. View-as never clears the marker.
  - **Which ayah.** `src/lib/quran-match.ts` matches the speaker's words against the full Qur'an: first the Arabic they recite, then their transliteration, then their English against Saheeh International, Yusuf Ali and Pickthall. A match must beat every other ayah outright. With no confident match the card shows the quote only, with no reference, and "See it in context" is hidden. Al-Fatiha 1:2, for example, also occurs word for word at 39:75 and 40:65, so it is left unplaced.
  - **Which hadith.** A hadith is placed only when the speaker names the collection (Bukhari, Muslim, Tirmidhi, Abu Dawud, Nasa'i, Ibn Majah, Malik or Nawawi's Forty) and one hadith in it matches clearly; a named narrator must match too. When a collection repeats the same hadith in several chapters, the first one is cited (Sahih al-Bukhari 1 rather than 54).
  - **See it in context.** The ayah with three either side, Arabic and English; for a placed hadith, its full English and Arabic text, reference and grading.
  - **What do the scholars say?** Either "Read the tafsir", which shows the full text of each source under its own title (Tafsir Ibn Kathir and Tafsir al-Jalalayn in English and Arabic, and Tafsir al-Sa'di in Arabic), or "A short summary". The summary is written by the AI only from those texts, labelled "AI summary of" and the names of the sources it used, with a link to the full tafsir. Without an AI key it says so and shows Tafsir al-Jalalayn, itself a short tafsir, in its own words. Nothing is ever made up: a source that cannot be fetched is left out.
  - **Caching.** A talk's matches, each ayah's tafsir and each summary are stored in the `scripture-cache` collection (master-only), so the network and the AI are asked once.
- **The extractor** (`src/lib/extractor.ts`). It reads a timed transcript and proposes cuts. Every hook, turn, land and quote must match the transcript word for word, every timestamp must be a real cue start, and estimated timestamps are never marked high confidence. A reworded line is rejected.
- **Only full talks in a course count.** Watching a hors d'oeuvre, an appetiser, a typography film or a card never moves a course, the Garden or time given. A part counts once most of it (80%) has played on the course page, counted from the seconds that actually played there, not from where the playhead started; and a question counts once it is answered in the course (an answer given from the feed is kept but marked as browsing until it is answered again in the course). Browsing fills only the harvest and the feed's soft "drawn to" signal (lane affinity), which shapes what comes next but never completion. In the feed, a swipe stays on the level being watched, and "Learn more" goes to the parent of that same item: hors d'oeuvre to its appetiser, appetiser to its talk from 0:00.

### Stand-ins

- **Email is not sent.** Replies and feedback create an in-app notification and an "email not sent" note. Payload logs mail to the console.
- **AI is optional.** With `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` set, the extractor asks the model for suggestions and checks them against the transcript, and HEARTS circle answers are drafted by the model. Without a key the extractor uses its own rules and circle answers come from the built-in drafts, which is how the seed and the tests run.
- **A new question's circle answers come in a second upload.** The CircleAnswers tab names questions by question_id, and a new question has no id until its import is applied. Import the question, export again, then add its circle answers.
- **YouTube captions** are often refused from cloud machines. See the transcript chain below. When every step fails, the title is still saved from YouTube, and you can upload a `.vtt`, `.srt` or `.txt` transcript to run the extractor.
- **Video files.** Mux is not wired up. A non-YouTube share link is stored but not downloaded. Uploads over 200 MB are refused.
- **Follow, like and save** in the feed are kept on the device only.
- **Watch history** is stored only after the learner opts in.
- **Completion trusts the browser.** The seconds watched are reported by the page, so a determined learner could fake them.
- **Talk tiers are machine drafts.** Every starter talk and every main has hors d'oeuvre and appetiser cuts, hook, turn and land lines, and two or three pop-ups drafted from its shipped captions. All of them say "needs a human check" until someone approves them on Review or Talk tiers. Draft pop-ups are never shown to learners. Draft tiers are shown only while the master flag "Show unchecked talks" is on; the seed turns it on for the demo, and it is off on a fresh install.
- **Auto captions without punctuation give weaker cuts.** Where YouTube's captions have no full stops, the extractor guesses sentence ends from pauses and from words that cannot end a sentence ("and", "the", "a"). On about five of the 31 talks (HfIT8TSoHiE, UGuKJLZnbi8, N_-YiwIb-u0, FAxIZIqwfd8 and Rd0e9kXdPvI) a hook or turn still starts or ends mid-thought. They stay drafts until someone trims them on Review.
- **YouTube blocks yt-dlp from cloud machines.** On the build machine every request was refused, even as the `web_embedded` player, so new talks there need a transcript upload or your own transcript service. The shipped talks use captions saved in `content/`.
- **The paused-player scrim test** is skipped when YouTube's player does not load in the test browser, because there is no film to pause.
- **Video does not stream on the build machine.** YouTube's player loads there but plays no frames, so the e2e tests check captions, crops and layout with the film paused at its in point. Timed captions moving through hook, turn and land were checked against a stand-in player clock, not a playing film.
- **Some caption times are estimates.** Rolling auto captions repeat each line; the importer keeps the first full appearance, so a cut can be a second or two off.
- **Trends** count each person once per week, only for people who opted in, and hold back any week under ten people. The seed has no contributions, so the trends screens start empty.
- **Persona bands are a balanced draft.** The source tables left Anger and Greed empty and gave Devout Practitioner and Traditionalist the same ranges, so every band now has its own range on all ten scales, chosen as a balancing step rather than taken from Leon’s figures. Season on the scales is still blank. The bands are editable at `/master/personas`, and a persona is never stored on a person or shown to them.
- **Rate limits live in memory.** Join failures, sign-in, password-reset and answer posts, and the "won't play" report are counted inside one server process. They reset on restart and are not shared between servers. Behind a proxy, set `HEARTS_TRUSTED_PROXY_HOPS` or, with Cloudflare in front, `CF_CONNECTING_IP=1`. A school sharing one address could hit the per-address limits together. The e2e server (`HEARTS_E2E=1`) does not count these, so the suite can sign in many times.
- **npm audit is not clean.** `postcss`, `sharp` and `dompurify` are pinned to patched versions in `overrides`. The 17 advisories left all come from Payload 3.90: it accepts Next 15.4 or Next 16.3.3 and later, while every Next fix is in 15.5.24 or 16. Moving to Next 16 is a major upgrade that has not been done or tested yet. Until then the image optimiser is off (`images.unoptimized`), which closes the `/_next/image` route behind the two critical Next advisories. The rest are Payload's own `undici`, its `drizzle-kit`, `esbuild` and `chokidar`/`sass` build tools, and denial-of-service or proxy-bypass issues in Next 15.4 itself. `npm audit fix --force` would drop Payload to 3.85, so do not run it.
- **Haptics** use the browser's vibrate call, which iPhones ignore.
- **Lane tags** are confirmed or rejected by hand on the master Lanes page. Nothing tags clips automatically yet.
- **Help contacts** are the real public numbers, but no one has checked them for each portal's area.

## YouTube transcript chain

`src/lib/youtube.ts` tries each provider in turn and uses the first transcript it gets:

1. **yt-dlp.** `npm run setup` puts a pinned release (2025.09.26, checked against its published SHA-256) in `bin/`; `node scripts/get-yt-dlp.mjs` does just that step. It asks YouTube as the `web_embedded` player, which servers are blocked from least. When YouTube still blocks the network, the error says so in plain words. Set `YT_DLP_PATH` to use another copy, or `HEARTS_DISABLE_YTDLP=1` to skip it.
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

The circle label and threshold are not environment variables. They are fields on the `master-flags` global (`circleLabel`, `circleThreshold`), set on `/master/circle`.
| `TRANSCRIPT_SERVICE_URL`, `TRANSCRIPT_SERVICE_TOKEN` | Your own transcript service, as above |
| `YT_DLP_PATH`, `HEARTS_DISABLE_YTDLP` | Where yt-dlp is (default `bin/yt-dlp`, then the PATH), or skip it |
| `HEARTS_TRUSTED_PROXY_HOPS` | How many proxies of yours sit in front of the app. Unset, `X-Forwarded-For` is ignored |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile keys. Both must be set. Missing keys leave join, sign-in and password reset unchanged (local and e2e stay a no-op) |
| `TURNSTILE_VERIFY_URL` | Optional. Defaults to Cloudflare’s siteverify address. Used by tests |
| `CF_CONNECTING_IP` | `1` tells the app to trust Cloudflare’s `CF-Connecting-IP` header. Also implied when `TURNSTILE_SECRET_KEY` is set |
| `HEARTS_TEST_CLOCK` | `1` turns on the test clock. Only the master desk can move it, signed-out reads are refused, and a production build ignores it |
| `HEARTS_E2E_PORT`, `HEARTS_E2E_REUSE` | Port for the server the e2e run starts (default 3100), or `1` to reuse one already running there |
| `HEARTS_SCRIPTURE_OFFLINE` | `1` reads only the bundled scripture and never fetches. The seed and the e2e server always work this way |
| `HEARTS_NOW` | Pins the app's idea of "now" to a date, such as `2026-10-01T09:00:00Z`. For demos and tests |
| `BACKGROUNDS_BASE_URL` | The app's own origin, such as `https://heartshigh-production.up.railway.app`. Stills load from `{origin}/backgrounds/jpg/<file>`, which the app answers with a 302 to a one-hour signed GET for `backgrounds/jpg/<file>` in the S3 bucket (the `S3_*` settings used for media). Only catalogue filenames are served; anything else is a 404. Unset, the six local stills in `public/slides/` are used, with the gradient if a still fails to load |

On a Cloud Agent, put keys in the Cursor Dashboard under Cloud Agents, then Secrets. Do not commit them.

## Cloudflare in front of HEARTS

Do this in the Cloudflare dashboard. Do **not** change Railway, DNS at the registrar, or Turnstile from this repository. The app only reads the keys you paste into the host’s variables.

1. **Add the site in Cloudflare.** Create a zone for the public hostname people will type (for example `hearts.example.com`), or use the existing zone if the domain is already there.
2. **Point DNS at Railway (or the current host).** Add a CNAME or proxied A/AAAA for that hostname to the Railway address (the `*.up.railway.app` name, or the service’s target). Turn the orange cloud **on**, so visitors hit Cloudflare first. Leave Railway’s own generated domain as it is; Cloudflare is an extra hop in front, not a replacement for the host.
3. **SSL.** Use **Full (strict)** once Railway has a valid certificate (it does on `*.up.railway.app`). If you only have the Railway domain for now, you can skip a custom hostname and still use Turnstile.
4. **Turnstile.** In Cloudflare, open **Turnstile**, add a widget for the public hostname, and choose **Managed**. Copy the **site key** and the **secret key**.
5. **Paste the keys on the host.** In Railway (or Render/Fly) variables, set:

   | Variable | What to paste |
   | --- | --- |
   | `TURNSTILE_SITE_KEY` | The Turnstile site key |
   | `TURNSTILE_SECRET_KEY` | The Turnstile secret key |
   | `CF_CONNECTING_IP` | `1` |

   Redeploy after saving. Until both Turnstile keys are set, the forms work as they do today and tests stay green.

6. **Visitor addresses.** With the orange cloud on, Cloudflare overwrites `CF-Connecting-IP` with the real visitor. The app uses that header when `CF_CONNECTING_IP=1` or when the Turnstile secret is set. Do not set `HEARTS_CLIENT_IP_HEADER` to `x-forwarded-for`.
7. **What this does not do.** It does not change live DNS, create a Cloudflare account, or turn on a WAF rule from here. Optional later: a Cloudflare WAF rate-limit on `/join`, `/login` and `/api/users/login`. The in-app limits still apply.

Password reset uses `/forgot` and `/reset`. Email is still a stand-in (Payload logs the message). The reset link appears in the host logs until real mail is wired. The form still goes through Turnstile and the rate limit.

## The mark

HEARTS uses the word HEARTS with a fine gold arch (`src/components/arch.tsx`, wrapped by `BrandMark` and `BrandLockup` in `src/components/brand.tsx`). The home-screen icons are in `public/icons/`.

## Tests

```bash
npm run test:unit      # 249 tests
npm run test:e2e       # 171: 13 journey, 43 opening, 28 round 3, 15 round 4, 12 view-as, 6 circle, 8 harvest, 2 harvest lines, 4 AI steps, 6 master sheet, 2 sheet builder, 3 circle sheet, 4 sheet packs, 6 doors, 6 nesting, 1 nesting and progress, 1 feed levels, 1 typography, 2 integration, 1 security and 7 screenshot tests
npm run screenshots    # screenshots only
```

- **Unit tests** (`src/lib/*.test.ts` and `tests/unit/*.test.ts`) cover extractor quality on all three transcripts, placing, the clause map, the 20 doors against Leon's file (`tests/unit/doors.test.ts`), seat suggestions, unlocks and countdowns, the transcript chain and VTT output, the opening's scoring and routing (`heart.test.ts`), and pop-up triggers, seeking and the trends threshold (`popups.test.ts`).
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
- **Opening tests** (`tests/e2e/opening.spec.ts`) follow section 8 of the opening build spec, numbered 1 to 37 to match it, plus 38 to 42 for the balanced persona bands, scale editing, the learner path (no raw scores in the API), the imam’s signed-scale chart, and the monthly card.
- **View-as tests** (`tests/e2e/view-as.spec.ts`) are 38 to 49: reasons, read-only refusals, private rows, device keys, exit, who may view as whom, the audit log, allowing changes, and what stays closed.
- The e2e run **reseeds its own test database** before it starts.
- **Circle tests** (`tests/unit/circle.test.ts` and `tests/e2e/circle.spec.ts`) cover:
  - built-in drafting against the word checks;
  - the label and its CMS wording;
  - fading out at the threshold while the desk keeps the answers;
  - exclusion from analytics, trends, the profile, the workbook CSV and progress;
  - portal scope;
  - kill-list refusals and bulk on and off;
  - the CircleAnswers sheet rows.
- **Master sheet tests** (`tests/unit/master-sheet.test.ts`, `tests/unit/sheet-load.test.ts`, `tests/unit/sheet-creator.test.ts`, `tests/unit/speakers-sheet.test.ts`, `tests/unit/speakers-import.test.ts`, `tests/e2e/master-sheet.spec.ts`, `tests/e2e/sheet-creator.spec.ts`, `tests/e2e/circle-sheet.spec.ts` and `tests/e2e/sheet-packs.spec.ts`) cover re-applying an unchanged sheet, the pack column, the preview's pack choice and push tick box, the template, round trips, every error by tab, row and column, portal scope, undo, 500 rows, the sheet builder, speaker aliases, and the CircleAnswers tab: adding circle answers to an activation task without counting them, deleting a question with its circle answers and undoing it, and portal-owned answers.
- **Door tests** (`tests/unit/doors.test.ts`, door cases in `heart.test.ts` and `master-sheet.test.ts`, and `tests/e2e/doors.spec.ts`) cover the map covering all 41 clauses once, door parsing, placing by door, the spine and lane ranks in doors, first-week door exclusions, the old spine pointer moving to doors, and the sheet's door column. The e2e uses the seeded talks: the migration's 20 rows, the learner Garden, door pages, course chips and harvest grouping with no clause text on any learner screen, the feed API's spine and trust-lane push, the desk's door label beside the clause, and a sheet import by door with undo.
- **Nesting tests** (`tests/unit/nesting.test.ts` and `tests/e2e/nesting.spec.ts`) cover every drafted, seeded and served hors d'oeuvre sitting inside its appetiser, a tier that strays being refused, the 15 to 30 second range, levels and "Learn more", the 80% sitting rule, feed answers and short watching leaving the course and the Garden alone while course answers and a full sitting count, the course page sending only the seconds it played, and swipes keeping the appetiser level.
- **Harvest tests** (`tests/unit/harvest.test.ts` and `tests/e2e/harvest.spec.ts`) cover matching by Arabic, transliteration and English; no reference when the match is not sure (including the Fatiha); quotes kept word for word; a hadith placed only from a named collection with the right narrator; the tafsir bundle; the summary's source label, its cache and the no-AI fallback; replay from 5 seconds before; and a learner finishing a talk and using the whole screen: the Garden count, New, filters, grouping, replay, context, the scholars choices and portal scope. The e2e uses `tests/fixtures/harvest-talk.vtt`, a short talk written for the test.
- **Feed level tests** (`tests/unit/feed-nav.test.ts` and `tests/e2e/feed-levels.spec.ts`) hold the navigation rule: a swipe moves to the next item on the same level, so hors d'oeuvres (typography films, scenic and question cards included) loop among themselves and appetisers among themselves, and only Learn more goes down, from an hors d'oeuvre or its card to its own appetiser and from that appetiser to its own full talk. The unit tests try every swipe from every item of a mixed feed; the e2e walks the seeded feed at 390x844. The rule lives in `src/lib/feed-nav.ts`.
- **Background route tests** (`tests/unit/backgrounds-route.test.ts`) check that all 240 catalogue rows are written `jpg/<basename>`, that each resolves to the bucket key `backgrounds/jpg/<basename>` and gets a 302 to a signed URL with the redirect's `Cache-Control`, that unknown names and traversal attempts get a 404, and that without S3 settings the route is a 404 and the feed keeps its local stills.
- **Integration tests** (`tests/e2e/integration-final.spec.ts`) walk the whole learner path at 390x844 after the final merge: joining by code, the persona quiz, swipes that stay on the level, Learn more from hors d'oeuvre to appetiser to the full talk, harvest grouped by the 20 doors, the speaker page, a pop-up on a talk imported from the master sheet saving to the workbook, and short clips never counting as parts watched. A second test walks the portal admin's short setup. Set `HEARTS_VIDEO=/path/to/file.webm` to record the learner path.
- **Round 4 tests** (`tests/unit/round4.test.ts` and `tests/e2e/round4.spec.ts`) hold one regression test per item from the round 4 retest, named by its label (N4, L1, K1 and so on), including sentence boundaries, hook choice and turns over all 31 talks.
- **Round 3 tests** (`tests/unit/round3.test.ts` and `tests/e2e/round3.spec.ts`) hold one regression test per bug from the round 3 report, each named "Bug N: ...", plus the section T checks over all shipped transcripts. `tests/unit/safety.test.ts` and `tests/unit/config.test.ts` cover the kill list, reserved addresses, contact links, the clock rules and the e2e server settings.
- The e2e run starts its own server on port 3100 with `HEARTS_TEST_CLOCK=1`, its own database (`data/hearts-test.db`) and its own build folder (`.next-e2e`), so it does not touch `npm run dev` or your demo data. Set `HEARTS_E2E_REUSE=1` to reuse a server you started yourself on that port.
- Set `SCREENSHOT_DIR` to choose where screenshots go. The default is `artifacts/screenshots/`. Learner screens are 390 by 844 and desk screens 1440 by 900.
- `node scripts/compare-boards.mjs` puts design boards beside the matching screenshots. It expects the board images at `/tmp/panel1.png` to `/tmp/panel5.png` and `/tmp/g1.png` to `/tmp/g6.png`, or pass a folder: `node scripts/compare-boards.mjs <boards> <screenshots> <out>`.

Console messages from inside the YouTube player come from YouTube's own frame, and the console scan ignores them.

## Build

```bash
npm run build
```

The build passes with no type errors. Stop the dev server first. After a build, delete `.next` before starting the dev server again, or it may serve pages from a stale cache and return 500s.

## Shape

Payload CMS 3, Next.js 15 and SQLite on your own computer. A public server uses Postgres, chosen by `DATABASE_URL` (a `postgres://` address) or `DATABASE_ADAPTER=postgres`. The multi-tenant plugin hangs portal data off `portals`. Forms post to `/api/hearts`, which checks the account and the portal, then redirects back with a notice or an error. Learner screens are in `src/screens/app`, desk screens in `src/screens/desk`, and server logic in `src/server`.

## Hosting

The steps for a public site are in [DEPLOY.md](DEPLOY.md), written for someone who is not a programmer. Railway is the host that guide uses. `render.yaml` (at the repository root) and `fly.toml` are the notes for the other two.

`npm start` is the production server: it checks the variables, applies migrations, and refuses to boot if a demo `@hearts.test` account is present. It does not seed. `npm run bootstrap` creates the first master admin from `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`, once. `npm run seed:starters` loads the talks without those demo passwords. `npm run reseed` still wipes a database on this computer only, SQLite or Postgres, and it refuses in production.

- **The first account comes only from `npm run bootstrap`.** Payload's own "create first user" screen (`/admin/create-first-user`) sends people to the sign-in page, and its endpoint (`/api/users/first-register`) answers 403, on every install. On top of that, the users collection refuses any new account that does not come from the server itself (joining with an access code, the seed, bootstrap) or from a signed-in master. So an empty database cannot be claimed by whoever finds the address first, and no outside request can make an account with admin access. `tests/unit/first-user.test.ts` and `tests/e2e/security.spec.ts` cover this.
- **The image carries no secret.** The Dockerfile passes no `PAYLOAD_SECRET` or `DATABASE_URL` as `ARG` or `ENV`. While `next build` runs, the config uses its build-only fallback and a throwaway SQLite path, which is deleted before the image is finished. The running server refuses to start without real values from the host's variables, and refuses the fallback too.
- **Schema changes need a Postgres migration.** SQLite on your computer follows the code by itself, but Postgres changes only through `src/migrations`. After adding or changing a collection, run `npx payload migrate:create <name>` with `DATABASE_URL` pointing at a local Postgres that has the earlier migrations applied, and commit the new files. A unit test fails if the latest migration is missing a table for any collection.
