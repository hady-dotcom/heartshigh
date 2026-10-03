// The levels of a talk, each inside the one above it. The full talk (about an hour) holds the appetiser (about three
// minutes, which may be the hook, turn and land cuts), and the appetiser holds the hors d'oeuvre (15 to 30 seconds, or
// a slide). Typography films and cards are hors d'oeuvre level. Every level links up to the one above it in the same
// talk, and "Learn more" is the only way up.
//
// Progress: only the full talk watched inside a course, and that course's questions answered there, count towards
// course completion, the Garden and time given. Browsing short clips may fill the harvest and the "drawn to" lane
// interest on the device, which steers what comes next, and nothing else.

export type Level = 'hors' | 'appetiser' | 'full'

export const LEVELS: Level[] = ['hors', 'appetiser', 'full']

/** Anything that is not an appetiser or a full talk (a hors d'oeuvre, a slide, a typography film, a card) is hors level. */
export function levelOf(kind: string | null | undefined): Level {
  const key = String(kind || '').toLowerCase()
  if (key === 'appetiser' || key === 'extended') return 'appetiser'
  if (key === 'full' || key === 'main' || key === 'talk') return 'full'
  return 'hors'
}

export function parentLevel(level: Level): Level | null {
  return level === 'hors' ? 'appetiser' : level === 'appetiser' ? 'full' : null
}

/** Where "Learn more" leads from a feed item: its own appetiser in the feed, or its own talk in its course. */
export function learnMore(item: { cutId: number; courseId: number; lessonId: number }, level: Level, base: string) {
  if (level === 'hors') return { level: 'appetiser' as const, cutId: item.cutId, href: null }
  if (level === 'appetiser') return { level: 'full' as const, cutId: item.cutId, href: `${base}/course/${item.courseId}?part=${item.lessonId}&t=0` }
  return null
}

/** Share of the talk that has to play, in the course, before a sitting counts. */
export const COMPLETION_SHARE = 0.8

export type CompletionVerdict = { counts: true; percent: number } | { counts: false; reason: string }

/**
 * Whether a full-talk sitting counts. `watched` is the seconds that actually played in the course player, so a jump
 * to the end, or starting where the appetiser ended, does not stand in for watching. A talk with no known length
 * counts when it played through to its end.
 */
export function completionVerdict({ duration, watched, ended }: { duration: number; watched: number; ended: boolean }): CompletionVerdict {
  const seconds = Number.isFinite(watched) && watched > 0 ? watched : 0
  if (duration > 0) {
    const share = seconds / duration
    if (share < COMPLETION_SHARE) return { counts: false, reason: 'A sitting counts once most of the talk has played here in the course.' }
    return { counts: true, percent: Math.min(100, Math.round(share * 100)) }
  }
  if (ended && seconds > 0) return { counts: true, percent: 100 }
  return { counts: false, reason: 'A sitting counts once the talk has played through to its end here in the course.' }
}

/** An answer counts towards progress only when it was given in the course, not while browsing a short clip. */
export function answerCounts(answer: Record<string, unknown>) {
  return answer.cut === null || answer.cut === undefined || answer.cut === '' || answer.cut === 0
}

type Ref = number | { id: number } | null | undefined
const idOf = (value: Ref | unknown) => (typeof value === 'number' ? value : value && typeof value === 'object' && 'id' in value ? Number((value as { id: number }).id) : null)

/** A course's fruits: full talks completed, plus the course's questions answered in the course. */
export function courseProgress({ lessonIds, completions, pointIds, answers }: { lessonIds: number[]; completions: Record<string, unknown>[]; pointIds: number[]; answers: Record<string, unknown>[] }) {
  const doneLessons = new Set(completions.map((row) => idOf(row.lesson)).filter((id): id is number => id !== null && lessonIds.includes(id)))
  const answeredPoints = new Set(answers.filter(answerCounts).map((row) => idOf(row.point)).filter((id): id is number => id !== null && pointIds.includes(id)))
  return { doneLessons, answeredPoints, done: doneLessons.size + answeredPoints.size, total: lessonIds.length + pointIds.length }
}
