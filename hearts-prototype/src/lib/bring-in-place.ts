// Suggest a Jibril door and a Ghunya heading from timed captions.
// Phrase lists are derived from the working doors, the clause map, and the Ghunya shelf.
// Nothing here calls a model. A match counts by how much of the talk it covers.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DOORS, doorCode, doorLabel, type Door } from './doors'
import { parseJibrilMap, type ClauseEntry } from './seats'
import { formatTimestamp, parseTranscript, type Cue } from './transcript'

/** Under this share of the timed talk, the field stays blank. */
export const PLACE_MIN_PERCENT = 12

/**
 * The leading candidate must cover at least this multiple of the next candidate's
 * time-weighted score, or the two are too close and the field stays blank.
 */
export const PLACE_LEAD_RATIO = 1.5

const STOP = new Set(
  `the and that this with from your you are was were for have has had not but they them his her she its our out about into just like what when there then than been being would could should vol vols page pages same also later grain thin strong which
a an of to in on at by or as if is be it we he do who how can will their these those such only more most other each all any some own here once again still even well much many across among around including inside toward towards per via both few nor too very may did does shall though over after before where while because until first second third chapter`.split(/\s+/),
)

export type PlaceTerm = { phrase: string; at: string; seconds: number }

export type FieldPlacement = {
  value: string
  confidence: 'high' | 'medium' | 'low'
  coverPct: number
  terms: PlaceTerm[]
  reason: string
}

export type PlaceCandidate = {
  id: string
  label: string
  phrases: string[]
}

export type PlaceCatalogue = {
  jibril: PlaceCandidate[]
  ghunya: PlaceCandidate[]
}

type PhraseBag = { id: string; label: string; title: Set<string>; body: Set<string> }

function stem(word: string) {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length > 4 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

/** Content words of a map line, in order. Function words and volume citations drop out. */
export function contentWords(text: string) {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .map(stem)
    .filter((word) => word.length > 2 && !STOP.has(word))
}

/** Contiguous phrases of one to four content words. The words stay the map's own words. */
export function phrasesFromText(text: string) {
  const words = contentWords(text)
  const phrases = new Set<string>()
  for (let size = 1; size <= 4; size++) {
    for (let index = 0; index <= words.length - size; index++) phrases.add(words.slice(index, index + size).join(' '))
  }
  return [...phrases]
}

function addPhrases(bag: Set<string>, text: string) {
  for (const phrase of phrasesFromText(text)) bag.add(phrase)
}

function chunks(text: string) {
  return text
    .split(/[\n.;:]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function finishBags(bags: PhraseBag[]): PlaceCandidate[] {
  const df = new Map<string, number>()
  for (const bag of bags) {
    for (const phrase of new Set([...bag.title, ...bag.body])) df.set(phrase, (df.get(phrase) || 0) + 1)
  }
  return bags.map((bag) => {
    const phrases = new Set<string>(bag.title)
    for (const phrase of bag.body) {
      const words = phrase.split(' ').length
      const count = df.get(phrase) || 0
      // A title's own words always count. A word or phrase from a clause counts only when few sections share it.
      if (words >= 2 ? count <= 3 : count <= 1) phrases.add(phrase)
    }
    return { id: bag.id, label: bag.label, phrases: [...phrases].sort() }
  })
}

/** Numbered sections and bullet lines from content/ghunya-shelf.txt. Arrowed course titles are not headings. */
export function parseGhunyaHeadings(source: string) {
  const headings: string[] = []
  const seen = new Set<string>()
  for (const raw of source.replace(/\f/g, '\n').split('\n')) {
    const line = raw.replace(/■/g, '').trim()
    const section = line.match(/^\d+\.\s+(.+)/)
    const bullet = line.match(/^[•·]\s*(.+)/)
    const heading = (section?.[1] || bullet?.[1] || '').replace(/\s+/g, ' ').trim()
    if (!heading) continue
    const key = heading.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    headings.push(heading.slice(0, 200))
  }
  return headings
}

/**
 * One phrase list per working door, and one per Ghunya heading.
 * Door phrases come from that door's title and teaching, plus the teachings, seats and series of its clauses.
 * Heading phrases come from the heading line itself.
 */
export function buildPlaceCatalogue(input: { doors: Door[]; clauses: ClauseEntry[]; shelf: string }): PlaceCatalogue {
  const clauses = new Map(input.clauses.map((entry) => [entry.number, entry]))
  const jibril = finishBags(input.doors.map((door) => {
    const title = new Set<string>()
    const body = new Set<string>()
    addPhrases(title, door.title)
    for (const piece of chunks(door.teaching || '')) addPhrases(body, piece)
    for (const number of door.clauses) {
      const entry = clauses.get(number)
      if (!entry) continue
      for (const piece of chunks(entry.teaching)) addPhrases(body, piece)
      for (const seat of entry.seats) for (const piece of chunks(seat)) addPhrases(body, piece)
      for (const piece of chunks(entry.series)) addPhrases(body, piece)
    }
    return { id: doorCode(door.number), label: doorLabel(door), title, body }
  }))
  const ghunya = finishBags(parseGhunyaHeadings(input.shelf).map((heading) => {
    const title = new Set<string>()
    addPhrases(title, heading)
    return { id: heading, label: heading, title, body: new Set<string>() }
  }))
  return { jibril, ghunya }
}

let cached: PlaceCatalogue | null = null

/** The doors, the clause map, and the Ghunya shelf as they are shipped in content/. */
export function loadPlaceCatalogue(root = process.cwd()) {
  if (cached && root === process.cwd()) return cached
  const map = parseJibrilMap(readFileSync(path.join(root, 'content/jibril-map.txt'), 'utf8'))
  const shelf = readFileSync(path.join(root, 'content/ghunya-shelf.txt'), 'utf8')
  const catalogue = buildPlaceCatalogue({ doors: DOORS, clauses: [...map.values()], shelf })
  if (root === process.cwd()) cached = catalogue
  return catalogue
}

type Scored = { candidate: PlaceCandidate; share: number; mass: number; covered: number; terms: PlaceTerm[] }

function phraseHits(words: string[], phrase: string) {
  const needle = phrase.split(' ')
  const size = needle.length
  for (let index = 0; index <= words.length - size; index++) {
    let same = true
    for (let step = 0; step < size; step++) {
      if (words[index + step] !== needle[step]) {
        same = false
        break
      }
    }
    if (same) return true
  }
  return false
}

function mergedSeconds(ranges: [number, number][]) {
  const sorted = ranges.filter((range) => range[1] > range[0]).sort((a, b) => a[0] - b[0])
  let total = 0
  let end = -Infinity
  for (const [start, stop] of sorted) {
    const from = Math.max(start, end)
    if (stop > from) total += stop - from
    end = Math.max(end, stop)
  }
  return total
}

function scoreCandidate(cues: Cue[], words: string[][], candidate: PlaceCandidate, talkSeconds: number): Scored {
  const matched: { index: number; words: number; phrases: string[] }[] = []
  for (let index = 0; index < cues.length; index++) {
    const hit = candidate.phrases.filter((phrase) => phraseHits(words[index], phrase))
    if (!hit.length) continue
    const longest = hit.reduce((best, phrase) => Math.max(best, phrase.split(' ').length), 0)
    matched.push({ index, words: longest, phrases: hit })
  }
  const ranges = matched.map((hit) => [cues[hit.index].start, cues[hit.index].end] as [number, number])
  const covered = mergedSeconds(ranges)
  const mass = matched.reduce((sum, hit) => sum + hit.words * Math.max(0, cues[hit.index].end - cues[hit.index].start), 0)
  const byPhrase = new Map<string, { seconds: number; start: number }>()
  for (const hit of matched) {
    const cue = cues[hit.index]
    const seconds = Math.max(0, cue.end - cue.start)
    for (const phrase of hit.phrases) {
      const found = byPhrase.get(phrase)
      if (!found) byPhrase.set(phrase, { seconds, start: cue.start })
      else {
        found.seconds += seconds
        found.start = Math.min(found.start, cue.start)
      }
    }
  }
  const terms = [...byPhrase.entries()]
    .map(([phrase, found]) => ({ phrase, at: formatTimestamp(found.start), seconds: found.seconds }))
    .sort((a, b) => b.seconds - a.seconds || b.phrase.length - a.phrase.length)
    .slice(0, 4)
  return { candidate, share: talkSeconds > 0 ? covered / talkSeconds : 0, mass, covered, terms }
}

function placementFor(scored: Scored[], noun: string): FieldPlacement {
  const ranked = scored.filter((row) => row.mass > 0).sort((a, b) => b.mass - a.mass || b.share - a.share || a.candidate.id.localeCompare(b.candidate.id))
  const best = ranked[0]
  if (!best) {
    return {
      value: '',
      confidence: 'low',
      coverPct: 0,
      terms: [],
      reason: `No ${noun} in the map shares the words of this talk, so it is left blank.`,
    }
  }
  const pct = Math.round(best.share * 100)
  const rival = ranked[1] && Math.round(ranked[1].share * 100) >= 4 ? ranked[1] : null
  const lead = !rival || best.mass >= rival.mass * PLACE_LEAD_RATIO
  if (pct < PLACE_MIN_PERCENT) {
    return {
      value: '',
      confidence: 'low',
      coverPct: pct,
      terms: best.terms,
      reason: `The closest ${noun} is ${best.candidate.label}, and those words cover ${pct}% of the talk. That is not enough to fill it in.`,
    }
  }
  if (!lead && rival) {
    const rivalPct = Math.round(rival.share * 100)
    return {
      value: '',
      confidence: 'low',
      coverPct: pct,
      terms: best.terms,
      reason: `${best.candidate.label} covers ${pct}% of the talk and ${rival.candidate.label} covers ${rivalPct}%. They are too close, so the ${noun} is left blank.`,
    }
  }
  const strong = pct >= 25 && (!rival || best.mass >= rival.mass * 2)
  return {
    value: best.candidate.id,
    confidence: strong ? 'high' : 'medium',
    coverPct: pct,
    terms: best.terms,
    reason: '',
  }
}

export type TalkPlacement = { jibril: FieldPlacement; ghunya: FieldPlacement }

/** Score one timed transcript. An empty transcript is low confidence, with `emptyReason` as the why. */
export function scoreBringInTalk(transcript: string | null | undefined, catalogue: PlaceCatalogue, emptyReason = 'No captions yet.'): TalkPlacement {
  const cues = transcript?.trim() ? parseTranscript(transcript).cues.filter((cue) => cue.end > cue.start && cue.text.trim()) : []
  if (!cues.length) {
    const blank: FieldPlacement = { value: '', confidence: 'low', coverPct: 0, terms: [], reason: emptyReason }
    return { jibril: blank, ghunya: { ...blank } }
  }
  const talkSeconds = mergedSeconds(cues.map((cue) => [cue.start, cue.end]))
  const words = cues.map((cue) => contentWords(cue.text))
  return {
    jibril: placementFor(catalogue.jibril.map((candidate) => scoreCandidate(cues, words, candidate, talkSeconds)), 'Jibril section'),
    ghunya: placementFor(catalogue.ghunya.map((candidate) => scoreCandidate(cues, words, candidate, talkSeconds)), 'Ghunya heading'),
  }
}

export async function placeBringInRows<T extends { id: string; captions: string; jibril: string; ghunya: string }>(
  rows: T[],
  options: {
    catalogue: PlaceCatalogue
    presetJibril?: string
    presetGhunya?: string
    fetchTranscript: (id: string) => Promise<string | null>
  },
): Promise<Array<T & { jibril: string; ghunya: string; jibrilPlace: FieldPlacement; ghunyaPlace: FieldPlacement }>> {
  const presetJibril = options.presetJibril || ''
  const presetGhunya = options.presetGhunya || ''
  const out: Array<T & { jibril: string; ghunya: string; jibrilPlace: FieldPlacement; ghunyaPlace: FieldPlacement }> = new Array(rows.length)
  let next = 0
  async function worker() {
    while (next < rows.length) {
      const index = next
      next += 1
      const row = rows[index]
      let transcript: string | null = null
      let emptyReason = 'No captions yet.'
      if (row.captions === 'no') emptyReason = 'No captions on this film.'
      else if (row.captions === 'unavailable') emptyReason = 'This film is not available, so it is not placed.'
      else {
        try {
          transcript = await options.fetchTranscript(row.id)
        } catch {
          transcript = null
        }
        if (!transcript?.trim()) emptyReason = 'No captions yet.'
      }
      const scored = scoreBringInTalk(transcript, options.catalogue, emptyReason)
      out[index] = {
        ...row,
        jibril: presetJibril || scored.jibril.value,
        ghunya: presetGhunya || scored.ghunya.value,
        jibrilPlace: scored.jibril,
        ghunyaPlace: scored.ghunya,
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, rows.length) }, () => worker()))
  return out
}
