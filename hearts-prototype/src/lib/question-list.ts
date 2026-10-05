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

export function revealedStorageKey(lessonId: number) {
  return `hearts-revealed-${lessonId}`
}
