# Lane A proof: accounts, sign-in and email

Stills from `tests/e2e/account-proof.spec.ts` on `cursor/basics-accounts-8207`.
British English, evening-garden teal `#0E2A2B` and gold `#D4A84B`.

## Reset (A02)

- `01-forgot-notice.png` — same calm notice after asking for a reset link
- `02-email-reset.png` — first capture (Next.js page; prefer the render below)
- `email-reset.html` / `email-reset-render.png` — the real reset mail: teal header, gold button, one-hour link
- `03-reset-form.png` — `/reset?token=…`
- `04-reset-done.png` — password updated; sign in with the new one

## Two-step (A09)

- `05-two-step-panel.png` — portal Settings, Beginner two-step panel
- `06-two-step-setup.png` — QR and secret
- `07-two-step-backups.png` — ten backup codes shown once
- `08-two-step-code.png` — password alone is not enough; enter the app code

## Pause (A17)

- `09-teach-before-pause.png` / `10-teach-after-pause.png` — Teach desk
- `11-email-paused.png` / `email-paused.html` / `email-paused-render.png` — pause mail
- `12-paused-sign-in.png` — “This account is paused. Please speak to your masjid or school.”

## Transport (A03)

- `13-master-email-panel.png` — Master Settings, In-depth email panel (catcher banner + test button)

Raw files: `https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/basics-accounts/<filename>`
