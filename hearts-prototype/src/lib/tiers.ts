// Three tiers per talk: the hors d'oeuvre (15 to 20 seconds), the appetiser (up to about 3 minutes, hook, turn and
// land) and the main (the whole talk from 0:00, with pop-ups). Drafts come from the transcript in "line mode": the
// captions are cut into short spoken lines, and every quote is one of those lines, word for word. A person still has
// to check each draft before it counts as checked.
import { killListHits } from './opening-data'
import { formatTimestamp, parseTranscript, type Cue } from './transcript'

export const HORS_MIN = 15
export const HORS_MAX = 20
export const APPETISER_MAX = 180
export const DRAFT_NOTE = 'Draft, needs a human check. Times and lines come from the captions by machine.'

type Word = { at: number; text: string }

function stamp(token: string) {
  const match = token.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/)
  if (!match) return null
  return Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number((match[4] || '0').padEnd(3, '0')) / 1000
}

const MARKER = /^(\[[^\]]*\]|>>|-)$/

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', '#39': "'" }
const decode = (text: string) => text.replace(/&(nbsp|amp|quot|apos|lt|gt|#39);/g, (_, name: string) => ENTITIES[name])

function wordsOfLine(line: string, start: number, end: number, rolling: boolean): Word[] {
  if (rolling && line.includes('<')) {
    const out: Word[] = []
    let at = start
    for (const part of line.split(/(<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}>)/)) {
      const tag = part.match(/^<(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3})>$/)
      if (tag) {
        at = stamp(tag[1]) ?? at
        continue
      }
      for (const word of decode(part.replace(/<\/?c[^>]*>/g, '')).split(/\s+/).filter(Boolean)) out.push({ at, text: word })
    }
    return out
  }
  const tokens = decode(line.replace(/<[^>]+>/g, '')).split(/\s+/).filter(Boolean)
  return tokens.map((text, index) => ({ at: start + ((end - start) * index) / Math.max(1, tokens.length), text }))
}

/** Every spoken word with the moment it starts, from a YouTube caption file (rolling auto captions or plain cues). */
export function wordTimeline(raw: string): Word[] {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const rolling = /<c>/.test(text)
  const blocks: { start: number; end: number; lines: string[] }[] = []
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split('\n')
    const arrow = lines.findIndex((line) => line.includes('-->'))
    if (arrow === -1) continue
    const [startRaw, endRaw] = lines[arrow].split('-->').map((part) => part.trim().split(/\s+/)[0])
    const start = stamp(startRaw)
    const end = stamp(endRaw)
    if (start === null || end === null) continue
    const spoken = lines.slice(arrow + 1).map((line) => line.trim()).filter(Boolean)
    if (!spoken.length) continue
    // Rolling captions repeat the previous line above the new one, and flash each line for 10 ms when it scrolls.
    if (rolling && end - start < 0.05) continue
    blocks.push({ start, end, lines: rolling ? [spoken[spoken.length - 1]] : spoken })
  }
  // Plain cues often overlap; the words keep the file's order and are spread up to the next cue.
  blocks.sort((a, b) => a.start - b.start)
  const words: Word[] = []
  for (const [index, block] of blocks.entries()) {
    const until = rolling ? block.end : Math.max(block.start + 0.2, Math.min(block.end, blocks[index + 1]?.start ?? block.end))
    const joined = block.lines.filter((line) => !/^foreign$/i.test(line))
    const fresh = rolling ? joined : [joined.join(' ')]
    for (const line of fresh) words.push(...wordsOfLine(line.replace(/\[[^\]]*\]/g, ' '), block.start, until, rolling).filter((word) => !MARKER.test(word.text)))
  }
  for (let index = 1; index < words.length; index++) if (words[index].at < words[index - 1].at) words[index].at = words[index - 1].at
  return words
}

/** A rough spoken length for a word, so a sentence can end when its last word does rather than at the next one. */
const spokenLength = (word: string) => Math.min(0.6, Math.max(0.2, 0.06 * word.length + 0.12))

/**
 * Short spoken lines for the shipped caption files: a break at every pause of half a second or more, at the end of a
 * sentence, or every 16 words. Each line ends when its last word does, so the gaps between lines are the real pauses.
 */
export function linesFromWords(words: Word[], talkEnd?: number): Cue[] {
  const lines: Cue[] = []
  let current: Word[] = []
  const flush = (nextAt?: number) => {
    if (!current.length) return
    const last = current[current.length - 1]
    const end = Math.min(last.at + spokenLength(last.text) + 0.1, nextAt ?? talkEnd ?? Infinity)
    lines.push({ start: current[0].at, end: Number.isFinite(end) ? end : last.at + 0.6, text: current.map((word) => word.text).join(' ') })
    current = []
  }
  for (const [index, word] of words.entries()) {
    const next = words[index + 1]
    current.push(word)
    const pause = next ? next.at - word.at - spokenLength(word.text) : Infinity
    const sentenceEnd = /[.?!]["”']?$/.test(word.text) && current.length >= 3
    if (sentenceEnd || pause >= 0.45 || current.length >= 16) flush(next?.at)
  }
  flush(talkEnd)
  return lines.map((line) => ({ ...line, end: Math.max(line.end, line.start + 0.3) }))
}

function vttStamp(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}

/** A plain WebVTT file of the lines, with no repeats, for the seed and the lesson's transcript field. */
export function cleanVtt(raw: string, note = '') {
  const lines = linesFromWords(wordTimeline(raw))
  const head = ['WEBVTT', ...(note ? ['', `NOTE ${note}`] : [])]
  return [...head, '', ...lines.map((line) => `${vttStamp(line.start)} --> ${vttStamp(line.end)}\n${line.text}\n`)].join('\n')
}

/** A talk's length from its captions: the last word's start plus 0.8 seconds, rounded up. */
export function talkSeconds(words: Word[]) {
  return words.length ? Math.ceil(words[words.length - 1].at + 0.8) : 0
}

export function lastSecond(cues: Cue[]) {
  return cues.length ? Math.ceil(Math.max(...cues.map((cue) => cue.end))) : 0
}

export type TimedLine = { at: number; text: string }

export type TierDraft = {
  hors: { start: number; end: number; quote: string }
  appetiser: { start: number; end: number }
  hook: string
  turn: string
  land: string
  /** When each line is said, so the appetiser can caption the hook, then the turn, then the land. */
  hookAt: number
  turnAt: number
  landAt: number
  /** The hors d'oeuvre's sentences with their times, for its captions. */
  horsLines: TimedLine[]
  popups: { second: number; quote: string; prompt: string }[]
  duration: number
  note: string
}

/** A clip opens this long before its first word and closes this long after its last, inside the silence around it. */
export const PRE_ROLL = 0.4
export const TAIL = 0.6
/** In captions without punctuation, a pause this long ends a sentence. */
export const SENTENCE_PAUSE = 0.7
const LONGEST_SENTENCE = 40

export type Spoken = { start: number; end: number; text: string; words: number; complete: boolean; capital: boolean }

/** Words spread through each cue at an ordinary speaking pace, for transcripts that only mark when a line starts. */
function wordsFromCues(cues: Cue[]): Word[] {
  const words: Word[] = []
  for (const [index, cue] of cues.entries()) {
    const tokens = cue.text.replace(/\*\*/g, '').split(/\s+/).filter(Boolean)
    if (!tokens.length) continue
    const next = cues[index + 1]?.start ?? cue.end
    const until = Math.max(cue.start + 0.3, Math.min(cue.end, next, cue.start + tokens.length / 2.6 + 0.3))
    tokens.forEach((text, at) => words.push({ at: cue.start + ((until - cue.start) * at) / tokens.length, text }))
  }
  for (let index = 1; index < words.length; index++) if (words[index].at < words[index - 1].at) words[index].at = words[index - 1].at
  return words
}

/** Every spoken word with its start, from a caption file, a timed transcript, or cues already parsed. */
export function wordsOf(source: string | Cue[]): Word[] {
  if (typeof source !== 'string') return wordsFromCues(source)
  if (source.includes('-->')) return wordTimeline(source)
  return wordsFromCues(parseTranscript(source).cues)
}

/** Words a spoken sentence does not end on. */
const TRAILING_WORD = /^(and|but|so|or|the|a|an|of|to|for|with|is|was|are|were|be|been|have|has|had|will|would|can|could|should|may|might|must|that|which|who|when|where|if|because|like|um|uh|in|on|at|by|from|into|about|than|as|just|really|very|not|my|your|his|her|their|our|its|it's|i'm|we're|you're|they're|this|these|those|i|we|you|he|she|they|what's|there's)[,]?$/i
const ends = (text: string) => /[.?!]["”')\]]*$/.test(text)

/**
 * Sentences from caption timing plus punctuation. Where the captions are punctuated, a sentence ends at its full
 * stop, question mark or exclamation mark (or at a pause of 1.5 seconds). Where they are not, it ends at a pause of
 * SENTENCE_PAUSE seconds. A run longer than 40 words is split at its longest pause.
 */
export function sentencesOf(source: string | Cue[]): Spoken[] {
  const words = wordsOf(source)
  if (!words.length) return []
  const punctuated = words.filter((word) => ends(word.text)).length >= words.length / 40
  const pauseAfter = (index: number) => (index + 1 < words.length ? words[index + 1].at - words[index].at - spokenLength(words[index].text) : Infinity)
  const runs: [number, number][] = []
  let from = 0
  for (let index = 0; index < words.length; index++) {
    const pause = pauseAfter(index)
    // Without punctuation, a pause after a word that leaves the thought hanging ("the", "and", "of") is a hesitation.
    const boundary = punctuated ? (ends(words[index].text) && index - from >= 1) || pause >= 1.5 : (pause >= SENTENCE_PAUSE && !TRAILING_WORD.test(words[index].text)) || pause >= 1.5
    if (boundary || index === words.length - 1) {
      runs.push([from, index])
      from = index + 1
    }
  }
  const split = (run: [number, number]): [number, number][] => {
    const [a, b] = run
    if (b - a + 1 <= LONGEST_SENTENCE) return [run]
    let best = a + Math.floor((b - a) / 2)
    let widest = -Infinity
    for (let index = a + 5; index <= b - 5; index++) {
      const pause = pauseAfter(index)
      if (pause > widest) {
        widest = pause
        best = index
      }
    }
    return [...split([a, best]), ...split([best + 1, b])]
  }
  return runs.flatMap(split).map(([a, b]) => {
    const last = words[b]
    const nextAt = words[b + 1]?.at ?? Infinity
    return {
      start: words[a].at,
      end: Math.min(last.at + spokenLength(last.text) + 0.1, nextAt),
      text: words
        .slice(a, b + 1)
        .map((word) => word.text)
        .join(' '),
      words: b - a + 1,
      complete: ends(last.text) || (pauseAfter(b) >= SENTENCE_PAUSE && !TRAILING_WORD.test(last.text)),
      capital: /^["“'(]?[A-Z]/.test(words[a].text),
    }
  })
}

const tenth = (value: number, way: 'down' | 'up') => (way === 'down' ? Math.floor(value * 10 + 1e-6) / 10 : Math.ceil(value * 10 - 1e-6) / 10)
const hundredth = (value: number) => Math.round(value * 100) / 100

/** The silence before sentence `index`, where a clip may open, and the silence after it, where a clip may close. */
export function gapBefore(sentences: Spoken[], index: number) {
  return { from: index > 0 ? sentences[index - 1].end : 0, to: sentences[index].start }
}
export function gapAfter(sentences: Spoken[], index: number, duration = Infinity) {
  return { from: sentences[index].end, to: index + 1 < sentences.length ? sentences[index + 1].start : duration }
}

/** True when `at` sits in the silence before a sentence starts (as an in point) or after one ends (as an out point). */
export function onSentenceBoundary(sentences: Spoken[], at: number, kind: 'in' | 'out', duration = Infinity, slack = 0.15) {
  return sentences.some((_, index) => {
    const gap = kind === 'in' ? gapBefore(sentences, index) : gapAfter(sentences, index, duration)
    return at >= gap.from - slack && at <= gap.to + slack
  })
}

const STOP = new Set(
  'the and that this with from your you are was were for have has had not but they them his her she its our out about into just like what when there then than been being would could should really very gonna going know mean means said says say okay yeah right uh um so all one can will get got because their thing things also some more who how why which over these those even make made want way'.split(' '),
)
const plainWords = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z'\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP.has(word))

const NOISE =
  /subscribe|description|donat|qr code|the link|thank you for watching|thanks for watching|watching our|patreon|sponsor|notification|comment below|like and share|launchgood|\bclick\b|follow us|website|download|e-?books?|\.org|\.com|our channel|our series|next episode|next video|see you (next|in the)|this video is|this episode is|brought to you|support (us|our|this)/i
const INTRO = /^(assalam|as-?salam|salaam|salam|bismillah|alhamdulillah,? wa|welcome (back|to|everyone)|hello (everyone|and welcome)|good (evening|morning)|testing)|music|applause|people are (still )?joining|apologi[sz]e for|wait a (moment|few|minute)|can (you|everyone) hear|before we (begin|start|get started)|let's (begin|get started)|housekeeping/i
/** Closing formulas: the salaam, the closing du'a and thanks. They end a talk; they are never its hook, turn or land. */
const OUTRO =
  /as-?salamu?\s?(a|')?lai?kum|salaam?u? ?alaikum|wa ?rahmatullah|rabb?il? ?'?a+l[ae]+mee?n|jazak(um|a)? ?allah|baraka? ?llahu? ?f[ie]+kum|subhanaka? ?llahumm?a|forgive (us|me) (if|for anything)|anything (wrong|incorrect)|until next time|i (also )?bear witness|any (more )?questions|asked a question|question and answer|q ?& ?a\b|see you (all )?(next|soon)|take care (everyone|all)|that's all (we have|for today)|(and )?may allah (forgive|accept|reward|bless|guide) (us|you|all)/i
const TURNING = /\b(but|however|rather|instead|actually|the problem|the question|isn't|is not|don't|do not|never|not just|not only|yet|until|the opposite|the reality|the truth|what if)\b/i
const TEACHING = /\b(allah|prophet|qur'?an|heart|dua|mercy|trust|patience|grateful|gratitude|prayer|forgive|soul|light|love|peace|anger|time|humility|purpose|akhira|dunya|iman|sabr|tawakkul|rabb|lord|death|jannah)\b/i
const GRIP = /\b(imagine|did you know|have you ever|the only|never|every single|the secret|the reason|what if|think about|here's the thing|the truth is|the problem is|the question is|the key|remember this|listen)\b/i
const CONNECTIVE = /^(and|but|so|or|because|cause|'cause|which|who|whom|that|then|like|uh|um|yeah|yes|no|okay|ok|right|of|to|for|with|is|was|are|were|in|on|at|as|if|than|also|plus|even)\b/i
const PRONOUN = /^(he|she|it|they|him|them|his|her|its|their|this|these|those|there)\b/i
const OPENER_WORD = /^(i|we|you|now|the|allah|what|when|if|imagine|there's|this is|my|our|one|every|how|why|do|did|have|let|look|think|listen|remember|brothers|sisters|people|whoever|whatever|sometimes|never|always)\b/i
const DANGLING = /\b(and|but|so|or|the|a|an|of|to|for|with|is|was|are|were|be|been|have|has|had|will|would|can|could|should|may|might|must|shall|that|which|who|what|when|where|if|because|like|um|uh|in|on|at|by|from|into|about|than|as|just|really|very|not|my|your|his|her|their|our|its|it's|i'm|we're|you're|they're|this|these|those)[,]?$/i

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function noisy(sentence: Spoken) {
  return NOISE.test(sentence.text) || OUTRO.test(sentence.text)
}

/**
 * Line mode, sentence by sentence. Every boundary is a sentence boundary with a small pre-roll and tail inside the
 * silence around it. The hors d'oeuvre is the most gripping self-contained 15 to 20 seconds in the talk. The
 * appetiser opens on a strong hook, passes a real turn (a later sentence that shifts the thought, not the next few
 * seconds of the hook) and ends when its land sentence ends. Greetings, sponsor and outro lines are left out.
 */
export function draftTiers(source: string | Cue[], durationHint?: number | null): TierDraft | null {
  const all = sentencesOf(source)
  if (all.filter((sentence) => sentence.words >= 3).length < 3) return null
  const spokenEnd = all[all.length - 1].end
  const duration = Math.max(durationHint || 0, Math.ceil(spokenEnd))
  const usableCount = all.filter((sentence) => sentence.words >= 3).length
  const counts = new Map<string, number>()
  for (const sentence of all) for (const word of new Set(plainWords(sentence.text))) counts.set(word, (counts.get(word) || 0) + 1)
  const planted = new Set([...counts.entries()].filter(([, count]) => count >= Math.max(3, Math.round(usableCount / 60))).map(([word]) => word))
  // An outro starts at the first sponsor, giving or channel line in the last stretch; nothing after it is used.
  const outroFrom = all.findIndex((sentence) => sentence.start > Math.min(spokenEnd * 0.8, spokenEnd - 20) && noisy(sentence))
  const lastUsable = outroFrom === -1 ? all.length - 1 : outroFrom - 1
  const firstUsable = Math.max(0, all.findIndex((sentence) => !INTRO.test(sentence.text) && !noisy(sentence) && sentence.words >= 3))
  const blocked = (index: number) => index < firstUsable || index > lastUsable || noisy(all[index]) || INTRO.test(all[index].text)

  const lineScore = (index: number) => {
    const sentence = all[index]
    if (blocked(index)) return -20
    const text = sentence.text
    let total = Math.min(3, plainWords(text).filter((word) => planted.has(word)).length) * 2
    if (TEACHING.test(text)) total += 2
    if (sentence.words >= 7 && sentence.words <= 28) total += 2
    else if (sentence.words < 5) total -= 3
    else if (sentence.words > 36) total -= 2
    if (/\b(you|your)\b/i.test(text)) total += 1
    total -= (text.match(/\b(uh|um|erm|you know|i mean)\b/gi) || []).length
    if (killListHits(text).length) total -= 1
    if (sentence.end > spokenEnd * 0.96) total -= 4
    if (spokenEnd > 300 && sentence.start < Math.min(90, spokenEnd * 0.04)) total -= 3
    return total
  }
  // Punctuated captions capitalise the start of a real sentence, so a lower-case start there is a mid-sentence piece.
  const cased = all.filter((sentence) => sentence.capital).length >= all.length / 3
  const pauseBefore = (index: number) => (index > 0 ? all[index].start - all[index - 1].end : 3)
  const pauseAfterSentence = (index: number) => (index + 1 < all.length ? all[index + 1].start - all[index].end : 3)
  // Without punctuation, a long pause and a previous line that does not trail off are the best signs a sentence starts.
  const opens = (index: number) => !CONNECTIVE.test(all[index].text) && !PRONOUN.test(all[index].text) && (index === 0 || !DANGLING.test(all[index - 1].text)) && (!cased || all[index].capital)
  const startStrength = (index: number) => Math.min(3, pauseBefore(index) * 2) + (index > 0 && DANGLING.test(all[index - 1].text) ? -4 : 0) + (OPENER_WORD.test(all[index].text) ? 1 : 0)
  const endStrength = (index: number) => Math.min(3, pauseAfterSentence(index) * 2) + (index + 1 < all.length && CONNECTIVE.test(all[index + 1].text) && pauseAfterSentence(index) < 1 ? -2 : 0)
  const hookScore = (index: number) => {
    const text = all[index].text
    let total = lineScore(index)
    if (/\?["”']?$/.test(text) || /^(what|why|how|did you|have you|do you|is it|are you|can you|who)\b/i.test(text)) total += 3
    if (GRIP.test(text)) total += 2
    total += opens(index) ? 1 : CONNECTIVE.test(text) ? -6 : -3
    if (DANGLING.test(text)) total -= 4
    return total + startStrength(index)
  }
  const closes = (index: number) => all[index].complete && !DANGLING.test(all[index].text) && (index + 1 >= all.length || !/^(of|to|the|a|an|and|is|was|that|which)\b/i.test(all[index + 1].text))
  const scores = all.map((_, index) => lineScore(index))

  /** In and out points for sentences a..b with the pre-roll and tail, fitted to [min, max] seconds where possible. */
  const fit = (a: number, b: number, min: number, max: number) => {
    const before = gapBefore(all, a)
    const after = gapAfter(all, b, duration)
    const inLatest = before.to - 0.1
    const inEarliest = Math.max(before.from, before.to - 1.5, 0)
    const outEarliest = after.from + 0.2
    const outLatest = Math.min(after.to, after.from + 2.5, duration)
    let start = Math.max(inEarliest, before.to - PRE_ROLL)
    let end = Math.min(outLatest, Math.max(outEarliest, after.from + TAIL))
    if (end - start < min) end = Math.min(outLatest, start + min)
    if (end - start < min) start = Math.max(inEarliest, end - min)
    if (end - start > max) end = Math.max(outEarliest, start + max)
    if (end - start > max) start = Math.min(inLatest, end - max)
    start = hundredth(Math.max(start, inEarliest))
    end = hundredth(Math.min(end, outLatest))
    const length = end - start
    return length >= min - 1e-6 && length <= max + 1e-6 && start <= before.to + 0.01 && end >= after.from - 0.01 ? { start, end } : null
  }

  // Hors d'oeuvre: the best window of whole sentences that fits 15 to 20 seconds.
  type Window = { a: number; b: number; start: number; end: number; score: number }
  // A window that starts cleanly after a pause and ends on a finished sentence wins over any that does not.
  const bestHors = (skip?: number): Window | null => {
    let strictBest: Window | null = null
    let loose: Window | null = null
    for (let a = firstUsable; a <= lastUsable; a++) {
      if (blocked(a) || all[a].words < 5) continue
      for (let b = a; b <= lastUsable; b++) {
        if (blocked(b) || b === skip) break
        if (all[b].end - all[a].start > HORS_MAX + 0.5) break
        const window = fit(a, b, HORS_MIN, HORS_MAX)
        if (!window) continue
        const inside = scores.slice(a, b + 1)
        const score = hookScore(a) * 1.5 + inside.reduce((sum, value) => sum + value, 0) / inside.length + (closes(b) ? 3 : -4) + endStrength(b) + (b - a > 4 ? -1 : 0)
        const strict = opens(a) && pauseBefore(a) >= (cased ? 0.3 : SENTENCE_PAUSE - 0.05) && closes(b)
        if (strict && (!strictBest || score > strictBest.score)) strictBest = { a, b, ...window, score }
        if (!loose || score > loose.score) loose = { a, b, ...window, score }
      }
    }
    return strictBest || loose
  }
  let hors = bestHors()
  if (!hors) return null

  // Appetiser: a hook, a turn and a land inside about 3 minutes, all on sentence boundaries.
  type Pick = { hook: number; turn: number; land: number; start: number; end: number; score: number }
  let pick: Pick | null = null
  let loosePick: Pick | null = null
  const landScore = (index: number) => scores[index] + (closes(index) ? 3 : -6) + endStrength(index) + (TEACHING.test(all[index].text) ? 1 : 0) + (opens(index) ? 2 : CONNECTIVE.test(all[index].text) ? -2 : -3)
  const turnValue = (index: number) => scores[index] + (TURNING.test(all[index].text) ? 4 : 0) + (opens(index) || /^but\b/i.test(all[index].text) ? 2 : -3) + (DANGLING.test(all[index].text) ? -3 : 0)
  // A turn that only says the hook again is no turn.
  const echoes = (a: number, b: number) => {
    const x = new Set(plainWords(all[a].text))
    const y = plainWords(all[b].text)
    return y.length > 0 && y.filter((word) => x.has(word)).length / y.length >= 0.6
  }
  if (spokenEnd < 120) {
    // A short talk is nearly all appetiser: the hook is the best opening in its first half, the land the last finished
    // thought, and the turn sits well clear of the hook, at least a quarter of the talk (up to 15 seconds) later.
    const usable = all.map((_, index) => index).filter((index) => !blocked(index))
    const early = usable.filter((index) => all[index].start <= spokenEnd / 2 && all[index].words >= 4)
    const hook = [...early].sort((x, y) => hookScore(y) + (opens(y) && !DANGLING.test(all[y].text) ? 3 : 0) - (hookScore(x) + (opens(x) && !DANGLING.test(all[x].text) ? 3 : 0)) || x - y)[0] ?? usable[0]
    const land = [...usable].reverse().find((index) => closes(index) && index > hook) ?? usable[usable.length - 1]
    const gap = Math.min(15, spokenEnd * 0.25)
    const middle = usable.filter((index) => index > hook + 1 && index < land && all[index].start - all[hook].start >= gap && all[index].words >= 4 && !echoes(hook, index))
    const turn = middle.sort((x, y) => turnValue(y) - turnValue(x))[0] ?? usable.find((index) => index > hook && index < land && all[index].start - all[hook].start >= gap) ?? Math.min(land, hook + 1)
    const window = fit(hook, land, 1, APPETISER_MAX)
    if (window) pick = { hook, turn, land, ...window, score: 0 }
  } else {
    const lands = all
      .map((_, index) => index)
      .filter((index) => !blocked(index) && all[index].words >= 6 && all[index].start >= Math.min(45, spokenEnd * 0.1))
      .sort((x, y) => landScore(y) - landScore(x))
      .slice(0, 30)
    for (const land of lands) {
      for (let hook = land - 2; hook >= firstUsable; hook--) {
        if (all[land].end - all[hook].start > APPETISER_MAX - 2) break
        if (blocked(hook) || all[hook].words < 4 || all[land].start - all[hook].start < 45) continue
        const window = fit(hook, land, 1, APPETISER_MAX)
        if (!window) continue
        let turn = -1
        let turnBest = -Infinity
        for (let index = hook + 2; index < land; index++) {
          if (blocked(index) || all[index].words < 5 || echoes(hook, index)) continue
          if (all[index].start - all[hook].start < 20 || all[land].start - all[index].end < 8) continue
          const value = turnValue(index)
          if (value > turnBest) {
            turnBest = value
            turn = index
          }
        }
        if (turn === -1) continue
        const length = window.end - window.start
        const score = landScore(land) * 1.2 + hookScore(hook) * 1.5 + turnBest + (length >= 90 ? 2 : 0) - (all.slice(hook, land + 1).some((sentence) => noisy(sentence)) ? 30 : 0)
        const strict = opens(hook) && !DANGLING.test(all[hook].text) && closes(land)
        if (strict && (!pick || score > pick.score)) pick = { hook, turn, land, ...window, score }
        if (!loosePick || score > loosePick.score) loosePick = { hook, turn, land, ...window, score }
      }
    }
    pick ||= loosePick
  }
  if (!pick) {
    const window = fit(hors.a, hors.b, 1, APPETISER_MAX)!
    pick = { hook: hors.a, turn: Math.min(hors.b, hors.a + 1), land: hors.b, ...window, score: 0 }
  }

  // The hors is its own moment: when the appetiser's land falls inside it, the next best window without the land is used.
  if (pick.land >= hors.a && pick.land <= hors.b) hors = bestHors(pick.land) || hors
  const chosen = pick
  const popups: TierDraft['popups'] = []
  const popupSecond = (index: number) => Math.min(Math.ceil(all[index].end), Math.max(0, duration - 1))
  const addPopup = (index: number) => {
    const quote = capitalise(all[index].text)
    popups.push({ second: popupSecond(index), quote, prompt: `The speaker says: “${quote}” What does that line ask of you this week?` })
  }
  const popupOk = (index: number) => scores[index] > 0 && all[index].words >= 7 && all[index].words <= 40 && closes(index) && !killListHits(all[index].text).length && !noisy(all[index])
  const ranked = all.map((_, index) => index).sort((x, y) => scores[y] - scores[x] || all[x].start - all[y].start)
  const thirds = [0, 1, 2].map((part) => [duration * (part / 3), duration * ((part + 1) / 3)])
  for (const [from, to] of thirds) {
    const found = ranked.find(
      (index) =>
        popupOk(index) &&
        all[index].start >= from &&
        all[index].end <= to &&
        (all[index].end < chosen.start || all[index].start > chosen.end) &&
        !popups.some((other) => Math.abs(other.second - popupSecond(index)) < 60),
    )
    if (found !== undefined) addPopup(found)
  }
  // Short talks are mostly appetiser; the main still plays them whole, so a pop-up may sit inside that stretch.
  for (const index of ranked) {
    if (popups.length >= 2) break
    const gap = Math.max(12, duration / 6)
    if (popupOk(index) && !popups.some((other) => Math.abs(other.second - popupSecond(index)) < gap)) addPopup(index)
  }
  for (const index of ranked) {
    if (popups.length >= 2) break
    if (scores[index] > -5 && all[index].words >= 5 && !DANGLING.test(all[index].text) && !killListHits(all[index].text).length && !noisy(all[index]) && !popups.some((other) => Math.abs(other.second - popupSecond(index)) < 8)) addPopup(index)
  }
  for (const index of ranked) {
    if (popups.length >= 2) break
    if (!blocked(index) && all[index].words >= 5 && !killListHits(all[index].text).length && !popups.some((other) => Math.abs(other.second - popupSecond(index)) < 8)) addPopup(index)
  }
  popups.sort((a, b) => a.second - b.second)
  const horsLines = all.slice(hors.a, hors.b + 1).map((sentence) => ({ at: tenth(sentence.start, 'down'), text: capitalise(sentence.text) }))
  return {
    hors: { start: hors.start, end: hors.end, quote: capitalise(all.slice(hors.a, hors.b + 1).map((sentence) => sentence.text).join(' ')) },
    appetiser: { start: pick.start, end: pick.end },
    hook: capitalise(all[pick.hook].text),
    turn: capitalise(all[pick.turn].text),
    land: capitalise(all[pick.land].text),
    hookAt: tenth(all[pick.hook].start, 'down'),
    turnAt: tenth(all[pick.turn].start, 'down'),
    landAt: tenth(all[pick.land].start, 'down'),
    horsLines,
    popups: popups.slice(0, 3),
    duration,
    note: `${DRAFT_NOTE} Appetiser ${formatTimestamp(pick.start)} to ${formatTimestamp(pick.end)}.`,
  }
}

/**
 * Caption timings for a tier a person has edited: the hors d'oeuvre's sentences between its in and out points, and
 * when the hook, turn and land are said inside the appetiser (found by their words, or spread through it if not).
 */
export function tierTimings(source: string | Cue[], tier: { horsStart: number; horsEnd: number; appetiserStart: number; appetiserEnd: number; hook?: string; turn?: string; land?: string }) {
  const all = sentencesOf(source)
  const key = (text: string) => text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
  const inside = (from: number, to: number) => all.filter((sentence) => sentence.start >= from - 0.2 && sentence.start < to)
  const horsLines = inside(tier.horsStart, tier.horsEnd).map((sentence) => ({ at: tenth(sentence.start, 'down'), text: capitalise(sentence.text) }))
  const span = inside(tier.appetiserStart, tier.appetiserEnd)
  const find = (text: string | undefined, fallback: number) => {
    const wanted = key(text || '')
    if (!wanted) return fallback
    const head = wanted.split(' ').slice(0, 6).join(' ')
    const hit = span.find((sentence) => key(sentence.text).includes(head) || wanted.includes(key(sentence.text).split(' ').slice(0, 6).join(' ')))
    return hit ? tenth(hit.start, 'down') : fallback
  }
  const length = tier.appetiserEnd - tier.appetiserStart
  const hookAt = find(tier.hook, tier.appetiserStart)
  const landAt = find(tier.land, tier.appetiserStart + length * 0.75)
  const turnAt = find(tier.turn, tier.appetiserStart + length * 0.4)
  return { horsLines, hookAt, turnAt: Math.max(hookAt, Math.min(turnAt, landAt)), landAt: Math.max(hookAt, landAt) }
}

const plainKey = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** True when `line` is the speaker's words in order, ignoring case and punctuation. */
export function saidInTalk(line: string, source: string | Cue[]) {
  const wanted = plainKey(line)
  if (!wanted) return true
  return ` ${plainKey(wordsOf(source).map((word) => word.text).join(' '))} `.includes(` ${wanted} `)
}

const matchWord = (word: string) => word.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '')

/**
 * A transcript whose `**[m:ss]**` marks were estimated gets real times from the talk's captions: each line is found
 * in the caption words by its opening words, and lines that cannot be found are placed between their neighbours.
 */
export function alignToCaptions(marked: string, captions: string) {
  const words = wordTimeline(captions).map((word) => ({ at: word.at, key: matchWord(word.text) })).filter((word) => word.key)
  const pattern = /\*\*\[(\d{1,2}:\d{2}(?::\d{2})?)\]\*\*/g
  const marks = [...marked.matchAll(pattern)]
  if (!marks.length || !words.length) return { text: marked, matched: 0, total: marks.length }
  const found: (number | null)[] = []
  let cursor = 0
  for (const [index, mark] of marks.entries()) {
    const from = mark.index! + mark[0].length
    const to = marks[index + 1]?.index ?? marked.length
    const opening = marked.slice(from, to).split(/\s+/).map(matchWord).filter(Boolean).slice(0, 6)
    let hit: number | null = null
    if (opening.length >= 3) {
      const limit = Math.min(words.length - opening.length, cursor + 1500)
      for (let at = cursor; at <= limit; at++) {
        let same = 0
        for (let k = 0; k < opening.length; k++) if (words[at + k]?.key === opening[k]) same += 1
        if (same >= Math.max(3, opening.length - 1)) {
          hit = at
          break
        }
      }
    }
    found.push(hit === null ? null : words[hit].at)
    if (hit !== null) cursor = hit + 1
  }
  const times = found.map((value, index) => {
    if (value !== null) return value
    const before = found.slice(0, index).reverse().find((item) => item !== null) ?? 0
    const after = found.slice(index + 1).find((item) => item !== null) ?? words[words.length - 1].at
    return before + (after - before) / 2
  })
  for (let index = 1; index < times.length; index++) times[index] = Math.max(times[index], times[index - 1])
  let position = 0
  const text = marked.replace(pattern, () => `**[${formatTimestamp(Math.floor(times[position++]))}]**`)
  return { text, matched: found.filter((value) => value !== null).length, total: marks.length }
}

/** The shape rules for a tier record, in plain English, or null when it holds. */
export function tierProblem(tier: Record<string, unknown>) {
  const num = (key: string) => Number(tier[key])
  const [hs, he, as, ae] = [num('horsStart'), num('horsEnd'), num('appetiserStart'), num('appetiserEnd')]
  if ([hs, he, as, ae].some((value) => !Number.isFinite(value) || value < 0)) return 'Every in and out point needs a time of 0 seconds or more.'
  if (he - hs < HORS_MIN || he - hs > HORS_MAX) return `The hors d'oeuvre runs ${Math.round(he - hs)} seconds. Keep it between ${HORS_MIN} and ${HORS_MAX}.`
  if (ae <= as) return 'The appetiser has to end after it starts.'
  if (ae - as > APPETISER_MAX + 15) return `The appetiser runs ${formatTimestamp(ae - as)}. Keep it to about 3 minutes.`
  return null
}

/** Which timed caption is showing at `time`: the last line already said (the first until then). */
export function captionIndex(lines: { at: number }[] | undefined, time: number) {
  if (!lines?.length) return 0
  let at = 0
  lines.forEach((line, index) => {
    if (time >= line.at - 0.15) at = index
  })
  return at
}

/** How many words of one beat sit on a single caption card. A longer beat turns the page. */
export const CAPTION_PAGE = 22

/**
 * The words of the current beat that belong on the card at `time`.
 * A beat of more than {@link CAPTION_PAGE} words is split into consecutive cards
 * across the beat, so the caption never holds the whole paragraph at once.
 */
export function captionPage(text: string, at: number, until: number, time: number, size = CAPTION_PAGE) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= size) return { index: 0, pages: 1, text: words.join(' ') }
  const pages = Math.ceil(words.length / size)
  const span = Math.max(0.4, until - at)
  const into = Math.min(0.999, Math.max(0, (time - at) / span))
  const index = Math.min(pages - 1, Math.floor(into * pages))
  return { index, pages, text: words.slice(index * size, (index + 1) * size).join(' ') }
}

/** Where the appetiser player stops: its out point, never more than about 3 minutes after its in point. */
export function appetiserStop(appetiser: { start: number; end: number }) {
  const longest = appetiser.start + APPETISER_MAX + 15
  return appetiser.end > appetiser.start ? Math.min(appetiser.end, longest) : appetiser.start + APPETISER_MAX
}

export type TimingRow = { label: string; start: number; end?: number | null }

/** Things that fall outside the talk: a cut, pop-up or tier that starts or ends after the real duration. */
export function timingProblems(duration: number | null | undefined, rows: TimingRow[]) {
  if (!duration || duration <= 0) return rows.length ? [`No duration is known, so ${rows.length} timed item(s) cannot be checked.`] : []
  const problems: string[] = []
  for (const row of rows) {
    const end = row.end ?? row.start
    if (row.start < 0 || row.start > duration) problems.push(`${row.label} starts at ${formatTimestamp(row.start)}, outside the ${formatTimestamp(duration)} talk.`)
    else if (end > duration + 1) problems.push(`${row.label} ends at ${formatTimestamp(end)}, after the ${formatTimestamp(duration)} talk.`)
    else if (end < row.start) problems.push(`${row.label} ends before it starts.`)
  }
  return problems
}
