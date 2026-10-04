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
  return line
}
