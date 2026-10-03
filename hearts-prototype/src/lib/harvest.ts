import { formatTimestamp, parseTranscript } from './transcript'

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
const ASIDE = /\b(description|subscribe|housekeeping|like and share|patreon|sponsors?|notification bell|comment below|thanks for watching|thank you for watching|link in the description)\b/i

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
      if (ASIDE.test(sentence)) return
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
      if ((OPENS_QUOTE.test(sentence) || sentence.split(/\s+/).length < 9) && next && !ASIDE.test(next)) text = `${sentence} ${next}`
      if (ASIDE.test(text)) return
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
