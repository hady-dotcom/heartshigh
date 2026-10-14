import { formatTimestamp, parseTranscript } from './transcript'

/** Leon's rule: every source talk is at least five minutes. Clips cut from a talk may be shorter. */
export const MIN_TALK_SECONDS = 300

export const EMPTY_SHORT_COURSE_NOTE = 'Hidden because every talk is under 5 minutes.'

/** A known length under five minutes. Unknown and zero stay out of the rule. Exactly five minutes is allowed. */
export function isUnderMinTalk(seconds: number | null | undefined) {
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 && seconds < MIN_TALK_SECONDS
}

/** `1:04` for 64 seconds. Minutes are not padded; seconds are. */
export function talkClock(seconds: number) {
  return formatTimestamp(seconds)
}

/** The plain refusal. `64` becomes "This talk is 1:04. Talks need to be at least 5 minutes." */
export function tooShortMessage(seconds: number) {
  return `This talk is ${talkClock(seconds)}. Talks need to be at least 5 minutes.`
}

export function refusalForTalk(seconds: number | null | undefined) {
  if (!isUnderMinTalk(seconds)) return null
  return tooShortMessage(Math.round(seconds as number))
}

/** Last real cue in a timed transcript. A plain file with guessed times is not a length. */
export function transcriptEndSeconds(raw: string | null | undefined) {
  if (!raw || !raw.trim()) return null
  const parsed = parseTranscript(raw)
  if (!parsed.timed || !parsed.cues.length) return null
  const end = parsed.cues.reduce((max, cue) => Math.max(max, cue.end), 0)
  return end > 0 ? Math.round(end) : null
}

/**
 * YouTube's published length when we have one. Otherwise the transcript's last cue.
 * A stated length of zero is treated as missing so the transcript can answer.
 */
export function sourceTalkSeconds(input: { durationSeconds?: number | null; transcript?: string | null }) {
  const stated = Number(input.durationSeconds)
  if (Number.isFinite(stated) && stated > 0) return Math.round(stated)
  return transcriptEndSeconds(input.transcript)
}

export type TalkHideRow = {
  id: number
  courseId: number
  durationSeconds: number | null
  tooShort: boolean
  shortWaived: boolean
}

/** Talks the marker should hide. A restored talk (shortWaived) stays visible. */
export function talksToHide(lessons: TalkHideRow[]) {
  return lessons.filter((lesson) => isUnderMinTalk(lesson.durationSeconds) && !lesson.shortWaived && !lesson.tooShort)
}

/** Courses whose every talk is hidden for length. A course with no talks is left as it is. */
export function coursesEmptiedByShortTalks(lessons: TalkHideRow[]) {
  const byCourse = new Map<number, { total: number; hidden: number }>()
  for (const lesson of lessons) {
    if (!lesson.courseId) continue
    const row = byCourse.get(lesson.courseId) || { total: 0, hidden: 0 }
    row.total += 1
    const hidden = lesson.tooShort || (isUnderMinTalk(lesson.durationSeconds) && !lesson.shortWaived)
    if (hidden) row.hidden += 1
    byCourse.set(lesson.courseId, row)
  }
  return [...byCourse.entries()].filter(([, row]) => row.total > 0 && row.hidden === row.total).map(([id]) => id)
}
