import { endsSentence } from '@/lib/sentences'
import type { CaptionCue, FramingSentence, SpokenWord } from './types'

const FUNC = new Set('a an the of to in on for and or but your my our their his her its is are was were be that with as at by from this you i we they it who there which will have has not kind'.split(' '))

export function splitWords(text: string) {
  return text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
}

/** Spread a cue's clock across its words. YouTube cues are line-level; this is the live stand-in for word timings. */
export function wordsFromCues(cues: CaptionCue[]): SpokenWord[] {
  const words: SpokenWord[] = []
  for (const cue of cues) {
    const parts = splitWords(cue.text)
    if (!parts.length) continue
    const span = Math.max(0.12, cue.end - cue.start)
    const each = span / parts.length
    parts.forEach((w, index) => {
      const t = cue.start + each * index
      words.push({ w, t: round3(t), e: round3(t + each) })
    })
  }
  for (let index = 1; index < words.length; index++) {
    if (words[index].t < words[index - 1].t + 0.01) words[index].t = round3(words[index - 1].t + 0.01)
  }
  return words
}

export function sentencesFromWords(words: SpokenWord[], clipEnd?: number): FramingSentence[] {
  if (!words.length) return []
  const groups: SpokenWord[][] = []
  let current: SpokenWord[] = []
  for (const word of words) {
    current.push(word)
    if (endsSentence(word.w) && current.length) {
      groups.push(current)
      current = []
    }
  }
  if (current.length) groups.push(current)
  const sentences: FramingSentence[] = groups.map((group) => {
    const text = group.map((row) => row.w).join(' ')
    const key = pickKey(group)
    return {
      text,
      s: group[0].t,
      e: group[group.length - 1].e ?? group[group.length - 1].t + 0.4,
      key,
      words: group.map((row) => ({ ...row, key: key ? norm(row.w) === norm(key) : false })),
    }
  })
  sentences.forEach((row, index) => {
    const next = sentences[index + 1]?.s ?? clipEnd ?? row.e
    row.next = next
    row.e = round3(Math.min(next, row.e + 0.2))
  })
  return sentences
}

export function sentencesInWindow(sentences: FramingSentence[], start: number, end: number) {
  return sentences.filter((row) => row.s < end - 0.05 && row.e > start + 0.05)
}

function pickKey(words: SpokenWord[]) {
  const scored = words
    .map((row) => row.w.replace(/[^\p{L}\p{N}’'-]+/gu, ''))
    .filter((w) => w.length > 2 && !FUNC.has(w.toLowerCase()))
    .sort((a, b) => b.length - a.length)
  return scored[0] || null
}

function norm(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000
}

/** Break timed words into display lines without joining them first, so spaces cannot collapse. */
export function wrapWordLines(words: string[], max = 20) {
  const lines: string[][] = []
  let current: string[] = []
  let len = 0
  for (const word of words) {
    const add = word.length + (current.length ? 1 : 0)
    if (current.length && len + add > max) {
      lines.push(current)
      current = [word]
      len = word.length
    } else {
      current.push(word)
      len += add
    }
  }
  if (current.length) lines.push(current)
  return lines
}

/** The sentence being said at `time`. Gaps and times outside every cue are empty — never a leftover line. */
export function currentSentence(sentences: FramingSentence[], time: number) {
  if (!sentences.length) return null
  for (const row of sentences) {
    if (time >= row.s && time < row.e) return row
  }
  return null
}

export function sameSpokenText(a: string, b: string) {
  return norm(a) === norm(b) && Boolean(norm(a))
}

/**
 * What F (and any live caption) may put on screen: the timed transcript line
 * for this clock, or nothing. A talk title is never used as a stand-in.
 */
const SUMMARY_ROLES = new Set(['hook', 'turn', 'land'])

/** Timed caption cards from a cut, for F. Summary beats and empty lines stay out. */
export function sentencesFromCaptions(
  lines: { at?: number; text?: string; tidy?: string; role?: string }[] | null | undefined,
  from: number,
  to: number,
): FramingSentence[] {
  const usable = (lines || []).filter((row) => {
    if (row.role && SUMMARY_ROLES.has(row.role)) return false
    const text = (row.tidy || row.text || '').trim()
    return Boolean(text) && row.at != null && Number.isFinite(row.at)
  })
  if (!usable.length) return []
  const words: SpokenWord[] = []
  usable.forEach((row, index) => {
    const start = Number(row.at)
    const end = Number(usable[index + 1]?.at ?? Math.min(to, start + 6))
    const parts = splitWords(row.tidy || row.text || '')
    const each = Math.max(0.12, (Math.max(start + 0.12, end) - start) / Math.max(1, parts.length))
    parts.forEach((w, at) => {
      words.push({ w, t: round3(start + each * at), e: round3(start + each * (at + 1)) })
    })
  })
  return sentencesFromWords(words, to).filter((row) => row.s < to && row.e > from)
}

export function spokenLine(
  sentences: FramingSentence[],
  time: number,
  options?: { from?: number; to?: number; title?: string | null; titles?: (string | null | undefined)[] },
) {
  const live =
    options?.from != null && options?.to != null ? sentencesInWindow(sentences, options.from, options.to) : sentences
  const sentence = currentSentence(live, time)
  if (!sentence) return null
  const titles = [options?.title, ...(options?.titles || [])]
  if (titles.some((title) => title && sameSpokenText(sentence.text, title))) return null
  return sentence
}
