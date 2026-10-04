# r5d desks proof

Screenshots and a short video for the desks + Turnstile + “?” help pass. Nothing here is a merge, and nothing here changes live Cloudflare, Railway or DNS.

Taken locally against the Playwright seed (East London Mosque) at 1440×900 unless noted. Phone pages are 390×844 with an iPhone Safari user agent where the install strip is shown. Short-laptop stills are 1366×700.

Raw files: `https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/r5d-desks/<file>`

| File | What it shows |
| --- | --- |
| `help-give.png` | Give “?” card wraps inside its cream box and sits above the course picker and buttons (portalled, `white-space: normal`) |
| `help-nights-kind.png` | Nights Kind “?” card fully visible; not clipped by the panel edge |
| `teacher-help-tips.mp4` | Admin then teacher opening “?” tips: Give wraps, Nights is unclipped, cards stay in the viewport |
| `overview-linked-library.png` | “Linked from the library” is a normal teal count tile, not a cream `#fbefd2` bar |
| `sheet-import-error.png` | Master-sheet preview with error rows: teal field, cream type, red left border |
| `sidebar-scroll-1366x700.png` | “East London Mosque” wraps to two lines; address keeps `127.0.0.1:3100` (not `127.…`); More below under the nav |
| `compass-learner-desk.png` | Compass learner desk on evening-garden tokens (`#0E2A2B`), not parchment |
| `plans-course-picker.png` | Teacher Study plans course picker uses `cleanTitle` (no `\|` or `Khutbah by`) |
| `phone-me-saved.png` | Me › Saved: one Session 6 row, Tawakkul without the YouTube tail |
| `phone-home-saved.png` | Home **Saved (2)** after de-dupe by talk |
| `phone-home-install.png` | Slim install strip **below** Continue: “Keep HEARTS on your phone” |
| `computer-home-install.png` | Desktop Home: “Keep HEARTS on this computer” |
| `phone-desk-narrow.png` | The one phone desk still: “Open this on a laptop or desktop” |
| `help-teach-page.png` | Teach page “?” open. One Give a course column “?”. Evening-garden desk. |
| `help-gather-attendance.png` | Gather attendance on evening-garden teal; empty-state type readable |
| `content-grouped-doors.png` | Filled doors first as **Door 2 ·**; empty doors collapsed under **Doors with nothing yet (17)** |
| `content-length-empty.png` | Length is empty, placeholder minutes:seconds |
| `content-ghunya-seats.png` | Library pack: twenty door tiles, Ghunya seat heading and count |
| `teach-hide-test-on.png` | Hide test on: **Learners (14)**. Same data as the off shot. |
| `teach-hide-test-off.png` | Hide test off: **Learners (15)**, including QA Desk Learner. |
| `login-turnstile.png` | Sign-in with Cloudflare always-pass test keys |

Learner bottom bar is still Home · Lanes · Gather · Garden · Me. That change is left to PR #26.

`HelpTip` lives at `@/components/help-tip` (portalled to `document.body`). `cleanTitle` / `uniqueSavedTalks` live in `clean-title.ts` so `talk-title.ts` stays additive for the courses-planning / r5c merge. `desk-tokens.ts` is the single source of truth for desk colours.
