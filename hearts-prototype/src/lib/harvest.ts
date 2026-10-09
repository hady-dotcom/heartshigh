import { matchQuran, surahLabel, type QuranIndex, type QuranMatch } from './quran-match'
import { ASIDE, endsDangling, finishedSentences, wholeSentences, wordSlice } from './sentences'
import { formatTimestamp, isVerbatim, parseTranscript } from './transcript'

export type HarvestHit = {
  kind: 'quran' | 'hadith'
  text: string
  /** A matched ayah label, or what the speaker named. Never looked up from anywhere else. */
  reference: string
  timestamp: string
  seconds: number
  context: string
  surah?: number
  ayah?: number
  matchedBy?: QuranMatch['how']
  /** The hadith collections the speaker named, as hadith-api slugs. */
  collections?: string[]
}

const ARABIC = /[\u0600-\u06FF][\u0600-\u06FF\s\u064B-\u0652]{3,}/
const QURAN_CUE = /\b(allah (subhana\w* wa ?ta'?ala )?(says|said|tells us|responded)|as allah says|(in|from) the qur'?an|the qur'?an says|verse|surah\s+[a-z]|ayah|o you who believe)\b/i
const HADITH_CUE = /\b((the )?(prophet|messenger)\w*\b[^.?!]{0,70}\b(said|says)|(in|from) (the|that|this|a) hadith|hadith (says|said)|narrated (in|by)|on the authority of|rawa)\b/i
const OPENS_QUOTE = /\b(said|says|tells us|in the qur'?an),?\s*$/i
const QUOTES = /\b(allah|he|she|him|prophet\w*|messenger|rasul\w*|hadith|verse|qur'?an|ayah|lord|god|angels?|moses|musa|ibrahim|abraham|jesus|isa|mary|maryam)\b(\s+[^\s.?!]+){0,6}?\s+(says|said|say|tells us|told|responded|replied|asked|narrated|reported)\b|["“]/i
const TRAILING_QUOTE = /\b(says|said|tells us|told (us|him|her|them)|responded|replied)\b([^.?!]{0,60})$/i

const COLLECTIONS: [RegExp, string][] = [
  [/\bBu?kh?[aā]ri\b/i, 'bukhari'],
  [/\b(Sahih |Imam )?Muslim(?= on| and|,|\.|\)|$)/, 'muslim'],
  [/\bTirmidh[iī]\b/i, 'tirmidhi'],
  [/\bAbu Daw[uū]d\b/i, 'abudawud'],
  [/\bNasa'?[iī]\b/i, 'nasai'],
  [/\bIbn Majah\b/i, 'ibnmajah'],
  [/\bMuwatt?a\b/i, 'malik'],
]

export const COLLECTION_NAMES: Record<string, string> = {
  bukhari: 'Sahih al-Bukhari',
  muslim: 'Sahih Muslim',
  tirmidhi: "Jami' at-Tirmidhi",
  abudawud: 'Sunan Abu Dawud',
  nasai: "Sunan an-Nasa'i",
  ibnmajah: 'Sunan Ibn Majah',
  malik: 'Muwatta Malik',
}

export function collectionsNamed(text: string) {
  return COLLECTIONS.filter(([pattern]) => pattern.test(text)).map(([, slug]) => slug)
}

const STOP = /[.?!…]["”’')\]]*$/
const TERMINATOR = /[.?!…]["”’')\]]*(?=\s|$)/g
const words = (text: string) => text.split(/\s+/).filter(Boolean)

/** Kept entries as they are shown and counted: each one readable, asides left out. Home, Garden and Harvest all use this. */
export function readableHarvest<T extends object>(rows: T[]): (T & { text: string })[] {
  return rows.flatMap((row) => {
    const { text: raw, context } = row as { text?: unknown; context?: unknown }
    const text = harvestLine(typeof raw === 'string' ? raw : '', typeof context === 'string' ? context : '')
    return text ? [{ ...row, text }] : []
  })
}

/**
 * How a kept line reads: the whole sentence it sits in (read from its own context, never rewritten),
 * starting on a capital and ending on a stop. A caption tail ("Judgment. The Prophet…") is cut away,
 * and asides about the video ("check the description for the full dua", "I'm paraphrasing") give null.
 */
export function harvestLine(text: string, context = ''): string | null {
  let core = text.replace(/\s+/g, ' ').trim()
  if (!core || ASIDE.test(core)) return null
  const around = context.replace(/\s+/g, ' ')
  const at = around.indexOf(core)
  const tail = core.match(/^[^.?!…]*[.?!…]["”’')\]]*\s+(?=["“‘(]?[A-Z])/)
  if (tail && words(tail[0]).length <= 4 && words(core).length - words(tail[0]).length >= 4) {
    core = core.slice(tail[0].length)
  } else if (at > 0 && !STOP.test(around.slice(0, at).trim())) {
    const before = words(around.slice(0, at)).slice(-25).join(' ')
    const ends = [...before.matchAll(TERMINATOR)]
    const last = ends[ends.length - 1]
    if (last) core = `${before.slice(last.index + last[0].length).trim()} ${core}`.trim()
    else if (before === words(around.slice(0, at)).join(' ') && /^["“‘(]?[A-Z]/.test(before)) core = `${before} ${core}`
  }
  let rest = at >= 0 ? around.slice(at + text.replace(/\s+/g, ' ').trim().length).trim() : ''
  const upTo = (stop: RegExp) => words(rest).slice(0, 30).join(' ').match(stop)
  if (at >= 0 && !STOP.test(core)) {
    const first = upTo(/^.*?[.?!…]["”’')\]]*(?=\s|$)/)
    if (first) {
      core = `${core} ${first[0]}`
      rest = rest.slice(first[0].length).trim()
    }
  }
  // Only sentences the speaker finished: words after the last real stop are dropped, never closed with an added one.
  const finished = (value: string) => wholeSentences(finishedSentences(value.replace(/\s+([.?!,;:])(?=\s|$)/g, '$1')), { minWords: 4 })
  let line = finished(core)
  // A line cut mid-thought ("…a light for.") reads on to the next full stop, at most two more sentences.
  for (let more = 0; (!line || endsDangling(line)) && at >= 0 && more < 2; more++) {
    const next = upTo(/^.*?[.?!]["”’')\]]*(?=\s|$)/)
    if (!next) break
    core = `${core} ${next[0]}`
    rest = rest.slice(next[0].length).trim()
    line = finished(core)
  }
  // Still hanging, or too short to be a thought: leave it out rather than add a full stop to a fragment.
  if (!line || endsDangling(line) || words(line).length < 5 || ASIDE.test(line)) return null
  return line
}

function sentencesOf(text: string) {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((piece) => piece.trim())
    .filter(Boolean)
}

/** With no cue from the speaker, English has to be a long run or most of a short ayah. */
function strongEnglish(match: QuranMatch) {
  return match.run >= 4 || (match.run >= 3 && (match.cover || 0) >= 0.6 && (match.shared || 0) >= 4)
}

/** Arabic and transliteration are distinctive enough to stand alone; English needs the speaker to be quoting the Qur'an. */
function quranMatchFor(quran: QuranIndex, text: string, englishAllowed: boolean) {
  const found = matchQuran(quran, text)
  if (!found) return null
  if (found.how === 'english' && !englishAllowed) return null
  return found
}

/**
 * Pull the Qur'an and hadith a speaker actually quotes. Every text is copied word for word from
 * the transcript, with the timestamp of the line it sits in. With a Qur'an index, an ayah is
 * attached only when the speaker's own words line up with the real text clearly enough; otherwise
 * the card keeps just the quote. A reference is never guessed.
 */
export function harvestTranscript(raw: string, quran?: QuranIndex): HarvestHit[] {
  const { cues } = parseTranscript(raw)
  const hits: HarvestHit[] = []
  const seen = new Set<string>()
  const covers = (match: QuranMatch | null, seconds: number) =>
    Boolean(match && hits.some((hit) => hit.surah === match.surah && hit.ayah === match.ayah && Math.abs(hit.seconds - seconds) < 30))
  cues.forEach((cue, cueIndex) => {
    const sentences = sentencesOf(cue.text)
    sentences.forEach((sentence, index) => {
      if (ASIDE.test(sentence)) return
      // Captions often split one aside across cues: "check the description for the full dua" / "the prophet said…".
      // A full quote that follows a finished aside is kept; only the short continuation is dropped.
      const previous = (sentences[index - 1] || cues[cueIndex - 1]?.text || '').trim()
      if (previous && ASIDE.test(previous) && !/[.?!]["']?\s*$/.test(previous) && sentence.split(/\s+/).length < 12) return
      // Captions break mid-sentence, so a line that starts mid-sentence is read with the end of the line before.
      const before = index === 0 ? cues[cueIndex - 1]?.text || '' : ''
      const lead = before && !/[.?!]["”']?$/.test(before.trim()) ? before.split(/\s+/).slice(-14).join(' ') : ''
      const own = QURAN_CUE.test(sentence) || HADITH_CUE.test(sentence)
      const probe = !own && lead ? `${lead} ${sentence}` : sentence
      const quranCue = QURAN_CUE.exec(probe)
      const hadithCue = HADITH_CUE.exec(probe)
      const arabic = ARABIC.test(sentence)
      if (!quranCue && !hadithCue && !arabic) return
      let kind: HarvestHit['kind']
      if (quranCue && hadithCue) kind = quranCue.index <= hadithCue.index ? 'quran' : 'hadith'
      else if (quranCue) kind = 'quran'
      else if (hadithCue) kind = 'hadith'
      else {
        const around = `${cues[cueIndex - 1]?.text || ''} ${cue.text}`
        if (QURAN_CUE.test(around)) kind = 'quran'
        else if (HADITH_CUE.test(around)) kind = 'hadith'
        else if (quran && quranMatchFor(quran, sentence, false)) kind = 'quran'
        else return
      }
      let text = sentence
      const following = [...sentences.slice(index + 1), ...[1, 2, 3].flatMap((step) => (cues[cueIndex + step] ? sentencesOf(cues[cueIndex + step].text) : []))]
      for (const next of following.slice(0, 3)) {
        if (!(OPENS_QUOTE.test(text) || TRAILING_QUOTE.test(text) || text.split(/\s+/).length < 9) || ASIDE.test(next)) break
        text = `${text} ${next}`
      }
      if (ASIDE.test(text)) return
      const key = text.toLowerCase().replace(/\s+/g, ' ')
      if (seen.has(key) || text.split(/\s+/).length < 5) return
      if (hits.length && hits[hits.length - 1].text.includes(sentence)) return
      const match = quran ? quranMatchFor(quran, text, kind === 'quran') : null
      if (match) kind = 'quran'
      if (!match && !arabic && !QUOTES.test(probe === sentence ? text : `${lead} ${text}`)) return
      if (covers(match, cue.start)) return
      seen.add(key)
      const named = probe === sentence ? text : `${lead} ${text}`
      const surah = named.match(/\bsurah\s+(al-|ali\s?'?|an-|ar-|as-|at-)?([A-Z][A-Za-z'-]+)/i)
      const collections = kind === 'hadith' ? collectionsNamed(named) : []
      hits.push({
        kind,
        text,
        reference: match && quran ? surahLabel(quran, match.surah, match.ayah) : kind === 'quran' ? (surah ? `Surah ${surah[0].replace(/^surah\s+/i, '')}` : '') : collections.map((slug) => COLLECTION_NAMES[slug]).join(' and '),
        timestamp: formatTimestamp(cue.start),
        seconds: Math.round(cue.start),
        context: wordSlice([cues[cueIndex - 1]?.text, cue.text, cues[cueIndex + 1]?.text, cues[cueIndex + 2]?.text].filter(Boolean).join(' '), 600),
        ...(match ? { surah: match.surah, ayah: match.ayah, matchedBy: match.how } : {}),
        ...(collections.length ? { collections } : {}),
      })
    })
  })
  if (quran) {
    cues.forEach((cue, cueIndex) => {
      const pair = `${cue.text} ${cues[cueIndex + 1]?.text || ''}`.trim()
      const englishAllowed = !HADITH_CUE.test(`${cues[cueIndex - 1]?.text || ''} ${pair}`)
      const own = quranMatchFor(quran, cue.text, englishAllowed)
      if (!own && cues[cueIndex + 1] && quranMatchFor(quran, cues[cueIndex + 1].text, englishAllowed)) return
      const match = own || quranMatchFor(quran, pair, englishAllowed)
      if (!match || (match.how === 'english' && !strongEnglish(match)) || covers(match, cue.start)) return
      const text = own ? cue.text : pair
      const key = text.toLowerCase().replace(/\s+/g, ' ')
      if (seen.has(key)) return
      seen.add(key)
      hits.push({
        kind: 'quran',
        text,
        reference: surahLabel(quran, match.surah, match.ayah),
        timestamp: formatTimestamp(cue.start),
        seconds: Math.round(cue.start),
        context: wordSlice(`${cues[cueIndex - 1]?.text || ''} ${pair}`.trim(), 400),
        surah: match.surah,
        ayah: match.ayah,
        matchedBy: match.how,
      })
    })
  }
  return hits.sort((a, b) => a.seconds - b.seconds).slice(0, 30)
}

/** How a spoken line kept from a short clip reads: a verse or hadith cue, or a plain line. No reference is looked up. */
export function kindOfLine(text: string): 'quran' | 'hadith' | 'line' {
  const quran = QURAN_CUE.exec(text)
  const hadith = HADITH_CUE.exec(text)
  if (quran && hadith) return quran.index <= hadith.index ? 'quran' : 'hadith'
  if (quran) return 'quran'
  if (hadith) return 'hadith'
  return 'line'
}

const NAMED_SCHOLAR =
  "Ibn\\s+(?:al-|Al-|el-)?(?:Qayyim(?:\\s+Al-Jawzi(?:yya)?)?|Kathir|Rajab|Hajar|Taymiyyah|Ata['’]?i(?:llah|l)?(?:\\s+al-Iskandari)?|Ata['’]?il(?:\\s+Al-Asqandari)?)|Imam\\s+(?:al-)?(?:Nawawi|Ghazali|Qurtubi|Tabari)"
const SCHOLAR_RE = new RegExp(`\\b(${NAMED_SCHOLAR})\\b`, 'i')
const SPEECH_RE = /\b(?:he|she)\s+says\b|\bsays\b|\bsaid\b/gi
const PLACEHOLDER = /verify before sharing/i

export type SpokenLine = {
  text: string
  seconds: number
  timestamp: string
  before: { text: string; seconds: number; timestamp: string }[]
  after: { text: string; seconds: number; timestamp: string }[]
  context: string
}

export type ScholarCitation = {
  scholar: string
  text: string
  citation: string
}

function cueIndexAt(cues: { start: number; end: number }[], seconds: number) {
  const inside = cues.findIndex((cue, index) => {
    const end = index + 1 < cues.length ? cues[index + 1].start : Math.max(cue.end, cue.start + 0.25)
    return seconds >= cue.start - 0.05 && seconds < end
  })
  if (inside >= 0) return inside
  let best = -1
  let bestDist = Infinity
  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index]
    const dist = seconds < cue.start ? cue.start - seconds : Math.max(0, seconds - cue.end)
    if (dist < bestDist) {
      bestDist = dist
      best = index
    }
  }
  return best >= 0 && bestDist <= 20 ? best : -1
}

function flat(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * The spoken line at `seconds`, copied from the transcript. The words are the cue's own words.
 * Nothing is rewritten, and a time with no nearby cue returns nothing.
 */
export function lineAt(raw: string, seconds: number): SpokenLine | null {
  if (!raw.trim() || !Number.isFinite(seconds) || seconds < 0) return null
  const { cues } = parseTranscript(raw)
  const index = cueIndexAt(cues, seconds)
  if (index < 0) return null
  const text = flat(cues[index].text)
  if (!text || !isVerbatim(text, raw)) return null
  const side = (from: number, to: number) =>
    cues.slice(from, to).map((cue) => {
      const spoken = flat(cue.text)
      return { text: spoken, seconds: cue.start, timestamp: formatTimestamp(cue.start) }
    }).filter((row) => row.text && isVerbatim(row.text, raw))
  const before = side(Math.max(0, index - 2), index)
  const after = side(index + 1, index + 3)
  return {
    text,
    seconds: cues[index].start,
    timestamp: formatTimestamp(cues[index].start),
    before,
    after,
    context: [...before.map((row) => row.text), text, ...after.map((row) => row.text)].join(' '),
  }
}

function scholarName(text: string) {
  const match = text.match(SCHOLAR_RE)
  return match ? match[1].replace(/\s+/g, ' ').trim() : null
}

function quoteAfter(cue: string) {
  const re = new RegExp(SPEECH_RE.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(cue))) {
    let rest = cue.slice(match.index + match[0].length).replace(/^[\s,;:?!."']+/, '').replace(/^(?:that|is that)\s+/i, '')
    const sentences = rest.split(/(?<=[.?!])\s+/).map((piece) => piece.trim()).filter(Boolean).slice(0, 2)
    const text = flat(sentences.join(' '))
    const words = text.split(/\s+/).filter(Boolean)
    if (words.length >= 8 && text.length <= 700) return text
  }
  return null
}

/**
 * A scholar named in the transcript near this moment, and the words the speaker gives them.
 * The quote has to sit in the transcript word for word. A name with no words, or words with no name, returns nothing.
 */
export function citedCommentary(raw: string, seconds: number): ScholarCitation | null {
  if (!raw.trim() || !Number.isFinite(seconds)) return null
  const { cues } = parseTranscript(raw)
  const index = cueIndexAt(cues, seconds)
  if (index < 0) return null
  let best: { dist: number; citation: ScholarCitation } | null = null
  const from = Math.max(0, index - 2)
  const to = Math.min(cues.length - 1, index + 1)
  for (let at = from; at <= to; at += 1) {
    const scholar = scholarName(cues[at].text) || (at > 0 ? scholarName(cues[at - 1].text) : null)
    const text = quoteAfter(cues[at].text)
    if (!scholar || !text || !isVerbatim(text, raw)) continue
    const dist = Math.abs(cues[at].start - seconds)
    if (dist > 8) continue
    const citation = {
      scholar,
      text,
      citation: `Named in this talk: ${scholar}. The words are copied from the transcript.`,
    }
    if (!best || dist < best.dist) best = { dist, citation }
  }
  return best?.citation ?? null
}

type ResourceLike = { name?: string | null; kind?: string | null; body?: string | null; url?: string | null }

/**
 * A commentary row already stored on the lesson. The body is returned unchanged.
 * A placeholder, an empty body, or any other kind of resource is not a source.
 */
export function resourceCommentary(resources: ResourceLike[]): ScholarCitation | null {
  for (const row of resources) {
    const kind = row.kind || ''
    const name = (row.name || '').trim()
    const text = (row.body || '').trim()
    if (kind !== 'quote' && kind !== 'reading') continue
    if (name.length < 3 || text.length < 40) continue
    if (PLACEHOLDER.test(name) || PLACEHOLDER.test(text)) continue
    const url = (row.url || '').trim()
    const citation = /^https:\/\//i.test(url) ? `${name} ${url}` : name
    return { scholar: name, text, citation }
  }
  return null
}

export function commentaryFor(raw: string, seconds: number, resources: ResourceLike[]): ScholarCitation | null {
  return citedCommentary(raw, seconds) || resourceCommentary(resources)
}

/** The first cue in the transcript that names a scholar and gives their words. One pass, for the sample harvest. */
export function firstCitation(raw: string): { seconds: number; citation: ScholarCitation } | null {
  if (!raw.trim()) return null
  const { cues } = parseTranscript(raw)
  for (let index = 0; index < cues.length; index += 1) {
    const scholar = scholarName(cues[index].text) || (index > 0 ? scholarName(cues[index - 1].text) : null)
    const text = quoteAfter(cues[index].text)
    if (!scholar || !text || !isVerbatim(text, raw)) continue
    return {
      seconds: cues[index].start,
      citation: { scholar, text, citation: `Named in this talk: ${scholar}. The words are copied from the transcript.` },
    }
  }
  return null
}

const FIRST_LOOK_MS = 36 * 60 * 60 * 1000

/** New when the line was gathered after the learner last opened Harvest. The first look marks only the last day and a half. */
export function isNewMoment(gatheredAt: string | null | undefined, seenAt: string | null | undefined, at: Date) {
  if (!gatheredAt) return false
  const gathered = new Date(gatheredAt).getTime()
  if (Number.isNaN(gathered)) return false
  if (seenAt) {
    const seen = new Date(seenAt).getTime()
    if (!Number.isNaN(seen)) return gathered > seen
  }
  return gathered > at.getTime() - FIRST_LOOK_MS
}
