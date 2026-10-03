# HEARTS typography films

Vertical 9:16 films of a talk's hook, turn and land. Five styles: Kinetic, Windows, Conversation, Cinema, Unfold. Each ends on a Learn more card.

From `hearts-prototype`:

```bash
npm run typography:export
npm run typography:render
```

One talk, one style, from this folder:

```bash
npm run render -- ECaTWkof57E --style kinetic
```

## Speaker audio

Source audio stays out of git. `hearts-prototype/.gitignore` ignores `content/audio/*` except `.gitkeep`.

Put a whole talk at:

```text
hearts-prototype/content/audio/{youtubeId}.m4a
```

`.mp3`, `.wav` and `.aac` work too. A long talk can be split into consecutive parts, named so they sort in order:

```text
hearts-prototype/content/audio/{youtubeId}-part0.m4a
hearts-prototype/content/audio/{youtubeId}-part1.m4a
hearts-prototype/content/audio/{youtubeId}-part2.m4a
```

Part 0 starts at 0. Each later part starts where the previous file's duration ends (check with `ffprobe`). How to Live Like the Prophet is stored that way: part 0 is 3376.019s, part 1 runs to 6752.015s, and part 2 ends at 10124.945s.

The render slices hook, turn and land at the cue times, keeps each word locked to that cue, and puts a 60ms fade at every join. A missing file falls back to a silent film. `TYPOGRAPHY_SILENT=1` skips the YouTube download as well.

From `hearts-prototype`, with the files in place:

```bash
npm run typography:render
```

Or from this folder, one file for the talk you name:

```bash
npm run render -- ECaTWkof57E --audio ../hearts-prototype/content/audio/ECaTWkof57E.m4a
```

Several talks:

```bash
npm run render -- --audio ECaTWkof57E=../hearts-prototype/content/audio/ECaTWkof57E.m4a --audio NIR88RRpat4=../hearts-prototype/content/audio/NIR88RRpat4.m4a
```

`--audio-only` slices and mixes, then stops before the picture render:

```bash
npm run render -- --audio-only
```
