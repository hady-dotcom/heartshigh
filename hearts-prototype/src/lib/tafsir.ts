import type { LlmRequest } from './llm'

export type TafsirSource = { slug: string; title: string; author: string; language: 'English' | 'Arabic'; note: string }
export type TafsirText = TafsirSource & { text: string }

/** Classical tafsir from the open tafsir API (spa5k/tafsir_api, MIT), each shown under its own name. */
export const TAFSIR_SOURCES: TafsirSource[] = [
  { slug: 'en-tafisr-ibn-kathir', title: 'Tafsir Ibn Kathir', author: 'Ismail ibn Kathir (d. 774 AH)', language: 'English', note: 'Abridged English translation' },
  { slug: 'en-al-jalalayn', title: 'Tafsir al-Jalalayn', author: 'Jalal al-Din al-Mahalli and Jalal al-Din al-Suyuti', language: 'English', note: 'English translation' },
  { slug: 'ar-tafseer-al-saddi', title: "Tafsir al-Sa'di", author: "Abd al-Rahman al-Sa'di (d. 1376 AH)", language: 'Arabic', note: 'Arabic original' },
  { slug: 'ar-tafsir-ibn-kathir', title: 'Tafsir Ibn Kathir', author: 'Ismail ibn Kathir (d. 774 AH)', language: 'Arabic', note: 'Arabic original' },
  { slug: 'ar-tafsir-al-jalalayn', title: 'Tafsir al-Jalalayn', author: 'Jalal al-Din al-Mahalli and Jalal al-Din al-Suyuti', language: 'Arabic', note: 'Arabic original' },
]

export const TAFSIR_CREDIT = 'Tafsir texts from the open tafsir API by spa5k (github.com/spa5k/tafsir_api, MIT licence), which takes them from quran.com and the QUL resources by Tarteel.'

/** The sources a summary may draw on: one text per work, English first, so al-Sa'di joins in Arabic. */
export function summarySources(texts: TafsirText[]) {
  const byWork = new Map<string, TafsirText>()
  for (const row of texts) if (!byWork.has(row.title) || (byWork.get(row.title)!.language === 'Arabic' && row.language === 'English')) byWork.set(row.title, row)
  return [...byWork.values()]
}

export function joinNames(names: string[]) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function summaryLabel(sources: string[]) {
  return `AI summary of ${joinNames(sources)}`
}

const PER_SOURCE = 6000

export function summaryRequest(surah: number, ayah: number, texts: TafsirText[]): { llm: LlmRequest; used: string[] } {
  const chosen = summarySources(texts)
  const system = [
    'You summarise classical tafsir for a learner who has just heard this ayah quoted in a talk.',
    'Use only the tafsir passages you are given. Do not add any meaning, story, hadith, ruling or reference that is not in them.',
    'If the passages disagree, say so briefly and name which source says what.',
    'Write three to five plain English sentences. No headings, no lists, no Arabic unless a passage explains a word.',
    'Refer to the sources by the names given. Do not invent quotations.',
  ].join('\n')
  const user = [
    `Ayah ${surah}:${ayah}.`,
    ...chosen.map((row) => `\n### ${row.title} (${row.language})\n${row.text.slice(0, PER_SOURCE)}`),
  ].join('\n')
  return { llm: { system, user }, used: chosen.map((row) => row.title) }
}
