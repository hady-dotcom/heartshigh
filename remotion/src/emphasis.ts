import { isVerbatim, type BeatId } from './timing'

/** The words that carry the beat. Everything else stays small and quick. */
export const EMPHASIS: Record<string, Partial<Record<BeatId, string[]>>> = {
  ECaTWkof57E: {
    hook: ['never thought'],
    turn: ['certainty', "Allah's plan is real"],
    land: ['know this name'],
  },
  NIR88RRpat4: {
    hook: ['only source', 'clarity'],
    turn: ['dark'],
    land: ['this verse'],
  },
}

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'in', 'on', 'at', 'to', 'for', 'of', 'as', 'is', 'it', 'its', "it's", 'be', 'was', 'were', 'are', 'am',
  'been', 'being', 'that', 'these', 'those', 'you', 'your', 'we', 'our', 'they', 'their', 'he', 'she', 'his', 'her', 'i', 'me', 'my', 'with', 'from',
  'by', 'not', 'so', 'than', 'then', 'there', 'here', 'what', 'when', 'where', 'who', 'how', 'which', 'into', 'over', 'about', 'just', 'have', 'has',
  'had', 'got', 'get', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'us', 'them', 'him', "that's", 'thats', "we're", 'were', "don't",
])

const token = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '')

/** Gold phrases from the quote itself: a landing at the end, and one earlier stress when the line is long enough. */
export function chooseKeyPhrases(quote: string): string[] {
  const words = quote.split(/\s+/).filter(Boolean)
  const content = words
    .map((word, index) => ({ index, bare: token(word) }))
    .filter((row) => row.bare.length >= 3 && !STOP.has(row.bare))
  if (!content.length) {
    const last = words[words.length - 1]?.replace(/[.,!?]+$/g, '')
    return last ? [last] : []
  }
  const last = content[content.length - 1].index
  let from = last
  let taken = 1
  for (let index = last - 1; index >= 0 && taken < 3 && last - index <= 4; index--) {
    const piece = token(words[index])
    if (!piece) break
    const demonstrative = piece === 'this' || piece === 'that'
    if (STOP.has(piece) && !demonstrative) {
      if (taken >= 2) break
      continue
    }
    if (demonstrative && taken >= 2) break
    from = index
    if (!STOP.has(piece)) taken += 1
  }
  while (from < last && STOP.has(token(words[from]))) from += 1
  const landing = words.slice(from, last + 1).join(' ').replace(/[.,!?]+$/g, '')
  const phrases = [landing]
  const earlier = [...content].reverse().find((row) => row.index < from - 1)
  if (earlier) {
    const before = [...content].reverse().find((row) => row.index < earlier.index && earlier.index - row.index <= 2)
    const start = before ? before.index : earlier.index
    const phrase = words.slice(start, earlier.index + 1).join(' ').replace(/[.,!?]+$/g, '')
    if (phrase && !landing.toLowerCase().includes(phrase.toLowerCase())) phrases.unshift(phrase)
  }
  return phrases.filter((phrase) => phrase.split(/\s+/).length < Math.max(words.length, 1))
}

/** Editorial phrases win when they still sit inside the quote. Otherwise the line chooses its own. */
export function keyPhrasesFor(id: string, beat: BeatId, quote: string) {
  const editorial = (EMPHASIS[id]?.[beat] || []).filter((phrase) => isVerbatim(phrase, quote))
  return editorial.length ? editorial : chooseKeyPhrases(quote)
}

export function phraseSpans(words: { text: string }[], phrases: string[]) {
  const spans: { phrase: string; from: number; to: number }[] = []
  const used = new Set<number>()
  for (const phrase of phrases) {
    const want = phrase.split(/\s+/).map(token).filter(Boolean)
    if (!want.length) continue
    for (let start = 0; start <= words.length - want.length; start++) {
      const fits = want.every((piece, offset) => !used.has(start + offset) && token(words[start + offset].text) === piece)
      if (!fits) continue
      want.forEach((_, offset) => used.add(start + offset))
      spans.push({ phrase, from: start, to: start + want.length - 1 })
      break
    }
  }
  return spans
}
