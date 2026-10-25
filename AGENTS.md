# Working on HEARTS

These rules apply to every change, including work done by an agent.

## Ship in small pulls

One queued change, one pull request. Open it when the local gates pass. Do not batch the queue into a single pull request.

The pull request base is `cursor/hearts-prototype-v1-cf40`.

## Spec first

The pull request body starts with a short plain spec:

- what each screen should show
- what it should do
- the order of films or courses
- the copy a person should read

The body ends with a checklist. Tick each line only after you have checked it, and put the screenshots next to the lines they prove.

## Gates that must pass before a merge

Run these on port 3100 (the e2e server) unless a gate says otherwise. Do not merge when one of them fails.

1. **Unit and the existing Playwright tests** for the behaviour you changed (`npm run test:unit`, and the relevant `npm run test:e2e` files).
2. **Design tokens.** Colours, the type scale, spacing, radii, and shadows live in `hearts-prototype/src/app/(frontend)/tokens.css` as CSS variables. `npm run test:unit` fails if learner or admin CSS outside that file adds hard-coded colours or font sizes. `shell-modern.css` must stay at zero. Other CSS files may only go down from the ceiling in `tests/unit/design-token-debt.json`. When you migrate a file, lower its ceiling in the same change.
3. **Visual QA.** `npm run test:visual` opens every learner and admin screen linked from Hady Home and HEARTS. It runs in Chromium and WebKit at 390×844 and 1280×800, and in mobile Chrome emulation. It fails on clipped text, overlapping controls, tap targets under 44px, body text under 15px, headings that are not clearly larger than body text, WCAG AA contrast failures, horizontal page scroll, empty sections, film order that does not match the sheet, or a HEARTS colour, string, or image on Hady Home.
4. **Screenshot baselines.** The same command compares Playwright `toHaveScreenshot` baselines. An unexpected difference fails the run. Update baselines only for a change you intended, with `npx playwright test -c playwright.visual.config.ts --update-snapshots`, and list every updated baseline in the pull request.
5. **Lighthouse, mobile, on the production bundle.** `npm run test:lighthouse` fails if accessibility is under 95 or performance is under 80 on the key learner pages. This uses local Lighthouse, not a paid service.

## Fonts

Hady Home (the white shell) uses at most two type families: a heading face and Inter. HEARTS keeps its evening set: Cormorant Garamond, Libre Caslon Text, Inter, and Noto Naskh Arabic. Do not restyle HEARTS down to two families.

## Look

Course cards are the default for every portal, including HEARTS. The learner tab says Courses. The white shell is the default. HEARTS uses the evening theme only when its portal setting `shell` is `hearts`. Do not put a scene on a portal unless an admin has chosen one.

## Leave alone

Do not build a welcome video or a skip-welcome setting. Do not delete film 1 from the Hady sheet. The notice “1 films” stays as it is. Do not merge the mixed kitchen-scene branch. Do not commit `.next*` build output.
