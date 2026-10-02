export type HarvestHit = {
  kind: 'quran' | 'hadith'
  text: string
  reference: string
  timestamp: string
  context: string
}

const ARABIC = /[\u0600-\u06FF][\u0600-\u06FF\s\u064B-\u0652]{3,}/g

function nearby(source: string, index: number) {
  return source.slice(Math.max(0, index - 180), Math.min(source.length, index + 220)).replace(/\s+/g, ' ')
}

function timestampNear(window: string) {
  const match = window.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/)
  return match?.[1] || ''
}

/**
 * Conservative harvest. Arabic is kept as transcribed.
 * A reference is stored only when the speaker states one. Nothing is guessed.
 */
export function harvestTranscript(raw: string): HarvestHit[] {
  const hits: HarvestHit[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  const pattern = new RegExp(ARABIC.source, 'g')
  while ((match = pattern.exec(raw))) {
    const text = match[0].replace(/\s+/g, ' ').trim()
    if (seen.has(text)) continue
    seen.add(text)
    const window = nearby(raw, match.index)
    const quranCue = /allah says|the qur'?an|surah|ayah|verse/i.test(window)
    const hadithCue = /prophet|messenger|hadith|narrat/i.test(window)
    let kind: 'quran' | 'hadith' | null = null
    if (quranCue && !hadithCue) kind = 'quran'
    else if (hadithCue && !quranCue) kind = 'hadith'
    else if (quranCue) kind = 'quran'
    else continue
    const surah = window.match(/surah\s+([A-Za-z][A-Za-z\-']+)/i)
    const collection = window.match(/\b(Bukhari|Muslim|Tirmidhi|Abu Dawud|Nasa'?i|Ibn Majah)\b/i)
    hits.push({
      kind,
      text,
      reference: kind === 'quran' ? (surah ? `Surah ${surah[1]}` : '') : collection?.[1] || '',
      timestamp: timestampNear(window),
      context: window.slice(0, 280),
    })
  }
  return hits.slice(0, 40)
}
