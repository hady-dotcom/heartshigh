/**
 * Real per-word timed, punctuated words for a feed clip, cut from a processed caption file.
 *
 * The source is content-load's work file for a talk: `words` are the caption words with their own clocks (YouTube
 * auto captions carry one per word), and `disp` is the same words, one for one, with punctuation and casing restored
 * by a local model. A word is shown as `disp` has it (a sentence's first letter is capitalised and stray double quotes
 * are dropped), or left out when it is a sound tag such as "[laughter]", a ">>" speaker mark, or YouTube's "foreign"
 * placeholder for speech it could not transcribe. The only rewording is the hand-checked mishearing fixes passed in
 * `options.fixes` (content/framing/clip-words-fixes.json), which take over the misheard words' own span.
 *
 * The clip keeps only words that start and finish inside its window, so no line begins or ends on a cut word. A
 * sentence that the window catches by its last or first word or two is trimmed away. Long sentences are split into
 * pages that fit the F panel whole, each starting on the clock of its own first word.
 */
import { endsSentence } from '@/lib/sentences'
import { applyWordFixes, type FixHit, type FixToken, type WordFix } from './clip-word-fixes'
import { HOLD_GAP, pickKey, wrapWordLines } from './words'
import type { FramingSentence, FramingTrack, SpokenWord } from './types'

export type WorkFile = { words: [string, number, number][]; disp?: string[]; kind?: string }
export type ClipWindow = { youtubeId: string; start: number; end: number }

/**
 * A page is at most four wrapped lines. Five 20-character lines at the feed's smallest type (a 293 px column) push the
 * page dots onto the "swipe up" hint, so no page, merged or not, goes past four.
 */
export const PAGE_LINES = 4
export const LINE_CHARS = 20
/** A partial sentence at a clip edge this short is the tail of the line before, or the head of the next. */
const EDGE_MIN_WORDS = 3
const EDGE_MIN_SECONDS = 0.8
/** A word may run this far past the out-point and still count as finished. */
const OUT_GRACE = 0.15
/** Longest believable spoken word when the caption gives no end. */
const LONGEST_WORD = 0.6
const SENTENCE_TAIL = 0.2
/** A word that starts later than this before the out-point is cut by it. */
const MIN_INSIDE = 0.25
/** A page on screen for less than this is merged with a neighbour (when the two still fit the panel). */
export const MIN_PAGE_SECONDS = 0.6
/** The panel's hard limit for a merged page: the same four lines. */
const MAX_LINES = PAGE_LINES
/**
 * A silence longer than this between two words ends the page, even mid-sentence, and the page's time ends with its last
 * word; the player keeps a line up for HOLD_GAP after it ends, so a longer pause shows nothing instead of a frozen line.
 */
export const PAUSE_SPLIT = HOLD_GAP
/** A long sentence's last page keeps at least this many words, so "everything." is not left alone. */
const MIN_TAIL_WORDS = 4

const SOUND_TAG = /^\[[^\]]*\]$|^>>+$|^-+$/
const round2 = (value: number) => Math.round(value * 100) / 100

/** The punctuation model leaves unmatched double quotes; like the content sheets, F drops them. Words stay as they are. */
function shown(word: string) {
  const text = word.trim()
  if (!text || SOUND_TAG.test(text)) return null
  const plain = text.replace(/["“”]/g, '')
  return plain || null
}

/** A sentence opens with a capital (casing only; the word itself is unchanged). */
function opening(word: string) {
  return word.replace(/^([^\p{L}]*)(\p{Ll})/u, (_, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`)
}

type Timed = { w: string; t: number; e: number; endsSentence: boolean; i: number; pauseBefore?: boolean }

/**
 * YouTube gives the first words of a caption line one shared clock (sometimes a whole line). Such a run is spread
 * forward, one word at least MIN_WORD_GAP after the last, so each word gets its own moment; the next real clock that is
 * already later is kept as it is.
 */
export const MIN_WORD_GAP = 0.15
function spreadSharedClocks(words: Timed[], until: number) {
  for (let index = 1; index < words.length; index++) {
    const floor = words[index - 1].t + MIN_WORD_GAP
    if (words[index].t < floor) words[index].t = floor
  }
  words.forEach((word, at) => {
    const next = words[at + 1]?.t
    word.e = Math.max(word.t + 0.05, Math.min(Math.max(word.e, word.t + 0.05), next ?? Math.max(word.e, word.t + 0.05), until))
  })
}

function sentencesOfSlice(words: Timed[]) {
  const groups: Timed[][] = []
  let current: Timed[] = []
  for (const word of words) {
    current.push(word)
    if (word.endsSentence) {
      groups.push(current)
      current = []
    }
  }
  if (current.length) groups.push(current)
  return groups
}

function tooSmall(group: Timed[]) {
  if (group.length < EDGE_MIN_WORDS) return true
  return group[group.length - 1].e - group[0].t < EDGE_MIN_SECONDS
}

/** Pages of one sentence that each fit the panel; a page prefers to end on a comma, colon or dash. */
function pagesOf(sentence: Timed[]) {
  const pages: Timed[][] = []
  let current: Timed[] = []
  const fits = (rows: Timed[]) => wrapWordLines(rows.map((row) => row.w), LINE_CHARS).length <= PAGE_LINES
  for (const word of sentence) {
    if (!current.length || fits([...current, word])) {
      current.push(word)
      continue
    }
    let cut = current.length
    for (let at = current.length - 1; at >= Math.ceil(current.length / 2); at--) {
      if (/[,;:–—-]["”’')\]]*$/.test(current[at - 1]?.w || '') && current[at].t > current[at - 1].t) {
        cut = at
        break
      }
    }
    // Never start a page on a clock the page before already used.
    while (cut > 1 && current[cut]?.t === current[cut - 1].t) cut--
    pages.push(current.slice(0, cut))
    current = [...current.slice(cut), word]
  }
  if (current.length) pages.push(current)
  // Even out a long sentence's last page: move words down from the page before while both still fit.
  while (pages.length > 1) {
    const last = pages[pages.length - 1]
    const prev = pages[pages.length - 2]
    if (last.length >= MIN_TAIL_WORDS || prev.length <= MIN_TAIL_WORDS) break
    const moved = [prev[prev.length - 1], ...last]
    if (!fits(moved)) break
    prev.pop()
    pages[pages.length - 1] = moved
  }
  return pages
}

/** A sentence split where the speaker pauses longer than PAUSE_SPLIT. */
function runsOf(sentence: Timed[]) {
  const runs: Timed[][] = []
  for (const word of sentence) {
    if (!runs.length || word.pauseBefore) runs.push([])
    runs[runs.length - 1].push(word)
  }
  return runs
}

export type ClipWordsOptions = {
  /** Hand-checked corrections (see clip-word-fixes.ts), applied before sentences are found. */
  fixes?: WordFix[]
  /** Told about every fix that changed a word. */
  onFix?: (hit: FixHit) => void
}

/** The clip's sentences, or null when the window holds no timed words. */
export function clipSentences(work: WorkFile, clip: ClipWindow, options: ClipWordsOptions = {}): FramingSentence[] | null {
  const raw = work.words || []
  const disp = work.disp && work.disp.length === raw.length ? work.disp : raw.map((row) => row[0])
  let inTag = false
  const spoken: FixToken[] = []
  raw.forEach((row, index) => {
    const token = (disp[index] ?? row[0]).trim()
    // A sound tag can span words: "[Clears throat]".
    if (inTag || (/^\[/.test(token) && !token.includes(']'))) {
      inTag = !token.includes(']')
      return
    }
    // YouTube writes "[foreign]" for speech it cannot transcribe (often Arabic); it arrives as the bare word.
    if (/^foreign$/i.test(String(row[0]).trim())) return
    const text = shown(token)
    if (text) spoken.push({ w: text, t: Number(row[1]), e: Number(row[2]) })
  })
  let fixed = spoken
  if (options.fixes?.length) {
    const result = applyWordFixes(spoken, options.fixes, clip)
    fixed = result.tokens
    if (options.onFix) result.hits.forEach(options.onFix)
  }
  let afterStop = true
  const all: (Timed | null)[] = fixed.map((row, index) => {
    const w = afterStop ? opening(row.w) : row.w
    afterStop = endsSentence(w)
    return { w, t: row.t, e: row.e, endsSentence: afterStop, i: index }
  })
  const firstIn = all.findIndex((row) => row && row.t >= clip.start - 0.05)
  if (firstIn < 0) return null
  const picked: Timed[] = []
  let lastIn = -1
  for (let index = firstIn; index < all.length; index++) {
    const row = all[index]
    if (!row) continue
    if (row.t > clip.end - MIN_INSIDE) break
    const finish = Math.min(row.e, row.t + LONGEST_WORD)
    if (finish > clip.end + OUT_GRACE) break
    picked.push({ ...row, t: Math.max(row.t, clip.start) })
    lastIn = index
  }
  if (!picked.length) return null
  spreadSharedClocks(picked, clip.end)
  // Words a shared clock pushed up against the out-point have no moment of their own inside the clip.
  while (picked.length && picked[picked.length - 1].t > clip.end - MIN_INSIDE) picked.pop()
  if (!picked.length) return null
  lastIn = picked[picked.length - 1].i
  for (let index = 1; index < picked.length; index++) {
    const prev = picked[index - 1]
    picked[index].pauseBefore = picked[index].t - Math.min(prev.e, prev.t + LONGEST_WORD) > PAUSE_SPLIT
  }

  const groups = sentencesOfSlice(picked)
  const before = all.slice(0, firstIn).reverse().find((row) => row)
  const headCut = Boolean(before && !before.endsSentence)
  const tailCut = !picked[picked.length - 1].endsSentence && all.slice(lastIn + 1).some((row) => row)
  if (headCut && groups.length && tooSmall(groups[0])) groups.shift()
  if (tailCut && groups.length && tooSmall(groups[groups.length - 1])) groups.pop()
  if (!groups.length) return null

  type Page = { words: Timed[]; endsSentence: boolean }
  const pages: Page[] = groups.flatMap((group) =>
    runsOf(group).flatMap((run, runAt, runs) =>
      pagesOf(run).map((page, at, list) => ({ words: page, endsSentence: runAt === runs.length - 1 && at === list.length - 1 })),
    ),
  )
  const pauseBefore = (index: number) => Boolean(pages[index]?.words[0].pauseBefore)
  const startOf = (index: number) => (pages[index] ? pages[index].words[0].t : clip.end)
  const fitsPanel = (words: Timed[]) => wrapWordLines(words.map((row) => row.w), LINE_CHARS).length <= MAX_LINES
  // A one-word page ("No.", "Why?") would flash by: it joins the page after it, or the one before, when both fit.
  for (let index = 0; index < pages.length; index++) {
    if (pages.length < 2 || startOf(index + 1) - startOf(index) >= MIN_PAGE_SECONDS) continue
    const next = pages[index + 1]
    const prev = pages[index - 1]
    if (next && !pauseBefore(index + 1) && fitsPanel([...pages[index].words, ...next.words])) {
      pages.splice(index, 2, { words: [...pages[index].words, ...next.words], endsSentence: next.endsSentence })
      index--
    } else if (prev && !pauseBefore(index) && fitsPanel([...prev.words, ...pages[index].words])) {
      pages.splice(index - 1, 2, { words: [...prev.words, ...pages[index].words], endsSentence: pages[index].endsSentence })
      index -= 2
    }
  }
  const sentences: FramingSentence[] = pages.map((page, index) => {
    const s = round2(page.words[0].t)
    const nextStart = round2(startOf(index + 1))
    const spokenEnd = page.words[page.words.length - 1].e
    // A page ends with its last word (plus a breath), or when the next one starts; the player holds it briefly after.
    const e = page.endsSentence || pauseBefore(index + 1) ? Math.min(nextStart, spokenEnd + SENTENCE_TAIL, clip.end) : nextStart
    // Each word keeps its own start; its end is the next word's start, so it is not repeated (the opening stays small).
    const words: SpokenWord[] = page.words.map((row) => ({ w: row.w, t: round2(row.t) }))
    return { text: words.map((row) => row.w).join(' '), s, e: round2(Math.max(e, s + 0.05)), next: nextStart, key: pickKey(words), words }
  })
  return sentences
}

/** A Framing F track (one F segment, the whole clip) that carries the clip's timed words. */
export function clipWordsTrack(work: WorkFile, clip: ClipWindow, options: ClipWordsOptions = {}): FramingTrack | null {
  const sentences = clipSentences(work, clip, options)
  if (!sentences?.length) return null
  return {
    version: 1,
    youtubeId: clip.youtubeId,
    start: clip.start,
    end: clip.end,
    segments: [{ start: clip.start, end: clip.end, mode: 'F', confidence: 0, focus: { x: 0.5, y: 0.45 } }],
    sentences,
  }
}

/** Share of the window during which a timed line is on screen (sentence spans only, no hold). */
export function wordCoverage(sentences: FramingSentence[] | undefined | null, start: number, end: number) {
  if (!sentences?.length || end <= start) return 0
  const spans = sentences
    .map((row) => [Math.max(start, row.s), Math.min(end, row.e)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0])
  let covered = 0
  let reach = start
  for (const [a, b] of spans) {
    const from = Math.max(a, reach)
    if (b > from) covered += b - from
    reach = Math.max(reach, b)
  }
  return covered / (end - start)
}

/**
 * Share of the window during which the player shows a line: each page from its start until HOLD_GAP after it ends (how
 * spokenLine keeps a line through a breath). A pause longer than that shows nothing, so it counts as uncovered.
 */
export function shownCoverage(sentences: FramingSentence[] | undefined | null, start: number, end: number) {
  return wordCoverage(sentences?.map((row) => ({ ...row, e: row.e + HOLD_GAP })), start, end)
}
