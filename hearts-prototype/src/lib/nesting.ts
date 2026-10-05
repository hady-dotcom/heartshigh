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
export function completionVerdict({
  duration,
  watched,
  ended,
  media = 0,
}: {
  duration: number
  watched: number
  ended: boolean
  /** The length the player actually ran, when the lesson row overstates it. */
  media?: number
}): CompletionVerdict {
  const seconds = Number.isFinite(watched) && watched > 0 ? watched : 0
  const stored = Number.isFinite(duration) && duration > 0 ? duration : 0
  const played = Number.isFinite(media) && media > 0 ? media : 0
  const length = stored && played ? Math.min(stored, played) : stored || played
  if (length > 0) {
    const share = seconds / length
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

// Each piece also stores a parent reference (talk:<lesson>, appetiser:<id>), so a step can be checked on the server.
export type PieceLevel = 'hors' | 'appetiser' | 'talk'

export type PieceRef = {
  id: string
  level: PieceLevel
  /** Hors d'oeuvre -> its appetiser. Appetiser -> its full talk. A full talk has no parent. */
  parentId: string | null
  parentLevel: 'appetiser' | 'talk' | null
}

export type TalkChain = Record<PieceLevel, PieceRef>

/** Stable ids for the three pieces of one lesson. The hors d'oeuvre's parent is the appetiser, never the talk. */
export function talkChain(lessonId: number): TalkChain {
  const talk = `talk:${lessonId}`
  const appetiser = `appetiser:${lessonId}`
  const hors = `hors:${lessonId}`
  return {
    talk: { id: talk, level: 'talk', parentId: null, parentLevel: null },
    appetiser: { id: appetiser, level: 'appetiser', parentId: talk, parentLevel: 'talk' },
    hors: { id: hors, level: 'hors', parentId: appetiser, parentLevel: 'appetiser' },
  }
}

/** One step down. A hors d'oeuvre resolves to its appetiser, and that appetiser resolves to the full talk. */
export function descend(level: PieceLevel, lessonId: number): PieceRef | null {
  const chain = talkChain(lessonId)
  const piece = chain[level]
  if (!piece.parentId || !piece.parentLevel) return null
  return chain[piece.parentLevel]
}

export type LadderPiece = {
  id?: number
  kind?: string | null
  start?: number | null
  end?: number | null
}

/**
 * The parent reference written on a ladder row.
 * An appetiser points at the full talk. A hors d'oeuvre points at the appetiser that contains its window.
 */
export function ladderParentRef(piece: LadderPiece, appetisers: LadderPiece[], lessonId: number): string {
  if (piece.kind === 'appetiser') return `talk:${lessonId}`
  const start = Number(piece.start || 0)
  const end = Number(piece.end || 0)
  const containing = appetisers.find((row) => row.id && start >= Number(row.start || 0) - 1 && end <= Number(row.end || 0) + 1)
  const pick = containing || appetisers.find((row) => row.id)
  if (pick?.id) return `appetiser:${pick.id}`
  return talkChain(lessonId).hors.parentId as string
}

/** A learn-more step is valid only when it names this piece's own parent level. */
export function parentIsOwn(level: 'hors' | 'appetiser', parent: string): boolean {
  if (level === 'hors') return parent.startsWith('appetiser:')
  return parent.startsWith('talk:')
}
