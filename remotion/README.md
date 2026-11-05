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

## Batch manifest

One command renders a whole course list, and it is safe to stop and run again. A row that already has a film, with the same style and the same quote, is kept.

```text
npm run batch -- manifest.csv
npm run batch -- manifest.csv --dry-run
npm run batch -- manifest.csv --force
npm run batch -- manifest.csv --limit 8
```

`manifest.csv` is one film per row. The columns are talk title, speaker, youtube id, beat (`hook`, `turn` or `land`), start, end, verbatim quote, clip file name and face-visible flag. An optional `course` column groups rows so neighbouring films in that course never share a style. Without it, the file is one sequence. See `manifest.example.csv`.

Each clip is a 720p face file already cut on the sentence, with about 0.3s of breath, and time 0 in the file is `start`. Put the files in `remotion/public/footage/`, or pass a path and the script links them there. `face-visible` of `no` is skipped. A missing clip is skipped too, so a later run picks it up when the file arrives.

The style is chosen from the five, cycling inside the course, and the gold words are chosen from the quote (the two seeded talks keep the landings already agreed). The film is written to `hearts-prototype/public/typography/{youtubeId}/{beat}.mp4` and listed in `public/typography/films.json`. The same rows also write one scenic card per talk to `public/typography/cards.json`: the three beats, the gold landing, and a background that the next card does not reuse. A missing face clip skips that film and still writes the card. The learner feed alternates the face film and the card, with the talk and a question between them.

The six clips already in `public/footage/` are the padded windows for the five-style approval films (`npm run render`). They are not the sentence cuts this command expects.

## Face footage

The films for Ar-Rabb and Al-Nur play the speaker. Each beat is only the snapped sentence from `talks/windows.json` (the in and out, with about 0.3s of breath). Time 0 in a clip is that beat's window start. The picture and the voice come from the same file, so a word cannot appear before it is spoken. After the voice ends, the last frame holds for half a second so the landing word can be read. That hold is not more of the talk.

The words sit on the footage, in the upper space beside the head, and the face is shifted to leave that side clear. Ordinary words are large. A gold landing is larger still, and only the latest landing stays up. A repeated word in the transcript is shown once. The Learn more card holds for a second and a half. Approval renders stay 540×960. The batch command renders at 720×1280.

The clips are the windows Leon downloaded from the permitted talks, 720p, and they live in git because each one is about 3MB:

```text
remotion/public/footage/{youtubeId}-{hook|turn|land}.mp4
```

How to Live Like the Prophet is still the previous silent-of-picture render until those three windows are in the same folder. Without a clip, the render falls back to the sliced talk audio.

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
