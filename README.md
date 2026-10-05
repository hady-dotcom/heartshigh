# Lane C safety proof

S05 is real. Live (`cursor/hearts-prototype-v1-cf40`) is affected.

## S05 private uploads

- `s05-prove-before.json` — before the fix, learner B listed and fetched learner A's answer media by id, filename and `/api/media/file/…` (all `200`). `leak: true`.
- `s05-prove-after.json` — after the fix, Bob list miss, GET by id `403`, signed file route `403`, teacher on an unshared answer `403`, owner `200`. `closed: true`.

Live Media.read is still portal-wide. Live `saveUpload` has no owner or purpose. Live S3 has no `acl: 'private'` and no `signedDownloads`.

## Desk and Home stills

- `n08-care-and-safety.png` — portal desk Care and safety after hide then keep. Evening garden, '?' on the page, Raised with you queue, Quiet for 7 days.
- `n10-needs-a-person.png` — gold-edged Needs a person after an at-risk report. Staff who are not the named lead see only that an alert exists. Add a safeguarding lead warning.
- `n01-home-announcement.png` — learner Home with a calm announcement card (Eid prayer) and '?' help.

## Tests

- Unit before: 383 pass, 0 fail. After: 398 pass, 0 fail.
- Playwright Lane C: 5 passed (S05 hostile, N09/N08, N10, N08 cross-portal, N01).
- Full e2e: 217 passed, 1 skipped (the before-fix S05 prove), 3 failed then passed on retry (screenshots share tick, sheet-creator workbook after a Next memory restart, r5d door-tile timeout). Not Lane C regressions.

Feature branch: `cursor/basics-safety-c9aa`. Draft PR: https://github.com/hady-dotcom/heartshigh/pull/32
