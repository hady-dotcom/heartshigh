# Hud-hud — interactive demo

**Hearts Together.** A phone-first demo of the Hud-hud video app: real video, real swipe
gestures, real transitions. Built to be opened on a phone and screen-recorded.

Open `app/index.html`. On desktop it renders inside a phone frame; on a phone it goes
full-screen and *is* the app.

Also published for phone access: **https://claude.ai/artifact/3cz9WDw5imvFzmJfW1mpvX**
(`app/artifact.html` is the same app with the wrapper tags removed for that host.)

---

## The Ladder

| Layer | Screen | Length | Bridges to |
|---|---|---|---|
| 1 · Hors d'oeuvre | `01` full-bleed vertical clip | 18s window | "Watch the full clip ›" |
| 2 · Appetiser | `02` extended cut + speaker bar | 95s window | "Start this course ›" |
| 2b · Speaker bio | `02b` hero, bio, their courses | — | into a course |
| 3 · Mains | `03` course player + engagement timeline | full part | the Garden |
| 3b · Engagement | `03b` panel + swarm | — | back to play |
| Grow | banner + five pages (`00`–`05`) | — | everything |

**Gestures** on layers 1–2 — swipe **up** replay · **down** switch lane · **left** more on
this topic (same lane, different teacher) · **right** more from this speaker (same teacher,
different lane). Arrow keys work too. Every swipe loads another Hors d'oeuvre; the tab bar
stays pinned throughout.

---

## What is real, and what is placeholder

Everything below marked **real** came out of the Hearts CMS or Leon's editorial sheets at
build time and is baked into `app/data.js`. There are no runtime API calls.

**Real**
- **18 HLS streams** from the CMS (`cdn.hearts.foundation/hls/<id>/playlist.m3u8`), played with hls.js.
- **90 reel clips** at real timestamps inside those talks, each with its editorial
  hook / turn / land, theme, Ḥadīth Jibrīl clause and Ghūniyya seat — joined from the
  3,963-row canon export.
- **Speakers**: names, honorifics, photos, long bios, talk counts (8 creators).
- **Series and course parts** with real durations and positions.
- **Ḥadīth Jibrīl map**: real clause numbers and labels, and real library coverage —
  36 of 41 sections already have content, 221 covering places across 3,963 mapped clips.
- **Harvest**: 14 āyāt and 3 aḥādīth with Arabic, translation, reference, grading, and real
  provenance — which talk they were met in, which speaker, at what timestamp.
- **Engagement prompts**: real published CMS reflection questions, cited by id on screen.
- **Engagement points**: real timestamps from the Fahmy Session 6 deep analysis plus that
  talk's canon rows, spread one per ninth of the 2h49m part so the timeline reads properly.

**Placeholder** (per the boards — "names, figures, āyāt and answers are placeholder")
- Learner state: 38-day streak, 2 rest days, 1,140 hors d'oeuvres, 96 appetisers, 31 parts,
  31h 40m, 12 of 41 sections, 38 of 9,600 cells.
- Workbook answers (the *questions* are real CMS rows; the answers are written).
- Peer responses in the swarm.
- Learner counts on the bio page.

---

## Build

```bash
python3 build/generate.py     # joins the sources -> app/data.js
```

Sources:
1. `build/cms_snapshot.json` — pulled from the Hearts CMS MCP connector (prod).
2. `canon-dual-export-FINAL.xlsx` — 3,963 mapped clips. Joined to CMS videos on
   normalised `talk_title` ↔ `video.title`; the match is exact for all 18 videos.
3. `demo10-CLIPS.xlsx` — 22 curated reel bites (carried through as `curated`).
4. `extract-fahmy-s6-dual-export.xlsx` — the deep single-talk analysis driving Mains.

To refresh from the CMS, re-pull into `cms_snapshot.json` and re-run the generator.

---

## Decisions taken, and why

- **al-Ghūniyya**, not al-Rūniyya — per Leon; the canon column is `Place against Ghunya course`.
- **Jibrīl denominator 410** — 41 sections × ~10 covering places ("ten different chefs"),
  confirmed by Leon. It is one constant (`PIECES_PER_SECTION`) to change if the data says otherwise.
- **Two different truths on the Jibrīl page.** The headline is *this learner's* progress
  (12 of 41 · 47 pieces, per the board). Underneath each branch is the *library's* real
  coverage. They are different numbers and the page says so.
- **Harvest counts follow the data** (14 · 3) rather than the board's 23 · 9, so the number
  matches the cards you can actually scroll.
- **Banking rules are honoured**: hors d'oeuvres count on General but do not bank to the
  maps; appetisers may; course parts always do.
- **Phone frame is 390×844**, not the board's 320×660 — the brief's operative constraint is
  "must feel right on a 390px-wide screen", and 320×660 letterboxes modern content. One line
  in `app.css` (`--pw` / `--ph`) if you want it back.
- **hls.js is vendored** in `app/vendor/` rather than only CDN-loaded, so a flaky connection
  cannot break a screen recording. CDN remains the fallback.

## Still open

1. Speaker bio as a full screen (built that way, per the video board) vs a bottom sheet.
2. Ghūniyya denominator: 9,600 is still a placeholder — fixed map or growing with content?
3. Garden / fruit language for C2 / C3 cohorts.
4. Step 01 → 02 trigger is currently tap-the-CTA; auto-advance on clip end is a one-line change.

## Testing

Verified in Chromium across Android-small, iPhone SE, iPhone 14, 14 Plus, Pixel 7 and iPad:
no horizontal overflow, no CTA clipped by the tab bar, tap targets ≥44px, zero page errors.
Playback was exercised end-to-end against local media — autoplay, seek to clip start, clip-window
looping, progress, unmute, pause-on-cover, and auto-pause at an engagement point all pass.

**Not verifiable from the build sandbox:** `cdn.hearts.foundation` is blocked by the egress
proxy here, so the CMS video, thumbnails and speaker photos could not be loaded during testing.
The URLs come straight from the CMS and are correct; they need one real-device check.
Every one of them degrades gracefully if it fails — the clip falls back to a branded card and
the text still reads, images fall back to painted gradients, avatars to initials.
