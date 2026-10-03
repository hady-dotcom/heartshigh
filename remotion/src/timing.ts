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
