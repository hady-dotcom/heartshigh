# Caption helper

This runs on **your own machine**, where YouTube is not blocked. It does not run on the HEARTS server, and it does not call a paid model.

It can only do two things, with a token the master desk creates:

1. List talks that are waiting for a transcript.
2. Attach a timed transcript to one of those talks.

It cannot publish, edit a course, or read anything else. Attaching a transcript does not publish the talk. Learners still cannot see a draft.

## Create a token

1. Sign in on the master desk.
2. Open **Bring in**.
3. Under **Caption helper**, name the machine and choose **Create helper token**.
4. Copy the token. It is shown once. The desk stores only a hash.
5. **Revoke** stops that token at once.

## Run

From `hearts-prototype/`:

```bash
export HEARTS_BASE="https://your-hearts-site"
export HEARTS_HELPER_TOKEN="hlp_…"
npx tsx scripts/bring-in-helper/run.ts
```

You need [yt-dlp](https://github.com/yt-dlp/yt-dlp) on the PATH, or `YT_DLP_PATH` pointing at it. `npm run setup` can put a copy in `bin/`.

### Dry run

Prints the waiting talks and does not attach anything. Safe to repeat.

```bash
HEARTS_HELPER_DRY_RUN=1 npx tsx scripts/bring-in-helper/run.ts
```

`--dry-run` does the same.

### Again, after a failure

Run the same command again. A talk that already has a transcript is left as it is (the server answers 409). Talks still waiting are tried again. Nothing is published, and a talk is not added twice.

## What it fetches

For each waiting talk it asks yt-dlp for captions. When the video has captions, those times are kept. Sentence breaks are added from the pauses (a gap of about 0.7s ends a sentence) when the captions have none. Text that already has full stops is left alone. No paid model is used.

When the video has no captions, yt-dlp downloads the audio and a local speech-to-text engine writes the words. Set `STT_ENGINE`:

| `STT_ENGINE` | What it uses |
| --- | --- |
| `faster-whisper` | Default. A local [faster-whisper](https://github.com/SYSTRAN/faster-whisper) model. `STT_MODEL` defaults to `tiny`. Install with `pip install faster-whisper`. |
| `whisper.cpp` | A local whisper.cpp binary. Set `WHISPER_CPP` and `WHISPER_CPP_MODEL` to files on this machine. |
| `fixture` | Reads the audio file and returns a fixed practice transcript. For tests, and for a machine that cannot reach YouTube. |

The same pause rules then add the sentence breaks.

## Rate limit

The helper waits between talks. `HELPER_GAP_MS` defaults to **2000** (two seconds). Set `HELPER_GAP_MS=0` only for a local test.

The server also allows **30** helper calls per token per minute. A 429 means wait a minute and run the command again. Finished talks stay finished.

## Environment

| Name | Meaning |
| --- | --- |
| `HEARTS_BASE` | The site, with no path. Example: `https://hearts.example` |
| `HEARTS_HELPER_TOKEN` | The token from the desk. Starts with `hlp_`. |
| `HEARTS_HELPER_DRY_RUN` | `1` to list only. |
| `HELPER_GAP_MS` | Pause between talks. Default 2000. |
| `YT_DLP_PATH` | Optional path to yt-dlp. |
| `STT_ENGINE` | `faster-whisper`, `whisper.cpp`, or `fixture`. |
| `STT_MODEL` | faster-whisper model name. Default `tiny`. |
| `WHISPER_CPP` | whisper.cpp binary. |
| `WHISPER_CPP_MODEL` | Local ggml model file. |
