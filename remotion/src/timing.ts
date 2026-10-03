/**
 * Turns a talk's hook, turn and land into a video schedule.
 * A word's `showAt` is the moment it may appear. It is never earlier than the
 * cue it was spoken on, measured from the start of its beat.
 */
export type BeatId = 'hook' | 'turn' | 'land'

export type CueWord = { text: string; talkAt: number }

export type ScheduledWord = CueWord & { beat: BeatId; showAt: number }

export type BeatSpan = {
  beat: BeatId
  text: string
  /** First cue of this beat, in talk seconds. */
  talkAt: number
  /** When this beat's audio and first possible word begin in the video. */
  videoAt: number
  duration: number
}

export type ScheduledTalk = {
  words: ScheduledWord[]
  beats: BeatSpan[]
  /** Spoken picture, including the hold after the land. Cinema sits longer. */
  spokenSeconds: number
  cinemaSeconds: number
  learnMoreSeconds: number
}

export const LEAD_IN = 0.4
export const BEAT_GAP = 0.32
export const LEARN_MORE_SECONDS = 4.5
/** Cinema is a full-frame sit of about one minute, including the closing card. */
export const CINEMA_SIT = 56
/** A card holds at most this many words. A longer beat turns the page on the next cue. */
export const WORDS_PER_CARD = 22
/** Silence kept before the first word of a sentence and after the last. */
export const BREATH = 0.3
/** Extra footage either side of a snapped beat, so a clip can be framed without cutting the line. */
export const WINDOW_PAD = 10

export type BeatEdge = {
  /** Talk time where the cut opens, in the pause before the sentence. */
  in: number
  /** Talk time where the cut closes, in the pause after the sentence. */
  out: number
  speechStart: number
  speechEnd: number
}

/**
 * Open and close a beat on the pause around a whole sentence, about {@link BREATH} seconds
 * clear of the words. `before` is when the previous sentence has finished. `after` is when
 * the next one starts. A shorter pause keeps the whole pause, so the cut never lands
 * inside either sentence.
 */
export function snapBeat(speechStart: number, speechEnd: number, before: number, after: number, breath = BREATH): BeatEdge {
  const lead = Math.min(breath, Math.max(0, speechStart - before))
  const tail = Math.min(breath, Math.max(0, after - speechEnd))
  return {
    in: speechStart - lead,
    out: speechEnd + tail,
    speechStart,
    speechEnd,
  }
}

/** Download window: {@link WINDOW_PAD} seconds either side of the snapped beat. */
export function sourceWindow(edge: BeatEdge, pad = WINDOW_PAD, talkEnd = Infinity) {
  const start = Math.max(0, Math.round((edge.in - pad) * 100) / 100)
  const end = Math.round(Math.min(talkEnd, edge.out + pad) * 100) / 100
  return { start, end }
}

const spokenLength = (word: string) => Math.min(0.55, Math.max(0.18, 0.05 * word.length + 0.12))

export function normaliseWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True when `quote` appears word for word in `transcript`, ignoring case and punctuation. */
export function isVerbatim(quote: string, transcript: string) {
  const needle = normaliseWords(quote)
  return needle.length > 0 && normaliseWords(transcript).includes(needle)
}

const token = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '')

/**
 * Pair each word of a beat with the transcript cue nearest its start.
 * The displayed spelling is the cue's own spelling. A cue that cannot be
 * found keeps the beat's own word, which is itself taken from the transcript.
 */
export function alignBeat(cues: CueWord[], beat: string, talkAt: number): CueWord[] {
  const want = beat.split(/\s+/).filter(Boolean)
  if (!want.length) return []
  let start = 0
  let best = Infinity
  const first = token(want[0])
  cues.forEach((cue, index) => {
    if (!first || token(cue.text) !== first) return
    const distance = Math.abs(cue.talkAt - talkAt)
    if (distance < best) {
      best = distance
      start = index
    }
  })
  const out: CueWord[] = []
  let cursor = start
  for (const piece of want) {
    const wanted = token(piece)
    let found = -1
    for (let index = cursor; index < Math.min(cues.length, cursor + 8); index++) {
      if (token(cues[index].text) === wanted) {
        found = index
        break
      }
    }
    if (found >= 0) {
      out.push({ text: cues[found].text, talkAt: cues[found].talkAt })
      cursor = found + 1
    } else {
      const previous = out[out.length - 1]?.talkAt ?? talkAt
      out.push({ text: piece, talkAt: previous + 0.28 })
    }
  }
  for (let index = 1; index < out.length; index++) {
    if (out[index].talkAt < out[index - 1].talkAt) out[index].talkAt = out[index - 1].talkAt
  }
  return out
}

export function scheduleTalk(input: {
  hook: string
  turn: string
  land: string
  hookAt: number
  turnAt: number
  landAt: number
  cues: CueWord[]
}): ScheduledTalk {
  const source: { beat: BeatId; text: string; talkAt: number }[] = [
    { beat: 'hook', text: input.hook, talkAt: input.hookAt },
    { beat: 'turn', text: input.turn, talkAt: input.turnAt },
    { beat: 'land', text: input.land, talkAt: input.landAt },
  ]
  const words: ScheduledWord[] = []
  const beats: BeatSpan[] = []
  let videoAt = LEAD_IN
  for (const beat of source) {
    const aligned = alignBeat(input.cues, beat.text, beat.talkAt)
    const firstTalk = aligned[0]?.talkAt ?? beat.talkAt
    const last = aligned[aligned.length - 1]
    const tail = last ? spokenLength(last.text) + 0.28 : 0.8
    const duration = Math.max(1.6, (last ? last.talkAt + tail : beat.talkAt + 1.2) - firstTalk)
    beats.push({ beat: beat.beat, text: beat.text, talkAt: firstTalk, videoAt, duration })
    for (const word of aligned) {
      const showAt = videoAt + Math.max(0, word.talkAt - firstTalk)
      words.push({ text: word.text, talkAt: word.talkAt, beat: beat.beat, showAt })
    }
    videoAt += duration + BEAT_GAP
  }
  const spokenSeconds = Math.max(LEAD_IN + 1, videoAt - BEAT_GAP + 0.45)
  return {
    words,
    beats,
    spokenSeconds,
    cinemaSeconds: Math.max(spokenSeconds, CINEMA_SIT),
    learnMoreSeconds: LEARN_MORE_SECONDS,
  }
}

export function wordsVisibleAt(words: ScheduledWord[], time: number) {
  return words.filter((word) => word.showAt <= time + 1e-4)
}

/**
 * No word is on screen before it is spoken.
 * Inside a beat, video time moves at the same rate as the transcript, and a
 * later beat never starts before the previous beat's last word.
 */
export function textNeverEarly(schedule: ScheduledTalk) {
  for (const beat of schedule.beats) {
    const group = schedule.words.filter((word) => word.beat === beat.beat)
    for (const word of group) {
      const videoOffset = word.showAt - beat.videoAt
      const talkOffset = word.talkAt - beat.talkAt
      if (videoOffset + 0.02 < talkOffset) return false
      if (word.showAt + 1e-6 < beat.videoAt) return false
    }
  }
  for (let index = 0; index < schedule.words.length; index++) {
    const word = schedule.words[index]
    if (index > 0 && word.showAt + 1e-6 < schedule.words[index - 1].showAt) return false
    const before = wordsVisibleAt(schedule.words, word.showAt - 0.05)
    if (word.showAt >= 0.05 && before.some((shown) => shown === word)) return false
  }
  return schedule.words.every((word) => word.showAt <= schedule.spokenSeconds + 1e-6)
}

export function visibleIsPrefix(words: ScheduledWord[], time: number) {
  const visible = wordsVisibleAt(words, time)
  return visible.every((word, index) => word === words[index])
}

export type SpeechRun = { start: number; end: number }

/** Speech runs in a level envelope. A gap under 0.42s stays inside the phrase. */
export function speechRuns(levels: number[], origin: number, step = 0.05, threshold = 0.02): SpeechRun[] {
  const raw: SpeechRun[] = []
  let open = -1
  levels.forEach((level, index) => {
    const spoken = level >= threshold
    if (spoken && open < 0) open = index
    if (!spoken && open >= 0) {
      raw.push({ start: origin + open * step, end: origin + index * step })
      open = -1
    }
  })
  if (open >= 0) raw.push({ start: origin + open * step, end: origin + levels.length * step })
  const kept = raw.filter((run, index) => {
    if (run.end - run.start >= 0.1) return true
    const before = index > 0 ? run.start - raw[index - 1].end : 9
    const after = index + 1 < raw.length ? raw[index + 1].start - run.end : 9
    return before < 0.4 || after < 0.4
  })
  const merged: SpeechRun[] = []
  for (const run of kept) {
    const prev = merged[merged.length - 1]
    if (prev && run.start - prev.end < 0.42) prev.end = run.end
    else merged.push({ ...run })
  }
  return merged
}

/**
 * Lay the sentence across the speech, in order. A short burst before a real pause
 * takes one word, so the rest of the line waits through the silence instead of
 * arriving while he is still quiet.
 */
export function placeOnSpeech(text: string, runs: SpeechRun[]): CueWord[] {
  const pieces = text.split(/\s+/).filter(Boolean)
  if (!pieces.length) return []
  if (!runs.length) return pieces.map((word, index) => ({ text: word, talkAt: index * 0.28 }))
  const groups: string[][] = runs.map(() => [])
  let cursor = 0
  for (let index = 0; index < runs.length && cursor < pieces.length; index++) {
    const later = runs.slice(index + 1)
    const duration = runs[index].end - runs[index].start
    const pauseAfter = later.length ? later[0].start - runs[index].end : 0
    const remaining = pieces.length - cursor
    let take: number
    if (!later.length) take = remaining
    else if (duration < 1.05 && pauseAfter >= 1) take = 1
    else {
      const rest = [runs[index], ...later].reduce((sum, run) => sum + (run.end - run.start), 0)
      const rateCap = Math.max(1, Math.floor(duration / 0.28))
      take = Math.max(1, Math.round((remaining * duration) / rest))
      take = Math.min(take, rateCap, remaining - later.length)
      take = Math.max(1, take)
    }
    groups[index] = pieces.slice(cursor, cursor + take)
    cursor += take
  }
  if (cursor < pieces.length) groups[groups.length - 1].push(...pieces.slice(cursor))
  const placed: CueWord[] = []
  groups.forEach((group, index) => {
    const run = runs[index]
    const span = Math.max(0.04, run.end - run.start - 0.08)
    group.forEach((word, at) => {
      const talkAt = group.length === 1 ? run.start : run.start + (span * at) / (group.length - 1)
      placed.push({ text: word, talkAt })
    })
  })
  return placed
}

export type Level = { at: number; level: number }

/** Nudge a whole key phrase onto the stress nearest its even placement, without leaving the pause. */
export function leanOnStress(times: number[], spans: { from: number; to: number }[], levels: Level[]) {
  const next = [...times]
  for (const span of spans) {
    const estimate = times[span.from]
    const prev = span.from > 0 ? next[span.from - 1] + 0.08 : estimate - 0.35
    const cap = span.to + 1 < times.length ? times[span.to + 1] - 0.08 : times[span.to] + 0.35
    const window = levels.filter((row) => row.level >= 0.02 && row.at >= Math.max(prev, estimate - 0.25) && row.at <= Math.min(cap, estimate + 0.3))
    if (!window.length) continue
    const peak = window.reduce((best, row) => (row.level > best.level ? row : best))
    const shift = peak.at - estimate
    if (Math.abs(shift) < 0.04) continue
    for (let index = span.from; index <= span.to; index++) next[index] = times[index] + shift
  }
  for (let index = 1; index < next.length; index++) if (next[index] < next[index - 1] + 0.05) next[index] = next[index - 1] + 0.05
  return next
}

/** A film title card between cinema shots. */
export const INTERTITLE = 1.7

/**
 * The picture stays after the sentence so the last word can be read.
 * The voice still ends at `out`; this hold is a frozen frame, not more of the talk.
 */
export const PHRASE_HOLD = 0.5

export type FootageSpan = {
  beat: BeatId
  text: string
  in: number
  out: number
  words: CueWord[]
}

/** Play each snapped sentence back to back. `gap` is the quiet title between shots. */
export function scheduleFootage(beats: FootageSpan[], gap = 0): ScheduledTalk {
  const words: ScheduledWord[] = []
  const spans: BeatSpan[] = []
  let videoAt = 0
  beats.forEach((beat, index) => {
    const spoken = beat.words.length ? beat.words : [{ text: beat.text, talkAt: beat.in }]
    const duration = Math.max(0.4, beat.out - beat.in) + PHRASE_HOLD
    spans.push({ beat: beat.beat, text: beat.text, talkAt: spoken[0].talkAt, videoAt, duration })
    for (const word of spoken) {
      const at = Math.min(beat.out, Math.max(word.talkAt, beat.in))
      words.push({ text: word.text, talkAt: at, beat: beat.beat, showAt: videoAt + (at - beat.in) })
    }
    videoAt += duration
    if (gap > 0 && index < beats.length - 1) videoAt += gap
  })
  return { words, beats: spans, spokenSeconds: videoAt, cinemaSeconds: videoAt, learnMoreSeconds: LEARN_MORE_SECONDS }
}

export function durationSeconds(schedule: ScheduledTalk, cinema: boolean) {
  return (cinema ? schedule.cinemaSeconds : schedule.spokenSeconds) + schedule.learnMoreSeconds
}

export function activeBeat(schedule: ScheduledTalk, time: number): BeatId {
  let beat: BeatId = 'hook'
  for (const span of schedule.beats) if (time >= span.videoAt - 1e-4) beat = span.beat
  return beat
}

/** Split one beat's words into consecutive cards. The page turns on the first cue of the next card. */
export function cardsOf(words: ScheduledWord[], size = WORDS_PER_CARD) {
  const cards: ScheduledWord[][] = []
  for (let index = 0; index < words.length; index += size) cards.push(words.slice(index, index + size))
  return cards
}

/** The card whose first word has been reached, and none of the next card. */
export function cardAt(words: ScheduledWord[], time: number, size = WORDS_PER_CARD) {
  const cards = cardsOf(words, size)
  let card = cards[0] || []
  for (const next of cards) {
    if (next[0] && time + 1e-4 >= next[0].showAt) card = next
  }
  return card
}
