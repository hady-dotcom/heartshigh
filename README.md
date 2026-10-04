# AI director v1 — live-player proof

Portrait treatments A–F of a 16:9 film, applied in the HEARTS player (CSS, not ffmpeg).
This branch is proof only. It does not merge. It does not touch live data.

YouTube is blocked on the proof VM (embed + yt-dlp). Every recording uses the
labelled local placeholder at `/framing/placeholder.mp4`: a 16:9 test pattern
with a face-like block, burned-in `PLACEHOLDER` copy, and a running clock.
A fake `__frClock` steps the player so modes and F words change; the video
element seeks to that clock so the burned-in timecode advances.

## Demo switch (the one to watch)

`placeholder-0-24` / `fixture=switch`: D 0–8, B 8–16, F 16–24, snapped to
sentence ends. Stepped clock: 1, 6, 10, 14, 17, 20, 22.4.

- [recordings/demo-switch-390x844.mp4](recordings/demo-switch-390x844.mp4)
- D crop: [frames/demo-d.png](frames/demo-d.png)
- B letterbox on screen: [frames/demo-b.png](frames/demo-b.png)
- F “winning”: [frames/demo-f-winning.png](frames/demo-f-winning.png)
- F “dignity”: [frames/demo-f-dignity.png](frames/demo-f-dignity.png)

## Prototype clips (same placeholder film, real tracks)

| Slug | Track | Mode | Notes |
| --- | --- | --- | --- |
| offcentre | 9gwe-HMwZv0 1005–1029 | D | Off-centre face crop |
| twoperson | 45XUrfJS68Q 307–332 | F | In-window line starts at “Uh I was speaking…” |
| slidetext | 9k7QxXtCzaQ 38–65 | B | Full-width 16:9 letterbox, teal bars |
| wide | TLCGBj4AlB0 2751–2778 | D | Wide single face |

Raw mp4s:

- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/ai-director-v1/recordings/demo-switch-390x844.mp4
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/ai-director-v1/recordings/offcentre-390x844.mp4
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/ai-director-v1/recordings/twoperson-390x844.mp4
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/ai-director-v1/recordings/slidetext-390x844.mp4
- https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/ai-director-v1/recordings/wide-390x844.mp4
