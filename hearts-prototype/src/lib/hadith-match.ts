import { englishTokens } from './quran-match'

export type Hadith = {
  number: number
  /** The number people cite (the Arabic numbering), when it differs from the API's own. */
  reference?: string
  text: string
  arabic?: string
  grades?: { name: string; grade: string }[]
}

export type HadithIndex = {
  collection: string
  items: { hadith: Hadith; tokens: string[] }[]
  byPair: Map<string, number[]>
}

function bigrams(tokens: string[]) {
  const out: string[] = []
  for (let index = 0; index + 1 < tokens.length; index++) out.push(`${tokens[index]} ${tokens[index + 1]}`)
  return out
}

export function buildHadithIndex(collection: string, hadiths: Hadith[]): HadithIndex {
  const items = hadiths.filter((hadith) => hadith.text.trim()).map((hadith) => ({ hadith, tokens: englishTokens(hadith.text) }))
  const byPair = new Map<string, number[]>()
  items.forEach((item, id) => {
    for (const key of new Set(bigrams(item.tokens))) {
      const list = byPair.get(key)
      if (list) list.push(id)
      else byPair.set(key, [id])
    }
  })
  return { collection, items, byPair }
}

const HONORIFIC = /^(sayyid(ina|una|na)?|our master|imam|abu|umm|ibn|bin|the|al)$/i

/** The narrator a speaker names ("on the authority of Anas", "narrated by Umar"), if any. */
export function narratorNamed(text: string) {
  const found = text.match(/\b(?:on the authority of|narrated by|reported by)\s+((?:[A-Z][\w'-]*\s+){0,3}[A-Z][\w'-]*)/)
  if (!found) return ''
  const words = found[1].split(/\s+/).filter((word) => !HONORIFIC.test(word))
  return words[0] || ''
}

/**
 * The hadith a speaker quotes from a collection they named, or nothing. The speaker's words have
 * to share at least three word pairs with one hadith, and no other hadith in the collection may
 * share as many. When the speaker names the narrator, the hadith has to be that narrator's.
 */
export function matchHadith(index: HadithIndex, text: string): { hadith: Hadith; pairs: number } | null {
  const narrator = narratorNamed(text).toLowerCase()
  const plain = text.replace(/\b(sahih|sunan|jami|musnad|muwatta)\s+(al-|of\s+|imam\s+)?\w+/gi, ' ')
  const query = englishTokens(plain).filter((token) => !ATTRIBUTION.has(token) && token !== narrator)
  if (query.length < 4) return null
  const pairs = new Set(bigrams(query))
  const hits = new Map<number, string[]>()
  for (const key of pairs) {
    const ids = index.byPair.get(key) || []
    if (ids.length > 200) continue
    for (const id of ids) hits.set(id, [...(hits.get(id) || []), key])
  }
  const ranked = [...hits.entries()]
    .filter(([id]) => !narrator || index.items[id].hadith.text.slice(0, 160).toLowerCase().includes(narrator))
    .sort((a, b) => b[1].length - a[1].length || index.items[a[0]].hadith.number - index.items[b[0]].hadith.number)
  const [best, second] = ranked
  if (!best || best[1].length < 3) return null
  // Collections repeat a hadith under several chapters. A tie only stands when the tied hadith match
  // exactly the same phrases, and then the earliest one in the collection is cited.
  const tied = ranked.filter(([, keys]) => keys.length === best[1].length)
  if (second && tied.some(([, keys]) => keys.join('|') !== best[1].join('|'))) return null
  const shared = new Set(index.items[best[0]].tokens.filter((token) => query.includes(token)))
  if (shared.size < 5) return null
  return { hadith: index.items[best[0]].hadith, pairs: best[1].length }
}

/** Words a speaker uses to introduce a hadith rather than to quote it. */
const ATTRIBUTION = new Set(['prophet', 'messenger', 'said', 'say', 'saying', 'narrat', 'hadith', 'sahih', 'authority', 'report', 'collect', 'bukhari', 'tirmidhi', 'dawud', 'nasai', 'majah', 'nawawi'])
