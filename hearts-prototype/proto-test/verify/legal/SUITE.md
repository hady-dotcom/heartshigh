# Lane B full-suite vs `cursor/portal-features-0777`

Proof specs (`screenshots`, `legal-stills`, `r5d-desks-proof`) were left out.

## Before (portal-features worktree, port 3200)

205 tests in 31 files.

- 168 passed
- 8 failed
- 29 did not run (serial dependents of the failures)
- 20.3 minutes

Failures:

1. `round3.spec.ts` Section T — appetiser resume / drafts
2. `round3.spec.ts` Section T — master tier editor / publish pop-up
3. `round4.spec.ts` N4 — tier record for lessons 1–3
4. `security.spec.ts` — create-first-user closed
5. `sheet-creator.spec.ts` — creator drafts a sheet
6. `sheet-packs.spec.ts` — pack column without push
7. `typography.spec.ts` — five styles panel
8. `view-as.spec.ts` 38 — portal admin views as a learner

These eight all passed on the Lane B branch when the same files were re-run alone. They look like load flakes from running both suites at once.

## After, first pass (this branch, before the consent-gate fixes)

218 tests in 38 files (the 31 above plus Lane B legal specs).

- 196 passed
- 12 failed
- 10 did not run
- 29.8 minutes

New failures (not on the base list):

1. `compass.spec.ts` monthly look — demo learner sent to `/consent`
2. `compass.spec.ts` imam why-now
3. `harvest-lines.spec.ts` fresh learner garden
4. `harvest.spec.ts` finishing a talk fills Harvest
5. `integration-final.spec.ts` wizard Skip matched the skip-to-content link
6. `nesting.spec.ts` browsing / short watching
7. `opening.spec.ts` 17 keep-sheet sign-up → workbook
8. `opening.spec.ts` 24 Start again
9. `round2-integration.spec.ts` Teach table overflow (consent column)
10. `round4.spec.ts` N3 contribution after API join
11. `round4.spec.ts` L1 — `ERR_CONNECTION_RESET` (server flake under load)
12. `round4.spec.ts` LOW workbook rows after API join

## After, with fixes

Targeted re-run of the failed files plus every `legal-*.spec.ts` except stills: **140 passed, 3 failed** (opening 17/24 and the Teach table). Those three then passed after `completeConsent` followed the learner to `/consent` and the Teach consent column was removed (status stays on Children).

Unit: **392 pass, 0 fail**.
