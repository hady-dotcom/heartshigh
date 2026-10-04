/** Sentence tidying for words shown out of their transcript: scenic beats, harvest lines and notices. */

const END = /[.?!…]["”’')\]]*$/
// No lookbehind: older iOS Safari cannot parse it, and this runs in the feed.
const BREAK = /([.?!…]["”’')\]]*)\s+(?=["“‘(]?[A-Z0-9\u0600-\u06FF])/g
const words = (text: string) => text.split(/\s+/).filter(Boolean).length

/** Asides that are about the video, not the teaching. */
export const ASIDE = /\b(description|subscribe|housekeeping|like and share|patreon|sponsors?|notification bell|comment below|thanks for watching|thank you for watching|link in the description|full dua|link below|pinned comment|paraphrasing|inaudible|in the comments)\b|\[(music|applause|laughter)\]/i

export function isAside(text: string) {
  return ASIDE.test(text)
}

export function endsSentence(text: string) {
  return END.test(text.trim())
}

/** Cut at a word boundary and mark the cut. Never ends mid-word. */
export function clipWords(text: string, max: number) {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max + 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.5 ? cut.slice(0, space) : flat.slice(0, max)).replace(/[\s,;:.\-–—]+$/, '')}…`
}

/** Words a finished thought does not end on: prepositions, conjunctions, articles, and words that need what follows. */
const DANGLING = new Set(
  'a an the and or but nor so yet for of in on at to from with without by about as into onto upon than that which who whom whose if because when while whereas although though unless until except amongst among between like such his her their our my your its this these those is are was were be been being am will would shall should can could may might must do does did have has had very more most not no'.split(' '),
)

/** True when the last word leaves the thought hanging ("…a light for.", "…befalls you except."). */
export function endsDangling(text: string) {
  const last = text.replace(/[\s.?!…,;:"“”‘’'()\[\]\-–—]+$/u, '').split(/\s+/).pop() || ''
  return DANGLING.has(last.toLowerCase())
}

/** Allah, the Quran and the Prophet written properly, wherever the captions lower-cased them. */
export function properNames(text: string) {
  return text
    .replace(/\ballah\b/g, 'Allah')
    .replace(/\b(?:qur'?an|qur’an|koran)\b/gi, 'Quran')
    .replace(/\bthe prophet\b(?!s\b)/g, 'the Prophet')
    .replace(/\b(oh|o|ya) Allah\b/gi, (_, call: string) => `${call[0].toUpperCase()}${call.slice(1).toLowerCase()} Allah`)
}

/** Drop hanging words from the end of a cut, so it never stops on "of", "the" or "in". */
function trimDangling(text: string) {
  let line = text.replace(/[\s,;:\-–—…]+$/, '')
  while (endsDangling(line) && words(line) > 1) line = line.replace(/\s*\S+$/, '').replace(/[\s,;:\-–—]+$/, '')
  return line
}

/**
 * One beat of a scenic card: at most two sentences and about `maxWords` words. A run-on is cut at a clause
 * break (or a word) and marked with an ellipsis, and the line never ends on a hanging word.
 */
export function beatLine(text: string, { maxWords = 30, maxSentences = 2 }: { maxWords?: number; maxSentences?: number } = {}) {
  const whole = wholeSentences(text, { minWords: 3 })
  if (!whole) return ''
  const pieces = whole.replace(BREAK, '$1\n').split('\n').map((piece) => piece.trim()).filter(Boolean)
  const kept: string[] = []
  for (const piece of pieces.slice(0, maxSentences)) {
    if (kept.length && words([...kept, piece].join(' ')) > maxWords) break
    kept.push(piece)
  }
  let line = kept.join(' ')
  if (!kept.length || words(line) > maxWords) {
    const head = (kept[0] || pieces[0]).split(/\s+/).slice(0, maxWords).join(' ')
    const clause = head.match(/^(.*[,;:—–])\s/)
    const cut = clause && words(clause[1]) >= Math.min(12, maxWords / 2) ? clause[1] : head
    line = `${trimDangling(cut)}…`
  } else if (endsDangling(line)) {
    line = `${trimDangling(line)}…`
  }
  return words(line) >= 3 ? line : ''
}

/**
 * Whole sentences only. The tail of the sentence before ("…Judgment. The Prophet…") and the start of the
 * next ("…day of Judgment. The") are dropped, the first letter is a capital, and the line ends on a stop.
 * `maxChars` keeps the first sentences that fit (always at least one). Returns '' when nothing whole is left.
 */
export function wholeSentences(text: string, { maxChars = Infinity, minWords = 3 }: { maxChars?: number; minWords?: number } = {}) {
  let pieces = text.replace(/\s+/g, ' ').trim().replace(BREAK, '$1\n').split('\n').map((piece) => piece.trim()).filter(Boolean)
  // A short unfinished tail is the next sentence starting; a long one is a sentence the captions left unpunctuated.
  if (pieces.length > 1 && !END.test(pieces[pieces.length - 1]) && words(pieces[pieces.length - 1]) <= 3) pieces = pieces.slice(0, -1)
  if (pieces.length > 1 && (/^[a-z]/.test(pieces[0]) || words(pieces[0]) <= 3)) pieces = pieces.slice(1)
  const first = pieces[0] || ''
  if (/^[a-z]/.test(first) && pieces.length === 1 && words(first) < minWords) return ''
  const kept: string[] = []
  let length = 0
  for (const piece of pieces) {
    if (kept.length && length + piece.length + 1 > maxChars) break
    kept.push(piece)
    length += piece.length + 1
  }
  let line = kept.join(' ').replace(/^[\s,;:.\-–—…]+/, '')
  if (words(line) < minWords) return ''
  line = line.replace(/^(["“‘(]?)(\p{Ll})/u, (_, open: string, letter: string) => `${open}${letter.toUpperCase()}`)
  if (!END.test(line)) line = `${line.replace(/[\s,;:\-–—]+$/, '')}.`
  return properNames(line)
}
