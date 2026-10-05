# How many good extracts does a long lecture really give?

HEARTS density study, Sunday 4 Oct 2026 (Toronto time). This replaces the 5-courses plan. The live import is **paused** on Leon's instruction: nothing was changed on Railway or in the repo, and nothing was deleted.

**Short answer.** Commit to **1 hors d'oeuvre per 6 minutes and 1 full appetiser (60 to 180 s, hook/turn/land) per 15 minutes** for ordinary classes, khutbahs, story sessions and talks. Fiqh and Q&A classes are thin. Plan on about **1 per 15 min and 1 per 20 min** for those, or skip them. Against Leon's 5/20 target, the hors target is a little too tight to promise for every talk (13 of 20 talks meet it, 16 of 20 meet 1 per 6). The appetiser target is easy to beat: 17 of 20 talks give a good full-length appetiser at least every 20 min, and all 20 do if shorter arcs count.

How sure we can be: the AI ratings are measured. The "genuinely good" counts are **estimates**. They come from checking a sample of 78 AI-passed extracts by ear, plus 20 near-misses (about 20 per score tier), and nobody from the team has listened to them yet. Treat those numbers as ±15% or so.

## What was run

- **20 talks, 1,053.8 minutes (17.6 h), 8 teachers, 7 styles.** Six multi-part series supply 14 of the talks, so the set can become courses later: The Names (4 classes), Manners of the Salaf (eps 1 to 4), Qualities of the Believers (2 parts), The Path of Muhammad (2 episodes), First Steps (lesson 6), and Umar Faruq Abd-Allah's Aqeeda / Prayer of the Righteous. Lengths run from 30 to 112 min.
- One talk was dropped and replaced: Babikir `eZ2_1dcZELc`. Its English captions are a machine translation of Arabic, about 900 words in 40 minutes. Its files are in `density/excluded/`.
- **Pipeline, per talk:**
  - YouTube captions (yt-dlp) are turned into timed words, and a local punctuation model (xlm-roberta) splits them into sentences. These steps are code.
  - The code then lists **every** non-overlapping candidate. Hors candidates are 15 to 30 s runs of whole sentences (2,593 in all). Appetiser candidates are 150 to 195 s windows (293).
  - **The AI rates every candidate.** It scores each hors and cuts at most one hook/turn/land arc in each appetiser window. It then writes 3 to 5 questions and hangs the talk on a door clause and a Ghunya seat. A code check confirms every extract is verbatim, in range and in order.
  - All 2,886 candidates are kept with their score, pass/fail and reason.
- **Model:** OpenAI gpt-5.4 with low reasoning effort. The app's own AI steps default to Claude Sonnet 4.5, but this box has no Anthropic key, so Sonnet cost below is an estimate on the same token counts. A gpt-4.1 trial was dropped because it passed nearly twice as many hors on the same talk (46 vs 23 of 97 at the same bar). The bar depends on the model, so re-check it if the model changes.
- **The quality bar (AI pass):**
  - Hors: score ≥7/10, starts cold, complete thought, payoff ≥4/5, no hard fail (mid-thought, needs context, garbled, list fragment, and so on).
  - Appetiser: score ≥7, the hook works cold, there's a real turn, the land sticks, no hard fail.
  - "Strong" means a pass with score ≥8.
- **Genuinely good (estimated):** I read a random sample in the transcript, with timestamps, and judged each extract as a listener would. Nobody listened to the audio.

  | AI result | Held up |
  |---|---|
  | Hors scored 8+ | 13/20 (65%) |
  | Hors scored 7 | 6/20 (30%) |
  | Appetisers scored 8+ | 16/20 (80%) |
  | Appetisers scored 7 | 9/18 (50%) |
  | Failed hors scored 6 to 8 | 4/20 (20%), mostly clips cut a sentence too early or late |

  Each talk's AI counts are weighted by those rates. Sheet tabs: *Agent review*, *Near-miss review*.

## Per talk

Strong counts are in brackets. "Good min per …" is the estimated genuinely-good rate, so lower is richer. "Gap" is the longest stretch with no passing extract of either kind.

| # | Talk | Teacher | Type | Length | Hors cand. | Hors pass (8+) | App cand. | App pass (8+) | of which ≥60 s | AI pass per 5 min / per 20 min | Good min per hors | Good min per app (any) | Good min per full app | Gap | Meets 5/20 on AI pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | The Names 19 (`ECaTWkof57E`) | Mikaeel Smith | class | 38:56 | 97 | 23 (6) | 11 | 9 (7) | 5 | 2.95 / 4.62 | 4.3 | 5.9 | 10.5 | 2:36 | yes |
| 2 | The Names 21 (`U_tCg-U0QSY`) | Mikaeel Smith | class | 52:20 | 130 | 42 (9) | 15 | 13 (10) | 8 | 4.01 / 4.97 | 3.3 | 5.5 | 8.6 | 3:12 | yes |
| 3 | The Names 31 (`A3vWP7pGaiU`) | Mikaeel Smith | class | 1:00:50 | 151 | 43 (20) | 18 | 17 (13) | 6 | 3.53 / 5.59 | 3.1 | 4.9 | 13.5 | 3:34 | yes |
| 4 | The Names 6 (`GUgBNqzH5cs`) | Mikaeel Smith | class | 52:11 | 134 | 48 (16) | 14 | 10 (10) | 9 | 4.6 / 3.83 | 2.6 | 6.5 | 7.2 | 2:41 | yes |
| 5 | Manners of the Salaf 1 (`Mw6wrK21trY`) | Mohammad Elshinawy | class | 37:53 | 91 | 24 (4) | 11 | 9 (5) | 5 | 3.17 / 4.75 | 4.4 | 6.3 | 10.2 | 6:09 | yes |
| 6 | Manners of the Salaf 2 (`GLOD742Tzbs`) | Mohammad Elshinawy | class | 43:21 | 106 | 25 (7) | 12 | 9 (7) | 7 | 2.88 / 4.15 | 4.4 | 6.6 | 8.2 | 6:36 | yes |
| 7 | Manners of the Salaf 3 (`tk4m11jDFoI`) | Mohammad Elshinawy | class | 32:28 | 80 | 13 (5) | 9 | 8 (7) | 4 | 2.0 / 4.93 | 5.8 | 5.3 | 10.2 | 5:09 | yes |
| 8 | Manners of the Salaf 4 (`ZokzAJw2G48`) | Mohammad Elshinawy | class | 50:02 | 124 | 27 (11) | 14 | 13 (11) | 8 | 2.7 / 5.2 | 4.2 | 5.1 | 8.2 | 3:55 | yes |
| 9 | Qualities of the Believers 2 (`v1CNECZWbV4`) | Khalid Latif | khutbah | 34:24 | 81 | 16 (5) | 9 | 6 (4) | 6 | 2.33 / 3.49 | 5.3 | 8.2 | 8.2 | 6:48 | yes |
| 10 | Qualities of the Believers 9 (`VchBbIKdiyo`) | Khalid Latif | khutbah | 30:23 | 74 | 11 (2) | 9 | 5 (5) | 1 | 1.81 / 3.29 | 7.6 | 7.6 | 38.0 | 5:09 | yes |
| 11 | Jumuah khutbah (`f-3OxXUp9jc`) | Khalid Latif | khutbah | 40:44 | 89 | 26 (7) | 10 | 7 (4) | 5 | 3.19 / 3.44 | 4.0 | 8.7 | 12.0 | 5:03 | yes |
| 12 | First Steps: Essentials of Islam 6 (`PyLD6RLjm0Q`) | Khalid Latif | class-qa | 55:26 | 141 | 23 (6) | 14 | 10 (8) | 5 | 2.07 / 3.61 | 6.2 | 7.5 | 13.8 | 5:15 | yes |
| 13 | The Path of Muhammad 8 (`rOrWxAOPMhE`) | Mikaeel Smith | storytelling | 45:21 | 111 | 28 (5) | 14 | 12 (8) | 7 | 3.09 / 5.29 | 4.5 | 5.4 | 9.1 | 2:59 | yes |
| 14 | The Path of Muhammad 6 (`h0xgjviMwrw`) | Mikaeel Smith | storytelling | 39:22 | 98 | 25 (5) | 12 | 9 (5) | 4 | 3.18 / 4.57 | 4.3 | 6.6 | 15.2 | 3:20 | yes |
| 15 | Aqeeda 9 (`fDZyc9WcoFs`) | Umar Faruq Abd-Allah | academic | 1:07:08 | 164 | 31 (11) | 18 | 12 (8) | 7 | 2.31 / 3.57 | 5.1 | 8.0 | 13.4 | 5:49 | yes |
| 16 | The Prayer of the Righteous 1 (`DW09PYWTwy0`) | Umar Faruq Abd-Allah | academic | 1:51:56 | 269 | 64 (12) | 31 | 22 (15) | 14 | 2.86 / 3.93 | 4.8 | 7.2 | 10.9 | 5:04 | yes |
| 17 | In Good Company (`rUIMxBh3aqo`) | Umair Haseeb | podcast | 1:13:20 | 187 | 45 (17) | 20 | 13 (9) | 6 | 3.07 / 3.55 | 3.8 | 8.0 | 16.3 | 6:14 | yes |
| 18 | Purification of the Heart 1 (`WZySKAmC8go`) | Fatima Lette | class | 1:00:04 | 145 | 24 (2) | 18 | 12 (8) | 5 | 2.0 / 4.0 | 7.6 | 7.2 | 16.2 | 5:03 | yes |
| 19 | Rumi's Cave, Ramadan 2026 4 (`ZEci87kH91c`) | Babikir Ahmed Babikir | talk | 49:13 | 124 | 32 (9) | 12 | 9 (6) | 3 | 3.25 / 3.66 | 3.9 | 7.8 | 20.5 | 4:06 | yes |
| 20 | Manar us-Sabil: Book of Fasting 2 (`W0X24Ov_b3k`) | Abu Ja'far al-Hanbali | class-qa | 1:18:29 | 197 | 10 (1) | 22 | 8 (4) | 2 | 0.64 / 2.04 | 23.4 | 15.1 | 78.5 | 15:06 | no |

**Totals:** 2593 hors candidates, 580 AI-pass (160 strong). 293 appetiser candidates, 213 AI-pass (154 strong), and 117 of those passing appetisers are 60 s or longer.

- The median passing appetiser is only about 64 s long: 19 are under 30 s, 77 are 30 to 59 s, and 117 are 60 s or more. The model often finds a tight arc inside a 3-minute window rather than filling it. Arcs under 30 s are really hors d'oeuvres, so the recommendation counts only the 60 s+ ones.
- Every candidate, with timestamps, verbatim text, score, pass/fail and reason, is in the sheet's *Extracts* tab (2,886 rows). The same data is in `density/report/extracts.csv`. The best hors and appetiser of each talk are quoted at the end of this file.
- Why "meets 5/20 on AI pass" is nearly all "yes": the raw AI pass rate (1 hors per 1.8 min) flatters the content. Only about 40% of AI-pass hors hold up on review (about 70% of appetisers). Use the "good" columns.

## Longest gaps

The median longest gap with no passing extract is **5.1 min** (range 2.6 to 15.1).

- Gaps cluster at the start and end of a talk (welcome, recap, closing du'a), in long Q&A stretches, and in fiqh detail.
- The worst is the Book of Fasting class (`W0X24Ov_b3k`): 15:06 with nothing, and **43 minutes** (17:59 to 1:01:16) with no passing hors.
- Appetiser-free gaps run longer: median about 7 min, worst 17.5 min in W0X and 15.8 min in Aqeeda 9. Gaps for each kind are in the *Videos* tab.

## By type of talk

These are medians across talks, with the range in brackets. All values are estimated genuinely-good minutes per extract, so lower is richer.

| Type | Talks | Min per good hors | Min per good appetiser (any length) | Min per good full appetiser (≥60 s) |
|---|---|---|---|---|
| class | 9 | 4.3 (2.6 to 7.6) | 5.9 (4.9 to 7.2) | 10.2 (7.2 to 16.2) |
| storytelling | 2 | 4.4 (4.3 to 4.5) | 6.0 (5.4 to 6.6) | 12.1 (9.1 to 15.2) |
| academic | 2 | 4.9 (4.8 to 5.1) | 7.6 (7.2 to 8.0) | 12.2 (10.9 to 13.4) |
| khutbah | 3 | 5.3 (4.0 to 7.6) | 8.2 (7.6 to 8.7) | 12.0 (8.2 to 38.0) |
| podcast | 1 | 3.8 | 8.0 | 16.3 |
| talk | 1 | 3.9 | 7.8 | 20.5 |
| class-qa | 2 | 14.8 (6.2 to 23.4) | 11.3 (7.5 to 15.1) | 46.1 (13.8 to 78.5) |
| **all 20** | 20 | **4.4** (2.6 to 23.4) | **6.9** (4.9 to 15.1) | **11.4** (7.2 to 78.5) |

Pooled over all 17.6 hours, that's about 230 good hors (1 per 4.6 min), 153 good appetisers of any length (1 per 6.9 min) and 87 good full appetisers (1 per 12.2 min).

**Rich talks**
- Teaching classes where the teacher keeps turning a point into a line you can remember. The Names classes (Mikaeel Smith) are richest at 1 good hors per 2.6 to 4.3 min.
- Story sessions (Path of Muhammad, 4.3 to 4.5 min). Every scene has a built-in turn, so appetisers come easily.
- The podcast (3.8) and the Rumi's Cave talk (3.9) are rich in short lines but thinner in full appetisers, because the arcs are conversational and short.

**Middling talks**
- Khutbahs (4.0 to 7.6). They're short, and a lot of the time goes on du'a, framing and repetition.
- Academic lectures (Umar Faruq Abd-Allah, about 5 min). Long careful build-ups mean fewer 20-second lines, but the 3-minute arcs are solid.

**Thin talks**
- Fiqh and Q&A-heavy classes. Book of Fasting gives 1 good hors per 23 min, and First Steps lesson 6 gives 1 per 6.2. Rulings, conditions and questions about specific cases don't stand alone.
- The Purification of the Heart session 1 (7.6) is mostly introduction and course logistics. First sessions of a series are generally thinner.

## Does quality drop as you push density?

Yes, and fast for hors. For each talk I ranked all hors candidates by AI score. I then took N = Leon's target count (talk length ÷ 5), then the next N, then the third N.

| Hors band | Mean AI score (range over talks) | AI pass | Est. genuinely good |
|---|---|---|---|
| Top N (Leon's 1 per 5 min) | 7.82 (7.0 to 8.45) | 195/222 | ~52% |
| Next N (1 per 2.5 min) | 7.02 (6.0 to 7.62) | 183/222 | ~31% |
| Third N (1 per 1.7 min) | 6.74 (6.0 to 7.0) | 143/222 | ~26% |

For appetisers, the top N at 1 per 20 min (62 extracts) averages 8.6 and all pass. The next 62 still average 8.05 and all pass. Appetisers have real headroom; hors don't.

**Where the "still genuinely good" line sits:**
- **Hors:** good lines exist at roughly 1 per 4.5 to 5 min. But the AI score can't separate them cleanly from the score-7 crowd. Even the AI's own top picks at Leon's density only hold up about half the time.
- To end up with 1 good hors per 5 to 6 min, someone has to listen to about 2 candidates per kept one: the top 2N, scores 8 and then 7.
  - Pooled, the top 2N holds an estimated 185 good hors, or 1 per 5.7 min. That's where the **1 per 6 min** recommendation comes from.
  - Pushing past about 1 per 2.5 min means listening to 3 or 4 clips per keeper.
- **Appetisers:** the line is about 1 per 7 min for short arcs. For full 60 s+ arcs it's 1 per 10 to 12 min in a typical good talk, which is why I recommend **1 per 15 min** as the commitment.

Two things would raise yield without lowering the bar:
1. **A trim step.** The tiler's fixed sentence boundaries cost real lines: 4 of 20 near-misses were good once trimmed by a sentence. A second AI pass that may move the start or end by one sentence on score 6 to 8 failures should add roughly 10 to 20% more good hors (an estimate).
2. **Letting the appetiser cutter stretch to the full 180 s** when the arc needs it. Today it's limited to its own 195 s window, and windows don't overlap, so arcs that straddle two windows are lost.

The old heuristic scorer is no help as a pre-filter. Its rank correlation with the AI score is 0.016, effectively zero. So the AI has to rate everything, but that's cheap (below).

## Recommendation vs Leon's 5/20

| | Leon's target | What the 20 talks support | Talks that meet it (est.) | Commit to |
|---|---|---|---|---|
| Hors d'oeuvre | 1 per 5 min | median 1 per 4.4 min, pooled 1 per 4.6 | 13/20 at 5 min; 16/20 at 6 min; 19/20 at 8 min | **1 per 6 min** |
| Appetiser (full hook/turn/land, 60 to 180 s) | 1 per 20 min | median 1 per 11.5 min, pooled 1 per 12.2 | 14/20 at 15 min; 17/20 at 20 min | **1 per 15 min** |
| Appetiser, any length (19 passes are under 30 s, really hors-sized) | — | median 1 per 6.9 min | 19/20 at 12 min; 20/20 at 20 min | stretch goal only |
| Fiqh / Q&A classes | — | 1 hors per 6 to 23 min, 1 full app per 14 to 79 min | — | 1 per 15 min and 1 per 20 min, or skip |

In plain terms: a 60-minute class should give about **10 hors d'oeuvres and 4 appetisers** that are genuinely good. The best talks give 15 to 20 hors and 6 to 8 appetisers. Leon's 5-minute hors rate is achievable in about two thirds of talks. As a promise across the catalogue, 6 minutes is honest. His 20-minute appetiser rate is conservative; we can comfortably promise 15.

## Time, tokens and cost

All figures below are **measured** on this run unless marked otherwise.

| Stage | Done by | Wall time per talk (mean) | Notes |
|---|---|---|---|
| Caption fetch | code (yt-dlp) | 2.8 s (0.6 s CPU) | 2 of 21 fetches hit YouTube HTTP 429 and were re-run |
| Timed words + punctuation | code + local model | 4.1 s wall, 22 s CPU on 8 cores | model load 5.5 s once per batch |
| Candidates | code | 0.03 s | |
| Hors rating | AI (gpt-5.4) | 80 s | 2 to 9 calls per talk, including re-asks |
| Appetiser cut + rating | AI | 36 s | |
| Questions + door/seat hang | AI | 8.7 s | |
| Kill-list rewording of questions | AI | 1.7 s | 14 talks needed it |
| Verify (verbatim, ranges, order) | code | 0.006 s | |
| **Total** | | **87 s with the AI steps in parallel (134 s one after another); median 84 s** | 99 s / 153 s per lecture hour |

**Tokens and dollars:**
- **183 AI calls:** 892,455 input tokens (68,864 cached) and 220,842 output tokens (41,562 of them reasoning).
- At gpt-5.4 list prices ($2.50 input, $0.25 cached input, $15 output per 1M tokens; https://platform.openai.com/docs/pricing):
  - **$5.39 for all 20 talks**
  - **$0.27 per talk** (median $0.25, range $0.14 to $0.49)
  - **$0.31 per lecture hour**
- By step: hors $2.92, appetisers $1.49, questions $0.93, rewording $0.05.
- First-pass calls alone come to $4.91. Retries and fixes added $0.48 (skipped ids, bad sentence numbers, one bad parse, the rewording).
- At Claude Sonnet 4.5 prices ($3 input, $15 output; https://www.anthropic.com/pricing) on the same tokens: about $5.80 ($0.33 per lecture hour). That's an estimate, because Claude's tokenizer counts differently.
- Not in the totals: the gpt-4.1 calibration run ($0.078), the dropped Babikir talk ($0.036), and an earlier deleted trial plus prompt tuning (logs not kept; estimated under $0.40).
- Each talk's time, tokens and cost are in the sheet's *Timing & cost* tab, and each call is in *AI calls*.

**Density doesn't change the AI bill.** Every candidate gets rated whatever we keep, so cost scales with lecture hours, not with the ratio we commit to. What density changes is the listening time and how many extracts we end up with.

**Projections** (estimates, at this set's 52.7 min average talk and the recommended 1 per 6 / 1 per 15):

| | 100 lectures (≈88 h) | 1,000 lectures (≈878 h) |
|---|---|---|
| AI cost, gpt-5.4 (incl. retries) | **≈ $27** | **≈ $270** |
| AI cost, Sonnet 4.5 (est.) | ≈ $29 | ≈ $290 |
| Machine time, one talk at a time | ≈ 3.7 h | ≈ 37 h |
| Machine time, AI steps in parallel | ≈ 2.4 h | ≈ 24 h; several talks side by side cuts this further, within API rate limits |
| Good hors d'oeuvres kept | ≈ 880 | ≈ 8,800 |
| Good full appetisers kept | ≈ 350 | ≈ 3,500 |
| Human listening and approval (**assumption, not measured**) | ≈ 37 h | ≈ 370 h |

The human figure assumes about 25 minutes per lecture hour: hear about 15 shortlisted hors at about 45 s each and about 6 appetisers at about 2.5 min each, and keep 10 + 4. No person reviewed anything in this run, so that number is a placeholder to replace once someone times a real session. At 1,000 lectures, YouTube rate limits on caption fetching will need pacing; 2 of 21 fetches here were throttled.

## What was model work and what needed judgement

- **Code:** caption fetch, timed words, candidate tiling, verbatim/range/order checks, and the import-sheet dry run.
- **Local model:** punctuation and sentence splitting.
- **AI (gpt-5.4):**
  - hors scoring and gates;
  - appetiser cutting and scoring;
  - questions;
  - door clause and Ghunya seat hangs with evidence;
  - rewording questions that used kill-list words.
- **Judgement, done here by me in the reviewer role:**
  - choosing the 20 talks and dropping the machine-translated one;
  - setting the rubric bar;
  - the 98-extract quality calibration that turns AI passes into "genuinely good" estimates;
  - picking one talk/hors/appetiser set per talk for the import sheet, clean titles, and course and lane assignments;
  - one question wording fixed by hand ("being corrected" became "someone pointed out your mistake").
- In production, **a person has to make the final keep/drop call on each extract.** The AI shortlist is too generous on its own (about 40% of passing hors and 70% of passing appetisers hold up).

## Import (paused)

- Live import is **paused**. No backup was needed, and there are no before/after counts because nothing was written.
- Ready to go: `out/hearts-density-20-import.xlsx`, a sheet in the app's own import format with one talk row per video plus 99 draft questions. Each talk row uses its best passing appetiser (60 s+ preferred) and the best passing hors inside it.
  - It went through cf40's own `buildWorkbook → readWorkbook → planSheet` as a pure dry run (no database): **119 creates (20 talks + 99 questions), 0 errors, 0 skipped**.
  - The talk rows hang on doors W5, W7, W10, W15, W16 and W20.
- The current importer takes **one hors and one appetiser per talk row**. Using the full density (10 hors + 4 appetisers per hour) needs either one row per extract or a change to the talk model. That decision comes before any bigger import.
- No local Postgres import was run. The analysis came first, as asked.

## Limitations

- The "genuinely good" rates come from about 20 samples per tier, judged by me from transcript text with timestamps, not by Leon listening. Treat counts as ±15%.
- The rubric is the model's: a different model or prompt moves the pass count a lot (gpt-4.1 passed twice as many).
- Auto-captions mishear Arabic terms and names. A few passing extracts carry those errors in the verbatim text; the app plays the audio, so it's the questions and titles that need care.
- Candidates come from fixed, non-overlapping tiles, so some good lines straddle a boundary and are lost (see trim step above).
- 4 of the 20 hang-evidence quotes (tk4, Zok, rOr, W0X) were paraphrased by the model. The sheet shows the nearest caption words beside them in `hang_evidence_note`.
- 20 talks, with 1 or 2 per type outside "class", so type medians for podcast, talk, storytelling, academic and Q&A are indicative only.

## Files

- `content-load/DENSITY.md` (this file)
- `content-load/out/hearts-density-20.xlsx`: README, Videos, Extracts (all 2,886), Quality bands, Agent review, Near-miss review, Questions, Import rows, Timing & cost (with projections), AI calls, Chart
- `content-load/out/hearts-density-20.png`: density per talk against Leon's target and the recommended line
- `content-load/out/hearts-density-20-import.xlsx`: import-format sheet, dry-run only
- `content-load/density/`: scripts (`fetch.py`, `pipeline.py`, `fix_questions.py`, `analyse.py`, `build_import.py`, `plan-cf40.mts`, `build_xlsx.py`, `chart.py`, `write_md.py`), raw AI outputs and call logs (`ai-g54/`), and CSVs (`report/`)

## Appendix: best hors d'oeuvre and best appetiser per talk (verbatim from captions)

**The Names 19** (Mikaeel Smith, `ECaTWkof57E`)

- Hors 7:47–8:11 (24 s, score 8): "Why is this name important? Because if we understand this name, we're able to look for a moment at our lives and study our lives and understand that. If you look closely and take a moment in this month of Ramadan, in these nights, and look at how Allah has been nurturing you, That's the meaning of the one who nurtures, the one who nurtures something."
- Appetiser 9:00–11:12 (133 s, score 9). Hook: "[9:00] When you're going through transitions and you don't know what's in front of you." Land: "[11:06] The one who nurtures you from one stage to the next stage, to the next stage, to the next stage."

**The Names 21** (Mikaeel Smith, `U_tCg-U0QSY`)

- Hors 33:16–33:42 (25 s, score 9): "Till today, we symbolically go between Saf and Marwa, back and forth, and we run in between where the green lines are. Why? Because that's how she ran. Here's what's crazy. She was running from one mountain to the next mountain, looking for people. Because people signify risk. But in that moment, Allah provided from where she didn't expect."
- Appetiser 23:20–25:44 (144 s, score 9). Hook: "[23:20] And there's a Hadith so profound, that said, the little bit that causes contentment is better than the a lot." Land: "[25:31] But then Allah says, However, he sends it down in portion so that you get it and you're ready for it when you get it.""

**The Names 31** (Mikaeel Smith, `A3vWP7pGaiU`)

- Hors 3:39–4:01 (22 s, score 9): "Shall I not be a person filled with gratitude? I had a teacher say he's actually saying like, I'm doing this out of love. Like, I've seen so much that God has given me. That waking up for Tahajjud in the middle of the night is not about IS, is not about some transaction. It's about me seeing how much God has given me and this love that I have for Allah Subhana wa Ta'ala."
- Appetiser 41:02–42:57 (115 s, score 9). Hook: "[41:02] The help is not that the calamity won't come." Land: "[42:45] The reason why that makes it easier for us is because it helps us understand there's no randomness to what we're going through, And that there's a reason why Allah Subhana wa Ta'ala has placed me right where He has placed me at this time."

**The Names 6** (Mikaeel Smith, `GUgBNqzH5cs`)

- Hors 12:04–12:23 (19 s, score 9): "His toba didn't happen when he gave up alcohol. His toba happened every night that he kept talking to Allah. Because what Toba actually means is not that you give up your previous way of life. And this is how we understand. A tawwab. Toba is when you turn your attention to something."
- Appetiser 45:24–48:33 (190 s, score 9). Hook: "[45:24] What is turning you away from Allah?" Land: "[48:31] Then you're right where you're supposed to be."

**Manners of the Salaf 1** (Mohammad Elshinawy, `Mw6wrK21trY`)

- Hors 13:35–13:59 (24 s, score 8): "And let us begin with, you know, reminding that the Prophet Sallallahu Alaihi Wasallam himself taught us to say, Allah. You have perfected my creation, meaning my physical appearance, my outward features, and so perfect my inward features, perfect my manners."
- Appetiser 3:44–5:58 (134 s, score 8). Hook: "[3:44] And the scholars tell us, this is to remind us that the the path to sacred knowledge, the path to understanding the reality of this Deen, is through the gateway of Adam, through the gateway of manners." Land: "[5:51] And so if you don't have the ADEB, then you will not even have ADEB with Allah, and hence you will never be getting closer to him."

**Manners of the Salaf 2** (Mohammad Elshinawy, `GLOD742Tzbs`)

- Hors 32:24–32:45 (21 s, score 9): "To actually comply with it, you know, is like driving right. To be driven by it, to be led by it, to comply with it from whoever you hear it. Even if it were the most ignorant of people, you're still obligated to commit yourself to it, to accept it and commit yourself to it."
- Appetiser 8:30–10:53 (143 s, score 9). Hook: "[8:32] Even God doesn't have universal approval, right?" Land: "[10:50] You'll never be able to appease them all, he says."

**Manners of the Salaf 3** (Mohammad Elshinawy, `tk4m11jDFoI`)

- Hors 8:55–9:16 (21 s, score 9): "It is haram for a Muslim to hear a word, a statement from his brother, brother, and to assume the worst of it. When he can understand it in a more charitable way, you got to find a more charitable way to understand it. And exhaust yourself in that before you interpret it in the most unfavorable light."
- Appetiser 11:39–12:58 (80 s, score 9). Hook: "[11:39] Yes, so one of these people, he heard Im Ahmed say something as they were walking together, and he said, But Abu Hanifah doesn't say this, so Im Ahmed just lifted his hands." Land: "[12:51] They'll get over it right before I lifted my foot another time in that walk yesterday, I had already forgiven you."

**Manners of the Salaf 4** (Mohammad Elshinawy, `ZokzAJw2G48`)

- Hors 24:30–24:51 (21 s, score 9): "Them the worst quality you know in them, and you suppress, you, conceal the best qualities you know about them. It's a principle we want to live by. It is oppressive of you to mention your brother's greatest, you know, uh, flaws, and not mention alongside it the good that you know of your brother."
- Appetiser 14:22–15:46 (84 s, score 9). Hook: "[14:22] But he, uh, he bashes you, This man, you're saying, is a righteous man, he bashes." Land: "[15:44] I'm just hopeful I don't fail the test."

**Qualities of the Believers 2** (Khalid Latif, `v1CNECZWbV4`)

- Hors 13:23–13:45 (22 s, score 8): "Five times a day, our Lord has told us that you go and stand with everybody, whether they're like you or not. You move in the same motions, heart in unison. Gatherings that you might not ever dare to have enter into your home."
- Appetiser 15:05–17:23 (138 s, score 8). Hook: "[15:05] Superiority is not me above you, but superiority is the me that I am today, being above the Me that I was yesterday." Land: "[17:18] But if you want just Dunya, then don't be humble."

**Qualities of the Believers 9** (Khalid Latif, `VchBbIKdiyo`)

- Hors 12:52–13:11 (20 s, score 8): "But why are you not entitled to being in the most secret parts of the night? To have your Doha's heard at a time when nobody else is even whispering, but they're asleep? What leaves you out of it other than just you yourself, and where and how?"
- Appetiser 24:43–25:14 (30 s, score 9). Hook: "[24:43] And so if it's hard to be up in that part of the night, then before you go to bed tonight, just pray another two rakas." Land: "[25:08] The prayer is not about changing him, but it's transformative for us within ourselves."

**Jumuah khutbah** (Khalid Latif, `f-3OxXUp9jc`)

- Hors 10:37–11:00 (23 s, score 8): "You're sitting in the Masjid in etiquette, you're not hearing anybody gossip and curse, you're sitting in the masjid and it's you're not hearing anybody tell you why. It is, that you are inadequate in some way. You're hearing verses recited that are speaking to you about your beauty, the inherent nature of your goodness, what you can aspire towards."
- Appetiser 19:01–21:35 (154 s, score 8). Hook: "[19:01] You lower your gaze in those instances, because now, as you consume imagery, it's staying with you when you stand in prayer." Land: "[21:32] But it's in those moments of solitude that ideas get cultivated."

**First Steps: Essentials of Islam 6** (Khalid Latif, `PyLD6RLjm0Q`)

- Hors 46:03–46:20 (17 s, score 9): "But the water is under my ownership, and this is where the city of Mecca establishes itself, right? But the idea is that the water attracts life to it, right? Sharia is a path to water, is that the implementation of Sharia is meant to give you vibrancy and vitality."
- Appetiser 44:46–46:56 (130 s, score 9). Hook: "[44:46] The word for Islamic law is not like law, the way like you drive through a red light and you get a ticket, you don't want to think about Sharia in that way." Land: "[46:53] It can be approached in a lot of pathways."

**The Path of Muhammad 8** (Mikaeel Smith, `rOrWxAOPMhE`)

- Hors 15:10–15:29 (19 s, score 9): "From the moment he heard the word. For the next 23 years, he never took a seat. He never took a seat. He just kept calling, kept calling, kept standing, kept standing, kept standing. From this moment, stand and warn the people."
- Appetiser 14:01–15:05 (64 s, score 9). Hook: "[14:01] Now Gabriel goes, he did what any person would do again." Land: "[15:03] You can't stay wrapped up like that."

**The Path of Muhammad 6** (Mikaeel Smith, `h0xgjviMwrw`)

- Hors 19:40–20:01 (21 s, score 9): "It was in that darkness that the light came of revelation. Because through fasting we learned that sometimes what you do to the body, the e the opposite happens on the heart. Here we are tired, weak, hungry, but our souls feel nurtured and nourished."
- Appetiser 19:22–20:20 (58 s, score 9). Hook: "[19:22] Here we are in our largest, a large houses, but our hearts are tiny." Land: "[20:17] The darkness was preparing him for the light."

**Aqeeda 9** (Umar Faruq Abd-Allah, `fDZyc9WcoFs`)

- Hors 29:50–30:07 (18 s, score 9): "And he relates to every atom in your body perfectly. And he relates to every star and every universe perfectly. And this is necessary. Being. He is great. But he is not in space and time. He is the Lord of space and time."
- Appetiser 32:25–33:44 (78 s, score 9). Hook: "[32:25] And when the scholar dies, or the saint, the whales cry for you and your name, and they pray for you too." Land: "[33:39] The only problematic entity in all of that is you and me."

**The Prayer of the Righteous 1** (Umar Faruq Abd-Allah, `DW09PYWTwy0`)

- Hors 1:02:47–1:03:11 (24 s, score 9): "And when the great scholar, man or woman dies, the real scholar, the one who loved Allah and didn't just love himself, wasn't veiled by his knowledge. The whales in the sea cry, and the fish in the sea and the birds in the air. That's who you are. The Prophet taught us that, right, these are not things that people dreamt of. This is what the Prophet taught us."
- Appetiser 38:26–40:52 (146 s, score 9). Hook: "[38:26] Once you drink that, you've got to have it." Land: "[40:40] But then he over cover, he covers all that he and and then he just brings you this's, this is your gift, come, come into the, come into my presence."

**In Good Company** (Umair Haseeb, `rUIMxBh3aqo`)

- Hors 43:57–44:19 (22 s, score 9): "If you were broken down, brick by brick, if you were to be broken down, The blood of the believer is more sacred in the eyes of Allah than you. The belief, the Iman of the believer is more sacred than Allah than you. In order to protect the Iman of the new Muslims, the Prophet said, No, no, no."
- Appetiser 17:20–18:30 (70 s, score 9). Hook: "[17:20] Is this a command from your Lord?" Land: "[18:29] You are have more knowledge of your affairs."

**Purification of the Heart 1** (Fatima Lette, `WZySKAmC8go`)

- Hors 32:08–32:28 (20 s, score 8): "Every single human being makes mistakes, right? And part of Essen are beautifying oneself is Toba. Art of Toba is recognizing that you've made a mistake. Part of making mistakes means that you're not perfect. So our religion teaches us that we don't have to be perfect, but we are striving to be the best versions of ourselves."
- Appetiser 19:16–21:01 (105 s, score 9). Hook: "[19:16] A man came who looked like he never traveled." Land: "[20:58] The Angel Jabel, He came to teach you your Deen."

**Rumi's Cave, Ramadan 2026 4** (Babikir Ahmed Babikir, `ZEci87kH91c`)

- Hors 15:58–16:22 (25 s, score 9): "The moment he said, Ashhadu an la Ilaha illallah wa ashhadu anna Muhammadan Abduhu wa Rasuluh, the moment he said, Rasuluh, he died. This is good, end. This, as the Prophet says, La Ilaha illallah tajubbu ma qablah." Once you say it from your heart, with sincerity, everything you have done in your past is wiped away."
- Appetiser 2:56–4:58 (122 s, score 9). Hook: "[3:01] Even in what you are learning, you could be tested." Land: "[4:55] If you want to benefit from your knowledge, act upon it."

**Manar us-Sabil: Book of Fasting 2** (Abu Ja'far al-Hanbali, `W0X24Ov_b3k`)

- Hors 1:01:16–1:01:36 (20 s, score 8): "The Prophet S. Wasam smiled until his incizors could be seen, and he said to the manw, take this and feed your family with it. And this Hadith is agreed upon."
- Appetiser 4:17–4:59 (42 s, score 8). Hook: "[4:17] As per the Hadith, it is not from righteousness to keep s while on a journey, and this Hadith is agreed upon Byari and Muslim." Land: "[4:51] Whoever so desires to take hold of it, then that is fine, and whoever loves to keep the p, then there is."
