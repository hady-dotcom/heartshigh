# Testing

Seven suites, all run before any "come and look". Run them from the repo root.

| # | Script | Proves |
|---|---|---|
| 1 | `shipped.py` | the **shipped** `app/` plays real video, untouched, no substitutions |
| 2 | `hero.py` | the Drive hero clip: plays, loops, correct duration, no double captions |
| 3 | `playtest.py` | seek to clip start, clip-window looping, unmute, pause-on-cover, engagement auto-pause and resume |
| 4 | `audit.py` | every control on all 9 screens has a real destination |
| 5 | `sizetest.py` | 6 devices × 8 screens: no overflow, no clipped CTA, tap targets |
| 6 | `unfurl.py` | all 5 Grow pages unfurl (measured by height growth, not class names) |
| 7 | `yt.py` | YouTube engine: right video, right window, swipes pass through the embed |

Plus `sim2.py`, which reproduces the artifact host's document skeleton and measures
rendered geometry — added after a release where elements existed at 0×0 and the page
showed as blank black.

## The codec problem, and how it is handled

The Playwright Chromium in CI is built without proprietary codecs, so it cannot decode
H.264 and every real MP4 fails with `DEMUXER_ERROR_NO_SUPPORTED_STREAMS`. That is the
test browser, not the media.

Rather than skip the check, the demo ships **both formats** for its local media — H.264/AAC
MP4 for phones, VP8/Opus WebM beside it — and `pickSrc()` chooses per browser using
`canPlayType`. The CI browser therefore exercises a genuinely shipped file, and the check
is real rather than structural. Verified with `ffmpeg` (via `imageio-ffmpeg`, which carries
the full codec set) that both MP4s are H.264 Constrained Baseline + AAC in an `isom`
container, and by extracting and reading frames.

## Rules this project follows

- Assert **rendered geometry and behaviour**, never element presence. A node can exist at
  0×0, and a button can have a handler that only raises a toast. Both have shipped as bugs.
- A control that only shows a toast counts as dead. `audit.py` fails on those.
- Never report something as working on the strength of the code reading correctly.
  Say plainly what was not verified, and why.
