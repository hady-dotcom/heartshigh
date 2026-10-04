# AI director v1 — live-player proof

Portrait treatments A–F of a 16:9 film, applied in the HEARTS player (CSS, not ffmpeg).
This branch is proof only. It does not merge. It does not touch live data.

YouTube is blocked on the proof VM (embed + yt-dlp). Every recording uses the
labelled local placeholder at `/framing/placeholder.mp4`: a 16:9 test pattern
with a face-like block, burned-in `PLACEHOLDER` copy, and a running clock
on the FACE card. A fake `__frClock` steps the player; the video seeks so
the burned-in timecode advances in D as well as B and F.

## Demo switch (the one to watch)

`placeholder-0-24` / `fixture=switch`: D 0–8, B 8–16, F 16–24, snapped to
sentence ends. Stepped clock: 1, 3, 5, 7, 10, 14, 17, 20, 22.4.

D crop uses the track focus so the whole FACE card stays inside the
390×844 frame. B and F share the same 16:9 rest height.

- [recordings/demo-switch-390x844.mp4](recordings/demo-switch-390x844.mp4)
- [recordings/demo-switch-frames.png](recordings/demo-switch-frames.png)
- D at 1s, whole face: [frames/demo-d.png](frames/demo-d.png)
- D at 7s, clock moved: [frames/demo-d-t7.png](frames/demo-d-t7.png)
- B letterbox: [frames/demo-b.png](frames/demo-b.png)
- F “winning”: [frames/demo-f-winning.png](frames/demo-f-winning.png)
- F “dignity”: [frames/demo-f-dignity.png](frames/demo-f-dignity.png)

Raw mp4: https://raw.githubusercontent.com/hady-dotcom/heartshigh/artifacts/ai-director-v1/recordings/demo-switch-390x844.mp4

## Timed words only (Leon)

F and captions show the transcript line for the current clock, or nothing.
Never a talk title. Gap at 18.45 is empty.

- F winning: [frames/demo-f-winning.png](frames/demo-f-winning.png)
- F gap (empty): [frames/demo-f-gap-empty.png](frames/demo-f-gap-empty.png)
- F overcoming: [frames/demo-f-overcoming.png](frames/demo-f-overcoming.png)
