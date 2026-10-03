import { matchQuran, surahLabel, type QuranIndex, type QuranMatch } from './quran-match'
import { formatTimestamp, parseTranscript } from './transcript'

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
        if (!(OPENS_QUOTE.test(text) || TRAILING_QUOTE.test(text) || text.split(/\s+/).length < 9)) break
        text = `${text} ${next}`
      }
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
        context: [cues[cueIndex - 1]?.text, cue.text, cues[cueIndex + 1]?.text, cues[cueIndex + 2]?.text].filter(Boolean).join(' ').slice(0, 600),
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
        context: `${cues[cueIndex - 1]?.text || ''} ${pair}`.trim().slice(0, 400),
        surah: match.surah,
        ayah: match.ayah,
        matchedBy: match.how,
      })
    })
  }
  return hits.sort((a, b) => a.seconds - b.seconds).slice(0, 30)
}
