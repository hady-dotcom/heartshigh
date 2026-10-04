# AI director v1 proof

Live 390×844 recordings of `/dev/framing` for the four prototype windows. The player is the real HEARTS YouTube embed (nocookie, chromeless, sound requested). The film is not re-hosted.

## Tracks

Chooser ran on the box-prototype YuNet/textcheck stats because this cloud box is bot-checked by YouTube (`yt-dlp` cannot keep a temp download). In/out still snap to sentence ends.

| Clip | YouTube | Window | Mode | Why |
| --- | --- | --- | --- | --- |
| offcentre | 9gwe-HMwZv0 | 1005.20–1028.90 | D | Single face, off centre (x=0.28) |
| twoperson | 45XUrfJS68Q | 307.25–332.00 | F | Two people / twoFar |
| slidetext | 9k7QxXtCzaQ | 38.00–65.00 | B | textScore 0.012 |
| wide | TLCGBj4AlB0 | 2751.00–2778.00 | D | Single face in a wide shot (x=0.22) |

JSON: `tracks/`.

## Recordings

`recordings/<slug>-390x844.webm` and `recordings/<slug>-frames.png` (3×2 stills).

## Limits recorded on this box

- YouTube IFrame playback from this network stayed at t=0 and often showed the unavailable / “learn more” slate, so the stills prove the live crop chrome (D cover, B teal letterbox, F split words) more than the intended 16:45 / 5:08 / 0:38 / 45:51 picture.
- Mode follow, word wrap and hold/snap are covered by unit + Playwright tests on the feature branch, with a fake clock.
- iPhone Safari iframe transform is unverified here.
- `docs/DESIGN-WHY.md` was not in the tree.

Feature PR: https://github.com/hady-dotcom/heartshigh/pull/21
