# r5d desks proof

Screenshots and a short video for the desks + Turnstile + “?” help pass. Nothing here is a merge, and nothing here changes live Cloudflare, Railway or DNS.

Taken locally against the Playwright seed (East London Mosque) at 1440×900 unless noted. Phone pages are 390×844 with an iPhone Safari user agent where the install strip is shown.

Raw files: `https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/r5d-desks/<file>`

| File | What it shows |
| --- | --- |
| `phone-home-install.png` | Slim install strip **below** Continue: “Keep HEARTS on your phone”, Share then Add to Home Screen, Not now. Continue is not covered. |
| `computer-home-install.png` | Desktop Home: “Keep HEARTS on this computer”, browser menu / address-bar install. |
| `phone-home-saved.png` | Home **Saved (3)** and the same slim strip heading, Continue still clear |
| `phone-me-saved.png` | Me › Saved on a phone with real talk titles (`cleanTitle`), not “Saved clip 1/2/3” |
| `phone-desk-narrow.png` | The one phone desk still: “Open this on a laptop or desktop” (every desk page is this note under 900px) |
| `help-teach-page.png` | Teach page “?” open. One Give a course column “?”. No row of bare question marks. Evening-garden desk. |
| `help-give.png` | Give “?” open to the left, sentence case, fully on screen |
| `help-gather-attendance.png` | Gather attendance on evening-garden teal; empty-state type readable; page “?” open |
| `help-nights-kind.png` | Nights: one labelled Kind column-header “?”, not a “?” on every row |
| `content-grouped-doors.png` | Filled doors first as **Door 2 ·**; empty doors collapsed under **Doors with nothing yet (17)** |
| `content-length-empty.png` | Length is empty, placeholder minutes:seconds |
| `content-ghunya-seats.png` | Library pack: twenty door tiles, Ghunya seat heading and count |
| `teach-hide-test-on.png` | Hide test on: **Learners (14)**. Same data as the off shot. |
| `teach-hide-test-off.png` | Hide test off: **Learners (15)**, including QA Desk Learner. Same data as the on shot. |
| `sidebar-scroll-1366x700.png` | Short-laptop sidebar: “More below” under the nav, portal address one ellipsised line |
| `login-turnstile.png` | Sign-in with Cloudflare always-pass test keys |
| `teacher-help-tips.mp4` | Portal admin then teacher opening “?” tips after the evening-garden restyle |

Learner bottom bar is still Home · Lanes · Gather · Garden · Me. That change is left to PR #26.

`HelpTip` lives at `@/components/help-tip` for reuse on Experiments when PR #22 lands. `desk-tokens.ts` is the single source of truth for desk colours.
