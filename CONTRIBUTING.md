# Contributing

Read [AGENTS.md](AGENTS.md) before opening a pull request. The same gates apply to people and to agents.

## Pull request body

Start with a short spec, in plain sentences:

- what each changed screen shows
- what a person can do there
- the order of items
- the copy on the screen

End with a checklist. A box is ticked only when that line has been checked against the running app. Put the screenshots under the lines they prove.

## Before you merge

From `hearts-prototype`:

```bash
npm run test:unit
npm run test:e2e          # the specs that cover your change
npm run test:visual       # Chromium, WebKit, and mobile Chrome
npm run test:lighthouse   # mobile accessibility >= 95, performance >= 80
```

`test:visual` needs the WebKit browser once: `npx playwright install webkit`.

Screenshot baselines live next to `tests/e2e/visual-qa.spec.ts`. Update them only for an intended visual change and name each file in the pull request.

The first time you need Lighthouse’s packages: `npm install -D lighthouse chrome-launcher`. The script then builds a production bundle and scores it locally.

## Tokens

New colours and font sizes go in `src/app/(frontend)/tokens.css`. The unit test rejects new hard-coded colours and font sizes in learner and admin CSS. Lower a file’s number in `tests/unit/design-token-debt.json` when you move that file onto the tokens.
