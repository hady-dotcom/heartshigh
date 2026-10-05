# Afternoon walkthrough on hearts-demo

This is the one-shot fill for the production HEARTS demo portal. It is additive. It never wipes the database, never writes another portal, and never changes a password that is already there.

Run it after this branch is live, in the Railway shell on production.

## What Leon opens

Production: [https://heartshigh-production.up.railway.app](https://heartshigh-production.up.railway.app)

Portal: `/p/hearts-demo`

**Named learner (this is the full garden):**

| | |
|---|---|
| Email | `walkthrough@hearts.foundation` |
| Password | `walkthrough-afternoon` unless the host set `HEARTS_DEMO_WALKTHROUGH_PASSWORD` |
| Name | Amina Yusuf |

Sign in at `/login`, then you should land in `/p/hearts-demo`.

Do **not** join a new account if you want the filled garden. A new join makes an empty learner. The join code is only to show the join screen, or for a guest who will start from scratch.

**Join path (show the screen, or print the code):**

The seed prints the current learner code. On production it has looked like `HEARTSDE-9QFE-VNEV`. Codes are random; reuse whatever the shell prints.

```
https://heartshigh-production.up.railway.app/join?code=<printed-code>
```

If `demo-learner@hearts.foundation` already belongs to hearts-demo, the seed fills that account too and leaves its password alone.

## How to run it on Railway production

In the production app service, open **Shell** (or `railway ssh` from `hearts-prototype`):

```bash
npm run demo:walkthrough
```

That is the one command. It is safe to run twice. A second run adds nothing that is already there, and refreshes **My week** onto this week so the strip is not stale.

Optional, only if you are creating the walkthrough account for the first time and do not want the default password:

```bash
HEARTS_DEMO_WALKTHROUGH_PASSWORD='your-own-long-password' npm run demo:walkthrough
```

If the account already exists, that variable is ignored. The password is not changed.

### What must already be on the host

1. `npm run bootstrap` has been run once (master admin).
2. `npm run seed:starters` has loaded the talks. This walkthrough fill does not load films. It marks progress on talks that are already there.

Do **not** run `npm run seed` or `npm run reseed` on production. Those are refused, and they would create `@hearts.test` accounts.

## What lands on hearts-demo

For `walkthrough@hearts.foundation` (and `demo-learner@hearts.foundation` if that account is already on the portal):

- Opening answers already filled, so the path and Garden are not blank. Private opening rows stay private.
- Substantial watch progress, or completion, on the key demo talks when they exist in the library:
  - Names Class / Ar-Rabb
  - How to Live Like the Prophet
  - Names Class / Al-Nur
  - Divinely Sheltered, if that title is in the library
  - Other starter talks on the feed (anxiety, mosques, wealth, gratitude, time, dua, and similar)
- Garden watched counts, harvest lines from finished talks that have a transcript, and small acts kept with ordinary wording.
- Workbook entries in a human voice. A few stay private. Shared ones can appear in the swarm as initials.
- HEARTS circle sample answers on those questions, scoped to hearts-demo, labelled **From the HEARTS circle**, first names only (the swarm shows initials).
- A **My week** plan named “Walkthrough week” with a few sittings on this week, including today.

The seed will say if Divinely Sheltered is missing. Everything else still fills.

## Privacy

- Private workbook answers stay private. They are never copied into the swarm.
- Circle answers are not real accounts. They never count as progress.
- Other portals are not written.

## Local check

```bash
cd hearts-prototype
npm run demo:walkthrough
```

On a local database this creates the portal if it is missing, then fills the same account. Sign in as `walkthrough@hearts.foundation` / `walkthrough-afternoon`.
