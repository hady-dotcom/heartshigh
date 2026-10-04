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
  const sentences = groups.map((group) => {
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
  return sentences.filter((row) => row.e >= start - 0.15 && row.s <= end + 0.15)
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

export function currentSentence(sentences: FramingSentence[], time: number) {
  if (!sentences.length) return null
  let lo = 0
  let hi = sentences.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const row = sentences[mid]
    if (time < row.s) hi = mid - 1
    else if (time >= (row.next ?? row.e)) lo = mid + 1
    else return row
  }
  if (time < sentences[0].s) return sentences[0]
  return sentences[sentences.length - 1]
}
