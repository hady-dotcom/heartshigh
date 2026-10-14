/** Film-bar clock: 12:40, or 1:05:03 when a talk runs past an hour. */
export function filmClock(total: number) {
  const value = Math.max(0, Math.floor(total))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Hidden row: the time from the dot, never the question text. */
export function comingQuestionLabel(number: number, second: number) {
  return `Question ${number} comes at ${filmClock(second)}`
}

export function questionRowRevealed(input: { id: number; second: number; time: number; revealedIds: Iterable<number>; answered?: boolean }) {
  if (input.answered) return true
  if (input.time + 0.01 >= input.second) return true
  return new Set(input.revealedIds).has(input.id)
}

/** A learner may open or answer only after the film has reached that second. */
export function questionMomentReached(input: { second: number; time: number; answered?: boolean }) {
  if (input.answered) return true
  return input.time + 0.01 >= input.second
}

/**
 * An open question can be tapped early, which jumps the film to it.
 * A waiting or countdown question stays shut until the film reaches it, then opens so the learner can read why.
 */
export function questionDotLocked(input: { answered?: boolean; state: string; reached: boolean }) {
  if (input.answered || input.state === 'open') return false
  return !input.reached
}

export function comingAnswerLabel() {
  return 'Keep watching'
}

export function revealedStorageKey(lessonId: number) {
  return `hearts-revealed-${lessonId}`
}
