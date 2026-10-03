import { formatTimestamp, isVerbatim, parseTranscript } from './transcript'

export type HarvestHit = {
  kind: 'quran' | 'hadith'
  text: string
  reference: string
  timestamp: string
  context: string
}

const ARABIC = /[\u0600-\u06FF][\u0600-\u06FF\s\u064B-\u0652]{3,}/
const QURAN_CUE = /\b(allah (subhanahu wa ta'?ala )?(says|said|tells us)|as allah says|in the qur'?an|the qur'?an says|the verse|surah\s+[a-z]|ayah|o you who believe)\b/i
const HADITH_CUE = /\b((the )?(prophet|messenger)\b[^.?!]{0,70}\b(said|says)|in the hadith[^.?!]{0,40}\b(said|says|narrated)|narrated (in|by)|on the authority of|rawa)\b/i
const OPENS_QUOTE = /\b(said|says|tells us|in the qur'?an),?\s*$/i

function sentencesOf(text: string) {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((piece) => piece.trim())
    .filter(Boolean)
}

/**
 * Pull the Qur'an and hadith a speaker actually quotes. Every text is copied word for word from
 * the transcript, with the timestamp of the line it sits in. A reference is kept only when the
 * speaker names it (a surah, or a hadith collection). Nothing is looked up or guessed.
 */
export function harvestTranscript(raw: string): HarvestHit[] {
  const { cues } = parseTranscript(raw)
  const hits: HarvestHit[] = []
  const seen = new Set<string>()
  cues.forEach((cue, cueIndex) => {
    const sentences = sentencesOf(cue.text)
    sentences.forEach((sentence, index) => {
      const quran = QURAN_CUE.exec(sentence)
      const hadith = HADITH_CUE.exec(sentence)
      const arabic = ARABIC.test(sentence)
      if (!quran && !hadith && !arabic) return
      let kind: HarvestHit['kind']
      if (quran && hadith) kind = quran.index <= hadith.index ? 'quran' : 'hadith'
      else if (quran) kind = 'quran'
      else if (hadith) kind = 'hadith'
      else {
        const around = `${cues[cueIndex - 1]?.text || ''} ${cue.text}`
        if (QURAN_CUE.test(around)) kind = 'quran'
        else if (HADITH_CUE.test(around)) kind = 'hadith'
        else return
      }
      let text = sentence
      const next = sentences[index + 1] || cues[cueIndex + 1]?.text.split(/(?<=[.?!])\s+/)[0]
      if ((OPENS_QUOTE.test(sentence) || sentence.split(/\s+/).length < 9) && next) text = `${sentence} ${next}`
      const key = text.toLowerCase().replace(/\s+/g, ' ')
      if (seen.has(key) || text.split(/\s+/).length < 5) return
      seen.add(key)
      const window = `${cues[cueIndex - 1]?.text || ''} ${cue.text} ${cues[cueIndex + 1]?.text || ''}`
      const surah = window.match(/\bsurah\s+(al-|ali\s?'?|an-|ar-|as-|at-)?([A-Z][A-Za-z'-]+)/i)
      const collection = window.match(/\b(Bukhari|Muslim(?= on| and|,|\.)|Tirmidhi|Abu Dawud|Nasa'?i|Ibn Majah)\b/)
      hits.push({
        kind,
        text,
        reference: kind === 'quran' ? (surah ? `Surah ${surah[0].replace(/^surah\s+/i, '')}` : '') : collection?.[1] || '',
        timestamp: formatTimestamp(cue.start),
        context: sentences.slice(Math.max(0, index - 1), index + 2).join(' ').slice(0, 400),
      })
    })
  })
  return hits.slice(0, 30)
}

/** Hadith Jibril's working doors, the six cores the curriculum already hangs on. */
export const WORKING_DOORS: { key: string; title: string; short: string }[] = [
  { key: 'Sitting', title: 'The sitting', short: 'The sitting' },
  { key: 'Islam', title: 'Islam', short: 'Islam' },
  { key: 'Iman', title: 'Iman', short: 'Iman' },
  { key: 'Ihsan', title: 'Ihsan', short: 'Ihsan' },
  { key: 'Hour', title: 'The Hour', short: 'The Hour' },
  { key: 'Trunk', title: 'He came to teach you your religion', short: 'The trunk' },
]

export function doorTitle(key: string | null | undefined, short = false) {
  const door = WORKING_DOORS.find((row) => row.key === key)
  if (!door) return key ? 'Other' : 'Other'
  return short ? door.short : door.title
}

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
