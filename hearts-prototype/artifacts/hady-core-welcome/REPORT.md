# Hady Core welcome films and system rename

Leon’s “I’ve made this” is the existing heartshigh app, not a new upload. This work continues the Welcome + Intro portal films and renames the product people see to **Hady Core**.

## What learners and admins see

- Product name is **Hady Core** on the door, desk, join, install card, circle label, calendars, feedback PDF, master sheet notes, and admin docs.
- Repo, `/p/…` URLs, `/api/hearts`, `@hearts.test`, env keys, and `hearts.db` stay as they are.
- A portal still stored as “Hearts” shows as Hady Core; the slug is unchanged.

## Welcome and Intro films

- Portal Settings has four slots: learner welcome, learner intro, teacher welcome, teacher intro.
- Each slot can **Add** a file (stored as portal-asset media) or keep a YouTube link. Clear empties the slot. A `?` help tip sits on every control.
- First login or first time after join: Welcome → Intro, then into the app. Skip is always there.
- An empty slot is a quiet placeholder plus Skip. Both empty: the walk is skipped and `seenWelcome` is left unset, so a later upload can still play.
- Returning people who already skipped never see the walk again.
- Evening-garden look (teal `#0E2A2B`, gold `#D4A84B`). Captions are spoken words only — no frozen title over the film.

## Friendlier desk copy

- Desk actions that used to say “ingest” now say **Bring in**.
- A single file uses **Add**.
- A sheet batch uses **Load**.
- Hidden form actions and test ids stay `ingest` so tests and the API do not break.

## Proof shots

Generated with `npx tsx scripts/proof-welcome.mts` against the e2e server on `:3100`.

| File | What it shows |
| --- | --- |
| `desk_welcome_slots.png` | Portal Settings, four film slots, Add film |
| `desk_welcome_help.png` | `?` help pop-up on a slot |
| `desk_hady_core_name.png` | Master desk branded Hady Core |
| `first_login_welcome.png` | New joiner, Welcome step |
| `first_login_intro_skip.png` | Intro step with Skip |
| `after_skip_continue.png` | After Skip, into the app |
| `returning_user_skip.png` | Same person back: no welcome walk |
| `join_hady_core_name.png` | Join door says Hady Core |

YouTube’s own player can still paint its poster title. Our chrome does not.

## Checks

- `npx tsc --noEmit` clean
- Unit: welcome films, media access, install copy, desk help, deploy snapshot
- E2E: `tests/e2e/welcome-films.spec.ts` (desk slots + help, join walk + Skip, returning learner)
