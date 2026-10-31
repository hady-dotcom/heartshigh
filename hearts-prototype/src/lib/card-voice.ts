import { withoutStutters } from './typography/lines'

export type SpokenWord = { text: string; at: number }

/** Drop a repeated spoken word. The later one stays, so the line is not early. */
export function cleanSpokenQuote(quote: string) {
  const words = quote.split(/\s+/).filter(Boolean).map((text) => ({ text }))
  return withoutStutters(words).map((word) => word.text).join(' ')
}

/** When a beat has no word times, spread the line across its duration. Nothing is early. */
export function spreadWords(quote: string, duration: number): SpokenWord[] {
  const words = quote.split(/\s+/).filter(Boolean)
  const span = Math.max(0.4, duration)
  if (!words.length) return []
  return words.map((text, index) => ({ text, at: (span * index) / words.length }))
}

export function wordsDue(words: SpokenWord[], elapsed: number) {
  return words.filter((word) => word.at <= elapsed + 1e-3)
}

export function revealedQuote(words: SpokenWord[], elapsed: number) {
  return wordsDue(words, elapsed).map((word) => word.text).join(' ')
}

/**
 * The gold phrase, or the part of it already spoken.
 * A word of the phrase is gold only once it is on screen.
 */
export function landedGold(shown: string, gold: string) {
  if (!gold || !shown) return ''
  const hay = shown.toLowerCase()
  if (hay.includes(gold.toLowerCase())) return gold
  const parts = gold.split(/\s+/).filter(Boolean)
  let built = ''
  for (const part of parts) {
    const next = built ? `${built} ${part}` : part
    if (!hay.includes(next.toLowerCase())) break
    built = next
  }
  return built
}
