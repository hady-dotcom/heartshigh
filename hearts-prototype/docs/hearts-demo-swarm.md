# Swarm sample answers on hearts-demo

This is additive. It never wipes a database, never deletes an answer, and never touches passwords.

Talk and feed questions show “What others said” as initials. Those rows are HEARTS circle answers: staff-written, AI-screened style, read-only. They are not learner answers and they never count as progress.

## What this adds

- Four to six circle answers on every non-workbook question that has fewer than four, including the starter-talk pop-ups and the demo sittings question (“What will you carry from this sitting into tomorrow?”).
- Names stored as two words (`Yusuf Khan`) so the learner swarm shows initials (`YK`).
- The four default joining questions stay global (every portal). A richer extra bank can be attached per portal. Portal admins add extras from the bank or write their own at `/p/<portal>/admin/questions`.

## Apply on hearts-demo

On a local checkout that already has data:

```bash
cd hearts-prototype
npm run demo:circle
```

On the hosted hearts-demo service (Railway shell, or any host whose `SERVER_URL` names hearts-demo):

```bash
cd hearts-prototype
HEARTS_DEMO=1 npm run demo:circle
```

`HEARTS_DEMO=1` is the only way this script will write to a remote or production database. Without it, the command prints a refusal and changes nothing.

A second run is safe. Questions that already have four or more circle answers are skipped. Joining questions that already exist (matched by prompt) are skipped.

`npm run circle:fill` is the same circle fill without attaching the extra joining bank. `--dry-run` prints the plan and writes nothing.

## Do not

- Do not run `npm run reseed` or `npm run seed -- --reset` on hearts-demo. That wipes the database.
- Do not run `npm run seed` on a public host. That creates `@hearts.test` passwords from the README.
- Do not use this to backfill a live community portal. Circle answers added with no portal field show on every portal.

## After it has run

1. Sign in as a learner who has opted in to “Share answers with other learners” (Me).
2. Open a talk that has a question (Fahmy session 6, Ar-Rabb, Al-Nur, or a starter whose pop-ups are visible).
3. Open the question. “What others said” should list several initials, each with a short human answer.

Portal admins: `/p/hearts-demo/admin/circle` to switch answers off, and `/p/hearts-demo/admin/questions` to attach more joining questions or add your own.

A fresh local demo (`npm run go` or `npm run seed`) already fills circle answers after the starter map is written, and attaches the extra joining bank if a `hearts-demo` portal exists (`npm run demo:timed-learners` creates that portal).
