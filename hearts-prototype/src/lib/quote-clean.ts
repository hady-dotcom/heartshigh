/**
 * Learner-facing quotes: Allah, I, the Prophet ﷺ, sentence punctuation, single quotes.
 * Used on import and at render. Does not write to the database.
 */

const STOP = /[.?!…]["”'’)]*$/

export function cleanQuote(raw: string): string {
  let text = String(raw || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  text = text.replace(/[“”]/g, "'").replace(/[‘’]/g, "'")
  text = text.replace(/\ballah\b/gi, 'Allah')
  text = text.replace(/\bthe prophet\b(?!s\b)/gi, 'the Prophet')
  text = text.replace(/\bthe Prophet(?!\s*ﷺ)/g, 'the Prophet ﷺ')
  text = text.replace(/\bi\b/g, 'I')
  text = text.replace(/\bI'(m|ve|ll|d)\b/g, "I'$1")
  text = text.replace(/^(["']?)(\p{Ll})/u, (_, open: string, letter: string) => `${open}${letter.toUpperCase()}`)
  if (!STOP.test(text)) {
    const isQuestion = /^(who|what|when|where|why|how|did|do|does|is|are|was|were|can|could|would|should|have|has|will)\b/i.test(text.replace(/^['"]/, ''))
    text = `${text.replace(/[\s,;:]+$/, '')}${isQuestion ? '?' : '.'}`
  }
  text = text.replace(/([.?!])(["'])\s*$/, '$2$1')
  text = text.replace(/(['"])([^'"]+)([.?!])\1/g, "'$2$3'")
  return text
}

export function quoteNeedsClean(raw: string) {
  const cleaned = cleanQuote(raw)
  return cleaned !== String(raw || '').replace(/\s+/g, ' ').trim()
}
