# HEARTS prototype

A working portal CMS and a phone-first learner app. The master desk opens a portal. Each portal has its own admin, its own access codes, and its own learner room. Courses linked from the library stay linked: a change in the library shows up in the portal, and the portal cannot edit the original.

## Run it

```bash
cd hearts-prototype
npm install
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Seeded sign-in:

| Who | Email | Password |
| --- | --- | --- |
| Master | master@hearts.test | hearts-master |
| East London admin | elm-admin@hearts.test | portal-admin |
| East London teacher | elm-teacher@hearts.test | portal-teacher |
| East London learner | elm-learner@hearts.test | portal-learner |
| Leeds learner | leeds-learner@hearts.test | portal-learner |

Access codes: `ELM-ADMIN`, `ELM-TEACH`, `ELM-LEARN`, `ELM-PARENT`, `LEEDS-TEACH`, `LEEDS-LEARN`. A join link looks like `/join?code=ELM-LEARN`. Each code on the portal’s Access page has that link and a QR code.

## What is seeded

- The 41 clauses of Hadith Jibril, three Ghunya seats under each, and the shelf list from `content/ghunya-shelf.txt`.
- Yasir Fahmy, *How to Live Like the Prophet*, session 6, from `content/transcripts/fahmy-session6.md`. The extractor has already approved one cut.
- Shaykh Mikaeel Smith, *The Names* class 19 Ar-Rabb (`https://www.youtube.com/watch?v=ECaTWkof57E`) and class 20 Al-Nur (`https://www.youtube.com/watch?v=MK5q_zMiX1g`), with the transcripts in `content/transcripts/`.
- Two portals: East London Mosque and Leeds Chapter. Leeds cannot see East London’s board, workbook, or people.
- Welcome and intro films for learners and teachers on the East London portal.

YouTube often refuses captions from a cloud machine. Paste a watch link anyway: the title is saved when YouTube answers, and a `.vtt`, `.srt`, or `.txt` transcript still runs the extractor. A non-YouTube share link is stored, not downloaded. Files over 200 MB are refused.

## Tests

```bash
npm run test:unit
npm run test:e2e
```

`test:e2e` seeds the database, starts the app with the test clock on, and walks the master, admin, learner, parent, and isolation paths. Screenshots of the phone width land in `artifacts/screenshots/`.

The schedule splits lessons in order across the weekdays you pick. Earlier days take the remainder, so a plan of 6 sittings over 4 days is 2, 2, 1, 1 and does not leave a hole in the middle. It is a guide. Missing a day does not lock the course. A sitting counts at 80% watched, or when the film ends. On time means it was watched on or before the planned day.

## Shape

Payload CMS 3, Next.js, and SQLite (`data/hearts.db`). The multi-tenant plugin hangs tenant data off `portals`. Portal identity for an action comes from the signed-in account and the portal address in the form, never from a numeric id the browser could swap. A master names the portal address. Anyone else is held to their own portal.

A code is a role plus a course pack. Learner and parent codes also name a teacher code. A parent code is a learner who carries exactly one course. Joining copies the pack into that person’s list. Later edits say whether to leave people, add, remove, or replace. A personal grant shows up on the next page.

Imported courses are read-only. Teachers can still lay a question on top, for everyone, for themselves, or for chosen learners, without writing onto the library film.

Email is not sent. A teacher reply and a feedback note raise an in-app notification and an “email not sent” stub. Watch history is stored only after the learner opts in.
