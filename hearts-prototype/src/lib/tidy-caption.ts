/**
 * Turns a YouTube auto-caption line into a line a learner can read: sentence case, punctuation,
 * and the capitals this app always uses (Allah, the Prophet, Qur'an, hadith collections, names of
 * Allah, the Day of Judgement, the speaker, and "I"). British spelling.
 *
 * The raw caption is kept beside the tidied line. Timing stays on the raw line's `at`.
 * Running this twice on the same words returns the same line.
 */

export const TIDY_VERSION = 1

export type TidySource = 'ai' | 'fallback'

export type TidyLine = { raw: string; text: string; at?: number; role?: string }

export type LineTidy = {
  version: number
  source: TidySource
  quote: TidyLine
  hook: TidyLine
  turn: TidyLine
  land: TidyLine
  horsLines: TidyLine[]
}

export type TidyHints = { speakers?: string[] }

const BRITISH: [RegExp, string][] = [
  [/\bjudgment\b/gi, 'judgement'],
  [/\bjudgments\b/gi, 'judgements'],
  [/\bcolor\b/gi, 'colour'],
  [/\bcolors\b/gi, 'colours'],
  [/\bfavorite\b/gi, 'favourite'],
  [/\bfavorites\b/gi, 'favourites'],
  [/\bhonor\b/gi, 'honour'],
  [/\bhonors\b/gi, 'honours'],
  [/\bbehavior\b/gi, 'behaviour'],
  [/\bbehaviors\b/gi, 'behaviours'],
  [/\bcenter\b/gi, 'centre'],
  [/\bcenters\b/gi, 'centres'],
  [/\brecognizes\b/gi, 'recognises'],
  [/\brecognized\b/gi, 'recognised'],
  [/\brecognize\b/gi, 'recognise'],
  [/\brealizes\b/gi, 'realises'],
  [/\brealized\b/gi, 'realised'],
  [/\brealize\b/gi, 'realise'],
  [/\bdefense\b/gi, 'defence'],
  [/\boffense\b/gi, 'offence'],
  [/\btraveled\b/gi, 'travelled'],
  [/\btraveling\b/gi, 'travelling'],
  [/\bmodeling\b/gi, 'modelling'],
  [/\bgray\b/gi, 'grey'],
]

/** Longer phrases first, so "day of judgement" is not left half-done. */
const PHRASES: [RegExp, string][] = [
  [/\bday of (?:judgement|judgment)\b/gi, 'Day of Judgement'],
  [/\bthe last day\b/gi, 'the Last Day'],
  [/\bday of resurrection\b/gi, 'Day of Resurrection'],
  [/\bhadith jibril\b/gi, 'Hadith Jibril'],
  [/\bsahih al-bukhari\b/gi, 'Sahih al-Bukhari'],
  [/\bsahih muslim\b/gi, 'Sahih Muslim'],
  [/\briyad as-salihin\b/gi, 'Riyad as-Salihin'],
  [/\bal-ghuniyya\b/gi, 'al-Ghuniyya'],
  [/\bal-ghunya\b/gi, 'al-Ghunya'],
  [/\babu dawud\b/gi, 'Abu Dawud'],
  [/\bibn majah\b/gi, 'Ibn Majah'],
  [/\bthe prophet\b/gi, 'the Prophet'],
  [/\bqur['’]?an\b/gi, "Qur'an"],
  [/\bkoran\b/gi, "Qur'an"],
  [/\bbukhari\b/gi, 'Bukhari'],
  [/\bmuslim\b/gi, 'Muslim'],
  [/\btirmidhi\b/gi, 'Tirmidhi'],
  [/\bnasa['’]?i\b/gi, "Nasa'i"],
  [/\bmuwatta\b/gi, 'Muwatta'],
]

/** Names of Allah as captions usually spell them, mapped to the form we show. */
const DIVINE: [RegExp, string][] = [
  [/\bar[\s-]*rabb\b/gi, 'Ar-Rabb'],
  [/\bar[\s-]*rahman\b/gi, 'Ar-Rahman'],
  [/\bar[\s-]*rahim\b/gi, 'Ar-Rahim'],
  [/\bar[\s-]*razzaq\b/gi, 'Ar-Razzaq'],
  [/\bar[\s-]*ra['’]?uf\b/gi, "Ar-Ra'uf"],
  [/\bal[\s-]*nur\b/gi, 'Al-Nur'],
  [/\bal[\s-]*noor\b/gi, 'Al-Nur'],
  [/\ban[\s-]*nur\b/gi, 'An-Nur'],
  [/\bal[\s-]*malik\b/gi, 'Al-Malik'],
  [/\bal[\s-]*quddus\b/gi, 'Al-Quddus'],
  [/\bas[\s-]*salam\b/gi, 'As-Salam'],
  [/\bal[\s-]*aziz\b/gi, 'Al-Aziz'],
  [/\bal[\s-]*ghaffar\b/gi, 'Al-Ghaffar'],
  [/\bal[\s-]*ghafur\b/gi, 'Al-Ghafur'],
  [/\bal[\s-]*latif\b/gi, 'Al-Latif'],
  [/\bal[\s-]*hakim\b/gi, 'Al-Hakim'],
  [/\bal[\s-]*wadud\b/gi, 'Al-Wadud'],
  [/\bal[\s-]*haqq\b/gi, 'Al-Haqq'],
  [/\bal[\s-]*wakil\b/gi, 'Al-Wakil'],
  [/\bal[\s-]*wali\b/gi, 'Al-Wali'],
  [/\bal[\s-]*hayy\b/gi, 'Al-Hayy'],
  [/\bal[\s-]*qayyum\b/gi, 'Al-Qayyum'],
  [/\bal[\s-]*ahad\b/gi, 'Al-Ahad'],
  [/\bas[\s-]*samad\b/gi, 'As-Samad'],
  [/\bal[\s-]*badi\b/gi, "Al-Badi'"],
  [/\ballah\b/gi, 'Allah'],
]

const QUESTION = /^(who|what|when|where|why|how|did|do|does|is|are|was|were|can|could|would|should|have you|has|will|won't|don't|didn't)\b/i

const WORDS = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

const ECHO = /^(it|he|she|i|we|you|him|her|them|me|us)$/

/**
 * True when the tidied line is the same words, only with capitals and punctuation.
 * Splitting a run-on ("return it doesn't") may repeat the object pronoun once.
 */
export function tidyKeepsWords(raw: string, tidy: string) {
  const source = WORDS(raw)
  const extra = WORDS(tidy)
  if (source.join(' ') === extra.join(' ')) return true
  for (const word of source) {
    const at = extra.indexOf(word)
    if (at === -1) return false
    extra.splice(at, 1)
  }
  return extra.length > 0 && extra.length <= 2 && extra.every((word) => ECHO.test(word))
}

function applyAll(text: string, pairs: [RegExp, string][]) {
  let next = text
  for (const [pattern, replacement] of pairs) next = next.replace(pattern, replacement)
  return next
}

function sentenceCase(text: string) {
  const lower = text.replace(/([.?!]\s+)([a-z])/g, (_, gap: string, letter: string) => gap + letter.toUpperCase())
  return lower.replace(/^([^a-zA-Z]*)([a-z])/, (_, lead: string, letter: string) => lead + letter.toUpperCase())
}

function capitalI(text: string) {
  return text.replace(/\bi(?=['’](?:m|ve|ll|d)\b|\b)/g, 'I')
}

function speakerPattern(name: string) {
  const parts = name
    .replace(/^(shaykh|sheikh|imam|ustadh|dr)\.?\s+/i, '')
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z'-]/g, ''))
    .filter((part) => part.length > 2)
  if (!parts.length) return null
  const body = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
  return new RegExp(`\\b${body}\\b`, 'gi')
}

function splitClauses(text: string) {
  // "return it doesn't return" is two sentences sharing the object: "Return it. It doesn't return".
  return text.replace(
    /\b(\w{3,})\s+(it|him|her|them|me|us)\s+(doesn['’]t|does|isn['’]t|is|was|were|will|won['’]t|can['’]t|cannot|don['’]t|didn['’]t|did|has|had)\b/gi,
    (_, verb: string, object: string, next: string) => `${verb} ${object}. ${object[0].toUpperCase()}${object.slice(1)} ${next}`,
  )
}

function vocative(text: string) {
  return text.replace(/\b(you|me|us|him)\s+allah\b/gi, (_, who: string) => `${who}, Allah`)
}

function finish(text: string) {
  const trimmed = text.replace(/[\s,;:]+$/g, '')
  if (/[.?!]["”']?$/.test(trimmed)) return trimmed
  return `${trimmed}${QUESTION.test(trimmed) ? '?' : '.'}`
}

/** The deterministic tidy. Used on its own, and whenever a model is absent or wanders off the words. */
export function tidyCaption(raw: string, hints: TidyHints = {}): string {
  const cleaned = raw
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  let text = applyAll(cleaned, BRITISH)
  text = splitClauses(text)
  text = vocative(text)
  text = finish(text)
  text = sentenceCase(text)
  text = capitalI(text)
  text = applyAll(text, PHRASES)
  text = applyAll(text, DIVINE)
  for (const name of hints.speakers || []) {
    const pattern = speakerPattern(name)
    if (!pattern) continue
    const shown = name.replace(/^(shaykh|sheikh|imam|ustadh|dr)\.?\s+/i, '').trim()
    text = text.replace(pattern, shown)
  }
  text = sentenceCase(text)
  return text.replace(/\s+/g, ' ').trim()
}

/** One strong line: the tidied sentence, cut at a word boundary when it runs past `maxWords`. */
export function shortLine(raw: string, maxWords = 18, hints: TidyHints = {}) {
  return clipWords(tidyCaption(raw, hints), maxWords)
}

/** Keeps a line that is already tidy, and stops it at a word when it runs past `maxWords`. */
export function clipWords(text: string, maxWords = 18) {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text.trim()
  let cut = words.slice(0, maxWords).join(' ').replace(/[,:;–—-]+$/g, '')
  if (!/[.?!]$/.test(cut)) cut = `${cut}.`
  return cut
}

export type CaptionSources = {
  speaker?: string
  quote: string
  hook: string
  turn: string
  land: string
  horsLines: { at: number; text: string }[]
}

function lineOf(raw: string, role: string, at: number | undefined, hints: TidyHints, chosen?: string): TidyLine {
  const text = chosen && tidyKeepsWords(raw, chosen) ? chosen.trim() : tidyCaption(raw, hints)
  return { raw, text, ...(at !== undefined ? { at } : {}), role }
}

/** Builds the stored tidy from the raw captions. `chosen` may supply a model's line when it keeps the words. */
export function buildLineTidy(sources: CaptionSources, chosen: TidyLine[] = [], source: TidySource = 'fallback'): LineTidy {
  const hints = { speakers: sources.speaker ? [sources.speaker] : [] }
  const pick = (raw: string, role: string) => chosen.find((line) => line.role === role && line.raw === raw && tidyKeepsWords(raw, line.text))?.text
  return {
    version: TIDY_VERSION,
    source,
    quote: lineOf(sources.quote, 'quote', undefined, hints, pick(sources.quote, 'quote')),
    hook: lineOf(sources.hook, 'hook', undefined, hints, pick(sources.hook, 'hook')),
    turn: lineOf(sources.turn, 'turn', undefined, hints, pick(sources.turn, 'turn')),
    land: lineOf(sources.land, 'land', undefined, hints, pick(sources.land, 'land')),
    horsLines: sources.horsLines.map((line) => {
      const match = chosen.find((item) => item.role === 'hors' && item.raw === line.text && tidyKeepsWords(line.text, item.text))
      return lineOf(line.text, 'hors', line.at, hints, match?.text)
    }),
  }
}

function rawsOf(stored: LineTidy) {
  return [stored.quote.raw, stored.hook.raw, stored.turn.raw, stored.land.raw, ...stored.horsLines.map((line) => `${line.at}:${line.raw}`)].join('\n')
}

/** Skip a row whose raw captions and tidy version are already stored. A fallback is redone once a model key is available. */
export function tidyUnchanged(stored: LineTidy | null | undefined, sources: CaptionSources, aiAvailable: boolean) {
  if (!stored || stored.version !== TIDY_VERSION) return false
  const fresh = buildLineTidy(sources)
  if (rawsOf(stored) !== rawsOf(fresh)) return false
  if (stored.source === 'ai') return stored.horsLines.every((line, index) => line.text === stored.horsLines[index]?.text) && Boolean(stored.quote.text)
  if (aiAvailable) return false
  return (
    stored.quote.text === fresh.quote.text &&
    stored.hook.text === fresh.hook.text &&
    stored.turn.text === fresh.turn.text &&
    stored.land.text === fresh.land.text &&
    stored.horsLines.length === fresh.horsLines.length &&
    stored.horsLines.every((line, index) => line.text === fresh.horsLines[index]?.text && line.at === fresh.horsLines[index]?.at)
  )
}

/** The line to show. A stored tidy wins when it still belongs to this raw caption and keeps the words. */
export function displayLine(raw: string, stored: { raw?: string; text?: string } | null | undefined, hints: TidyHints = {}) {
  if (stored && stored.raw === raw && stored.text && tidyKeepsWords(raw, stored.text)) return stored.text
  return tidyCaption(raw, hints)
}

/**
 * The feed caption. `tidy:lines` stores the learner-facing line on `lineTidy`.
 * Use that text when it is there, including when the raw caption has drifted and an index match is all we have.
 */
export function feedTidy(
  raw: string,
  stored: { raw?: string; text?: string } | null | undefined,
  byIndex: { text?: string } | null | undefined,
  hints: TidyHints = {},
) {
  if (stored?.text && stored.raw === raw) return stored.text.trim()
  const indexed = byIndex?.text?.trim()
  if (indexed) return indexed
  return tidyCaption(raw, hints)
}

export function parseLineTidy(value: unknown): LineTidy | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<LineTidy>
  if (!row.quote || !row.hook || !row.turn || !row.land || !Array.isArray(row.horsLines)) return null
  return row as LineTidy
}
