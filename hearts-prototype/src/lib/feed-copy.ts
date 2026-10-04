// Learner-facing words for the three levels. Internal names (hors, appetiser) never appear on screen.

export const LEVEL_WORDS = ['clip', '3-minute version', 'full talk'] as const
export const READY_FOR_MORE = 'Ready for more?'

export function clipStepUpLabel() {
  return 'Watch the 3-minute version'
}

export function talkMinutes(seconds: number | null | undefined) {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.max(1, Math.ceil(value / 60))
}

export function talkStepUpLabel(talks: number, seconds?: number | null) {
  const count = Math.max(1, Math.round(talks) || 1)
  if (count > 1) return `See the whole course (${count} talks)`
  const minutes = talkMinutes(seconds)
  return minutes ? `Watch the whole talk (${minutes} min)` : 'Watch the whole talk'
}

/** Keep (N min) / (N talks) when a calendar or experiment line replaces only the lead words. */
export function withTalkDetail(lead: string, talks: number, seconds?: number | null) {
  const cleaned = String(lead || '').trim()
  const detail = talkStepUpLabel(talks, seconds)
  const extra = detail.match(/\((\d+\s+(?:min|talks))\)/)?.[0] || ''
  if (!cleaned) return detail
  if (!extra || /\(\d+\s+(?:min|talks)\)/i.test(cleaned)) return cleaned
  return /›\s*$/.test(cleaned) ? `${cleaned.replace(/\s*›\s*$/, '')} ${extra} ›` : `${cleaned} ${extra}`
}

export function onlyClipToast(level: 'hors' | 'appetiser') {
  return level === 'hors' ? "That's the only clip here for now." : "That's the only 3-minute version here for now."
}

export function poolEndToast() {
  return "You've seen everything here, try another lane."
}

export function forbiddenLearnerWords(text: string) {
  return /\bLearn more\b|\bExtended cut\b|\bAppetiser\b|\bAppetizers?\b|\bhors d['’]oeuvre/i.test(text)
}
