export type LevelIntent = 'hors' | 'appetiser' | 'talk'

export type LevelTap = { intent: LevelIntent; at: number }

/**
 * A pointer-up and the click that follows it are one press.
 * A different level is always taken, so Clip then extract still switches on the second press.
 * The same level inside the window is the duplicate, not a new request, so it cannot cancel the first.
 */
export function acceptLevelTap(previous: LevelTap | null, tap: LevelTap, windowMs = 350) {
  if (!previous) return true
  if (previous.intent !== tap.intent) return true
  return tap.at - previous.at >= windowMs
}

export function levelAfterTaps(start: 'hors' | 'appetiser', taps: LevelTap[], windowMs = 350) {
  let level: 'hors' | 'appetiser' | 'talk' = start
  let previous: LevelTap | null = null
  const accepted: LevelTap[] = []
  for (const tap of taps) {
    if (!acceptLevelTap(previous, tap, windowMs)) continue
    previous = tap
    if (tap.intent === 'talk') {
      accepted.push(tap)
      level = 'talk'
      continue
    }
    if (level === tap.intent) continue
    accepted.push(tap)
    level = tap.intent
  }
  return { level, accepted }
}
