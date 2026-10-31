export type QuranSurah = { n: number; name: string; english: string; arabic: string; verses: number }

export type QuranCorpus = {
  sources: { arabic: string; english: string; matching: string; api: string }
  surahs: QuranSurah[]
  /** One entry per ayah, in mushaf order. */
  ar: string[]
  tr: string[]
  en: string[]
  yusufali: string[]
  pickthall: string[]
}

export type QuranMatch = {
  surah: number
  ayah: number
  how: 'arabic' | 'transliteration' | 'english'
  /** The run of the speaker's words that lined up with the ayah. */
  run: number
  /** English only: how much of the ayah's own words the speaker said. */
  cover?: number
  shared?: number
}

export type QuranIndex = {
  corpus: QuranCorpus
  starts: number[]
  arabic: string[][]
  translit: string[][]
  english: { tokens: string[]; set: Set<string> }[][]
  byArabic: Map<string, number[]>
  byTranslit: Map<string, number[]>
  byEnglish: Map<string, number[]>
  /** Every word in the English translations, so English is never read as transliteration. */
  lexicon: Set<string>
}

const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g

export function normalizeArabic(text: string) {
  return text
    .replace(TASHKEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
}

export function arabicTokens(text: string) {
  return normalizeArabic(text)
    .split(/[^\u0621-\u064A]+/)
    .filter((token) => token.length > 1)
}

/** Runs of Arabic script inside a line of mixed English and Arabic. */
export function arabicSpans(text: string) {
  return (text.match(/[\u0600-\u06FF][\u0600-\u06FF\s\u064B-\u0652\u0670]*/g) || []).map(arabicTokens).filter((span) => span.length)
}

/** A consonant skeleton, so "nooru", "nur" and "Noor" all read as "nr". */
export function skeleton(word: string) {
  return word
    .toLowerCase()
    .replace(/aa/g, '')
    .replace(/[^a-z]/g, '')
    .replace(/^(wa|fa)?al/, '$1')
    .replace(/[aeiouy]/g, '')
    .replace(/(.)\1+/g, '$1')
}

const ENGLISH_WORDS = new Set(
  'the a an and or of to in on for is are was were be been it that this those these with as by at from his he him they them their you your we our us i me my who which what when then so but not no all will shall do does did has have had there here into out up any some indeed than its whom whose upon over such may might can could would should one say says said like just know really very about because going get got want make made right okay now how why where well even also only see look thing things people person time way day said tell told mean means allah god prophet quran verse ayah'.split(' '),
)

function plainWords(text: string) {
  return text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean)
}

const ARCHAIC: Record<string, string> = { thee: 'you', thou: 'you', ye: 'you', thy: 'your', thine: 'your', hath: 'has', hast: 'have', doth: 'does', unto: 'to', god: 'allah', lo: '', verily: 'indeed', surely: 'indeed' }
const STOP = new Set(
  'the a an and or of to in on for is are was were be been it that this those these with as by at from his he him they them their you your we our us i me my who which what when then so but not no all will shall do does did has have had there here into out up any some indeed than its whom whose upon over such may might can could would should one'.split(' '),
)

export function englishTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[[\]]/g, ' ')
    .replace(/[^a-z' ]+/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/'s$/, '').replace(/'/g, ''))
    .map((word) => (word in ARCHAIC ? ARCHAIC[word] : word))
    .filter((word) => word.length > 2 && !STOP.has(word))
    .map((word) => word.replace(/(ing|ed|es|s)$/, ''))
}

function bigrams(tokens: string[]) {
  const out: string[] = []
  for (let index = 0; index + 1 < tokens.length; index++) out.push(`${tokens[index]} ${tokens[index + 1]}`)
  return out
}

function addTo(map: Map<string, number[]>, key: string, id: number) {
  const list = map.get(key)
  if (!list) map.set(key, [id])
  else if (list[list.length - 1] !== id) list.push(id)
}

export function buildQuranIndex(corpus: QuranCorpus): QuranIndex {
  const starts: number[] = []
  let total = 0
  for (const surah of corpus.surahs) {
    starts.push(total)
    total += surah.verses
  }
  const arabic = corpus.ar.map(arabicTokens)
  const translit = corpus.tr.map((line) => line.split(/\s+/).map(skeleton).filter(Boolean))
  const english = corpus.en.map((_, id) =>
    [corpus.en[id], corpus.yusufali[id], corpus.pickthall[id]].map((line) => {
      const tokens = englishTokens(line || '')
      return { tokens, set: new Set(tokens) }
    }),
  )
  const byArabic = new Map<string, number[]>()
  const byTranslit = new Map<string, number[]>()
  const byEnglish = new Map<string, number[]>()
  arabic.forEach((tokens, id) => bigrams(tokens).forEach((key) => addTo(byArabic, key, id)))
  translit.forEach((tokens, id) => bigrams(tokens).forEach((key) => addTo(byTranslit, key, id)))
  english.forEach((versions, id) => versions.forEach((version) => bigrams(version.tokens).forEach((key) => addTo(byEnglish, key, id))))
  const lexicon = new Set(ENGLISH_WORDS)
  for (const line of [...corpus.en, ...corpus.yusufali, ...corpus.pickthall]) for (const word of plainWords(line)) lexicon.add(word)
  return { corpus, starts, arabic, translit, english, byArabic, byTranslit, byEnglish, lexicon }
}

export function ayahId(index: QuranIndex, surah: number, ayah: number) {
  const meta = index.corpus.surahs[surah - 1]
  if (!meta || ayah < 1 || ayah > meta.verses) return -1
  return index.starts[surah - 1] + ayah - 1
}

export function ayahKey(index: QuranIndex, id: number) {
  let surah = 0
  while (surah + 1 < index.starts.length && index.starts[surah + 1] <= id) surah++
  return { surah: surah + 1, ayah: id - index.starts[surah] + 1 }
}

function close(a: string, b: string) {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 4) return false
  let edits = 0
  for (let i = 0, j = 0; i < a.length || j < b.length; ) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return true
}

/** The longest run of consecutive query words that appear, in order and side by side, in the ayah. */
function longestRun(query: string[], ayah: string[], fuzzy: boolean) {
  let best = 0
  for (let i = 0; i < query.length; i++) {
    for (let j = 0; j < ayah.length; j++) {
      let length = 0
      while (i + length < query.length && j + length < ayah.length && (fuzzy ? close(query[i + length], ayah[j + length]) : query[i + length] === ayah[j + length])) length++
      if (length > best) best = length
    }
  }
  return best
}

function candidates(map: Map<string, number[]>, tokens: string[]) {
  const ids = new Set<number>()
  for (const key of bigrams(tokens)) for (const id of map.get(key) || []) ids.add(id)
  return ids
}

/**
 * Arabic the speaker recites. The best ayah has to cover most of the quoted span, and nothing
 * else may line up as well. Two words are enough only when that pair is found in one ayah alone.
 */
function matchArabic(index: QuranIndex, text: string): QuranMatch | null {
  let found: QuranMatch | null = null
  for (const span of arabicSpans(text)) {
    if (span.length < 2) continue
    const ranked = [...candidates(index.byArabic, span)]
      .map((id) => ({ id, run: longestRun(span, index.arabic[id], true) }))
      .sort((a, b) => b.run - a.run)
    const [best, second] = ranked
    if (!best || best.run < 2 || best.run / span.length < 0.6) continue
    if (second && second.run >= best.run) continue
    if (best.run === 2 && !bigrams(span).some((key) => index.byArabic.get(key)?.length === 1 && index.byArabic.get(key)?.[0] === best.id)) continue
    if (!found || best.run > found.run) found = { ...ayahKey(index, best.id), how: 'arabic', run: best.run }
  }
  return found
}

/** Arabic said aloud and written out in English letters, compared as consonant skeletons. */
function matchTranslit(index: QuranIndex, text: string): QuranMatch | null {
  const words = text.split(/\s+/).filter(Boolean)
  const tokens = words.map(skeleton)
  const usable = words.map((word, i) => tokens[i].length >= 2 && !index.lexicon.has(word.toLowerCase().replace(/[^a-z]/g, '')))
  let found: QuranMatch | null = null
  let start = 0
  while (start < tokens.length) {
    if (!usable[start]) {
      start++
      continue
    }
    let end = start
    while (end < tokens.length && usable[end]) end++
    const span = tokens.slice(start, end)
    start = end
    if (span.length < 3) continue
    const ranked = [...candidates(index.byTranslit, span)]
      .map((id) => ({ id, run: longestRun(span, index.translit[id], true) }))
      .sort((a, b) => b.run - a.run)
    const [best, second] = ranked
    if (!best || best.run < 3 || (second && second.run >= best.run)) continue
    const distinct = new Set(span)
    if (distinct.size < 3 || [...distinct].join('').length < 8) continue
    if (!found || best.run > found.run) found = { ...ayahKey(index, best.id), how: 'transliteration', run: best.run }
  }
  return found
}

/**
 * An English rendering of the ayah. The speaker's words have to share at least three word pairs with
 * one of the translations, cover a good part of the ayah, and beat every other ayah outright.
 */
function matchEnglish(index: QuranIndex, text: string): QuranMatch | null {
  const query = englishTokens(text)
  if (query.length < 4) return null
  const pairs = new Set(bigrams(query))
  const words = new Set(query)
  const ranked = [...candidates(index.byEnglish, query)]
    .map((id) => {
      let best = { pairs: 0, shared: 0, cover: 0 }
      for (const version of index.english[id]) {
        const sharedPairs = bigrams(version.tokens).filter((key) => pairs.has(key)).length
        const shared = [...version.set].filter((token) => words.has(token)).length
        const cover = shared / Math.max(1, version.set.size)
        if (sharedPairs > best.pairs || (sharedPairs === best.pairs && cover > best.cover)) best = { pairs: sharedPairs, shared, cover }
      }
      return { id, ...best }
    })
    .sort((a, b) => b.pairs - a.pairs || b.cover - a.cover)
  const [best, second] = ranked
  if (!best || best.pairs < 3 || best.cover < 0.4 || (best.shared < 5 && best.cover < 0.6)) return null
  if (second && second.pairs >= best.pairs) return null
  return { ...ayahKey(index, best.id), how: 'english', run: best.pairs, cover: best.cover, shared: best.shared }
}

/**
 * Find the ayah a speaker quotes, or nothing. Arabic is tried first, then transliteration, then the
 * English. A match is only returned when it is clear; a near miss returns null, never a guess.
 */
export function matchQuran(index: QuranIndex, text: string): QuranMatch | null {
  return matchArabic(index, text) || matchTranslit(index, text) || matchEnglish(index, text)
}

export function surahLabel(index: QuranIndex, surah: number, ayah: number) {
  const meta = index.corpus.surahs[surah - 1]
  return meta ? `${meta.name} ${surah}:${ayah}` : `${surah}:${ayah}`
}

/** The ayah with a few either side, never crossing into the next surah. */
export function ayahWindow(index: QuranIndex, surah: number, ayah: number, around = 3) {
  const meta = index.corpus.surahs[surah - 1]
  if (!meta) return []
  const from = Math.max(1, ayah - around)
  const to = Math.min(meta.verses, ayah + around)
  const out: { surah: number; ayah: number; arabic: string; english: string; focus: boolean }[] = []
  for (let number = from; number <= to; number++) {
    const id = ayahId(index, surah, number)
    out.push({ surah, ayah: number, arabic: index.corpus.ar[id], english: index.corpus.en[id], focus: number === ayah })
  }
  return out
}
