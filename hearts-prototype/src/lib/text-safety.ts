// Checks for words that reach learners: kill-list matching that survives plurals, spacing tricks and look-alike
// letters, markup refusal, help-contact and portal-address validation. Plain module, no path aliases.

/** Letters from other scripts that look like Latin ones. NFKC handles full-width and most compatibility forms. */
const CONFUSABLES: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', і: 'i', ї: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ԛ: 'q', ԝ: 'w', ӏ: 'l', һ: 'h',
  α: 'a', β: 'b', ε: 'e', η: 'n', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', γ: 'y', ϲ: 'c', ϳ: 'j',
  ı: 'i', ɡ: 'g', ɑ: 'a', ʀ: 'r', ⅰ: 'i', ℓ: 'l', '０': '0',
}

const INVISIBLE = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g

/** NFKC, look-alike letters mapped to Latin, accents and invisible characters dropped, lower case. */
export function foldText(text: string) {
  return text
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .toLowerCase()
    .replace(/./gu, (char) => CONFUSABLES[char] ?? char)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`´]/g, "'")
}

/** Joins words spelt out with separators: "q-u-i-z", "q.u.i.z" and "q_u_i_z" become "quiz". */
function joinSpelledOut(text: string) {
  return text.replace(/\b[a-z](?:[.\-_*·•|/]+[a-z]\b){2,}/g, (run) => run.replace(/[^a-z]/g, ''))
}

/** Joins three or more single letters set apart by spaces: "q u i z" becomes "quiz". */
function joinSpacedLetters(text: string) {
  return text.replace(/(?<![a-z0-9'])[a-z](?:[\s.,\-_*·•|/]+[a-z](?![a-z0-9'])){2,}/g, (run) => run.replace(/[^a-z]/g, ''))
}

/**
 * Kill-list words caught by their start as well, so brand names and coinages built on them ("quizlet", "surveying",
 * "assessor", "diagnosis") are refused. Only applies when the list carries the word.
 */
const PREFIX_ROOTS: Record<string, string> = { quiz: 'quiz', survey: 'survey', assessment: 'assess', diagnostic: 'diagnos', archetype: 'archetyp', questionnaire: 'questionnair' }

/** Every reading of a word worth checking: as written, and with common English endings taken off. */
function stems(word: string) {
  const out = new Set([word])
  const undouble = (stem: string) => (/([b-df-hj-np-tv-z])\1$/.test(stem) ? stem.slice(0, -1) : stem)
  const add = (stem: string) => {
    if (stem.length < 2) return
    out.add(stem)
    out.add(undouble(stem))
  }
  // Stretched spellings: "quizz" and "quizzzz" read as "quiz", "testtt" as "test".
  if (/([a-z])\1/.test(word)) {
    add(word.replace(/([a-z])\1+/g, '$1'))
    add(word.replace(/([a-z])\1{2,}/g, '$1$1'))
  }
  if (word.endsWith("'s")) add(word.slice(0, -2))
  if (word.endsWith('ies')) add(`${word.slice(0, -3)}y`)
  if (word.endsWith('es')) add(word.slice(0, -2))
  if (word.endsWith('s') && !word.endsWith('ss')) add(word.slice(0, -1))
  if (word.endsWith('ing')) {
    add(word.slice(0, -3))
    add(`${word.slice(0, -3)}e`)
  }
  if (word.endsWith('ed')) {
    add(word.slice(0, -2))
    add(`${word.slice(0, -1)}`)
  }
  return [...out]
}

type Prepared = { phrase: string; words: string[] }

function prepare(list: string[]): Prepared[] {
  return list.map((entry) => {
    const phrase = foldText(entry).replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
    return { phrase, words: phrase.split(' ') }
  })
}

const cache = new WeakMap<string[], Prepared[]>()

/**
 * Kill-list words found in `text`. The text is folded (NFKC, look-alikes, accents, invisible characters), spelt-out
 * words are joined, punctuation is treated as a space, and each word is also tried without its plural or -ing/-ed
 * ending, so "quizzes", "scores", "testing", "q-u-i-z" and a Cyrillic "quіz" all match "quiz", "score" and "test".
 */
export function killHits(text: string, list: string[]) {
  let prepared = cache.get(list)
  if (!prepared) {
    prepared = prepare(list)
    cache.set(list, prepared)
  }
  const folded = joinSpelledOut(foldText(text.replace(/\*\*/g, '')))
  const variants = [folded.replace(/[^a-z0-9' ]+/g, ' '), folded.replace(/[-‐‑–]/g, '').replace(/[^a-z0-9' ]+/g, ' '), joinSpacedLetters(folded).replace(/[^a-z0-9' ]+/g, ' ')]
  const tokenSets = variants.map((variant) =>
    variant
      .split(/\s+/)
      .map((token) => token.replace(/^'+|'+$/g, ''))
      .filter(Boolean)
      .map(stems),
  )
  const hits = new Set<string>()
  for (const [index, entry] of prepared.entries()) {
    for (const tokens of tokenSets) {
      const size = entry.words.length
      for (let start = 0; start + size <= tokens.length; start++) {
        if (entry.words.every((word, offset) => tokens[start + offset].includes(word))) {
          hits.add(list[index])
          break
        }
      }
      if (hits.has(list[index])) break
    }
    const root = PREFIX_ROOTS[entry.phrase]
    if (root && !hits.has(list[index]) && tokenSets.some((tokens) => tokens.some((readings) => readings.some((reading) => reading.startsWith(root))))) hits.add(list[index])
  }
  return [...hits]
}

/** True when the text carries HTML, an entity, or a script URL. Learner-facing words are plain text only. */
export function hasMarkup(text: string) {
  // The event-handler check is a whole word, so a note such as conf=high is not read as code.
  return /<\s*\/?\s*[a-z!]|&(#\d+|#x[0-9a-f]+|[a-z]+);|javascript\s*:|data\s*:|vbscript\s*:|\bon[a-z]+\s*=/i.test(foldText(text))
}

export type HelpContactInput = { label?: string | null; phone?: string | null; url?: string | null; hours?: string | null }

/** Help contacts reach someone in crisis, so they are held to tel-safe numbers, https links and plain labels. */
export function helpContactProblems(contact: HelpContactInput) {
  const problems: string[] = []
  const label = (contact.label || '').trim()
  const phone = (contact.phone || '').trim()
  const url = (contact.url || '').trim()
  const hours = (contact.hours || '').trim()
  if (!label) problems.push('A help contact needs a name.')
  if (label.length > 120) problems.push('Keep the name of a help contact under 120 characters.')
  if ([label, phone, url, hours].some(hasMarkup)) problems.push('Help contacts are plain text: no HTML, script or code.')
  if (!phone && !url) problems.push('A help contact needs a phone number or a link.')
  if (phone && !/^\+?[0-9][0-9 ()-]{1,24}$/.test(phone)) problems.push('Use digits, spaces, brackets, dashes and an optional leading + for the phone number.')
  if (url) {
    let parsed: URL | null = null
    try {
      parsed = new URL(url)
    } catch {
      parsed = null
    }
    if (!parsed || parsed.protocol !== 'https:' || !parsed.hostname.includes('.')) problems.push('Help links must be full https:// addresses.')
  }
  if (hours.length > 80) problems.push('Keep the opening hours under 80 characters.')
  return problems
}

/** The address only when it is a well-formed https link, otherwise null. */
export function httpsHref(url: string | null | undefined) {
  if (!url) return null
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'https:' && !hasMarkup(url) ? parsed.toString() : null
  } catch {
    return null
  }
}

/** What to show for a contact field: tags and angle brackets removed, so stored markup reads as nothing. */
export function plainText(value: string | null | undefined) {
  return (value || '').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim()
}

/** The tel: target for a validated phone number: digits and a leading + only. */
export function telHref(phone: string) {
  const digits = phone.replace(/[^0-9+]/g, '').replace(/(?!^)\+/g, '')
  return digits ? `tel:${digits}` : null
}

/** Addresses the site itself uses, or that would read as the site's own pages, so no portal may take them. */
export const RESERVED_SLUGS = new Set([
  'admin', 'administrator', 'api', 'app', 'apps', 'assets', 'auth', 'cdn', 'dashboard', 'desk', 'favicon', 'feed', 'graphql', 'help', 'hearts', 'home', 'join',
  'login', 'logout', 'mail', 'master', 'media', 'new', 'next', '_next', 'p', 'portal', 'portals', 'public', 'register', 'robots', 'root', 'settings', 'signin',
  'sign-in', 'signout', 'sign-out', 'signup', 'sign-up', 'sitemap', 'start', 'static', 'status', 'support', 'system', 'test', 'www',
])

/** A plain-English reason the address cannot be used, or null when it can. */
export function slugProblem(slug: string) {
  if (!slug) return 'A portal needs a short address.'
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug)) return 'Use 3 to 40 lower-case letters, numbers or dashes for the address, starting and ending with a letter or number.'
  if (RESERVED_SLUGS.has(slug)) return `“${slug}” is reserved for the site itself. Choose another address, such as ${slug}-community.`
  return null
}
