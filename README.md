# R5a clip-feed proof

Phone viewport 390×844, fake YouTube (sound on, normal speed). The live IFrame API is not reachable from this machine.

## Files

- `feed-phone.webm` — walkthrough: coach, Tap for sound ten times, swipes, Ready for more?
- `grid.png` — five stills from that run
- `frames/` — the same stills at full size
- `player-log.json` — `__HEARTS_FEED_SNAP` after each step

## What the log shows

- The first clip starts muted (`muted: true`, `state: 1`).
- After Tap for sound the visible host is unmuted.
- After each swipe, no hidden host is `state: 1` and unmuted.
- No question cards (`kinds talk,film,talk,scene,...`).
- Ready for more? stays on Shaykh Mikaeel Smith.

A real iPhone Safari and Android Chrome check is still needed for Tap for sound.
