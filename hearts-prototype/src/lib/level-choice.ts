import { pieceSeconds } from '@/lib/feed-copy'

/** Said on the control, and again as a toast, when that level is not on this clip. */
export const NO_EXTRACT = 'This clip has no longer extract.'
export const NO_TALK = 'This clip has no full talk.'
export const NO_EXTRACT_LABEL = 'No extract'
export const NO_TALK_LABEL = 'No full talk'

type Piece = { start?: number; end?: number; spans?: { start?: number; end?: number }[]; lines?: { text?: string }[] }

export type LevelItem = {
  cutId: number
  lessonId?: number
  courseId?: number
  youtubeId?: string | null
  hors?: Piece | null
  appetiser?: Piece | null
  scenic?: { hook?: string; turn?: string; land?: string } | null
}

/** A longer extract is a real appetiser window, or scenic lines when the clip has no film. */
export function hasLongerExtract(item: LevelItem | null | undefined) {
  if (!item) return false
  if (!item.youtubeId) {
    const scenic = [item.scenic?.hook, item.scenic?.turn, item.scenic?.land].map((line) => String(line || '').trim()).filter(Boolean)
    return scenic.length >= 2
  }
  const longer = pieceSeconds(item.appetiser)
  const clip = pieceSeconds(item.hors)
  if (longer == null || clip == null) return false
  return longer > clip + 1
}

/** The full talk is this clip's own lesson inside its course. */
export function hasFullTalk(item: LevelItem | null | undefined) {
  if (!item) return false
  const courseId = Number(item.courseId)
  const lessonId = Number(item.lessonId)
  return Number.isFinite(courseId) && courseId > 0 && Number.isFinite(lessonId) && lessonId > 0
}

export type LevelSwitchPlan =
  | { kind: 'stay' }
  | { kind: 'say'; message: string }
  | { kind: 'switch'; level: 'hors' | 'appetiser'; cutId: number; lessonId: number }
  | { kind: 'talk'; cutId: number; lessonId: number }

/**
 * What a level tap should do. The clip on screen wins over the playlist index:
 * after a swipe those two can disagree, and the tap must follow the one playing.
 */
export function levelSwitchPlan(input: {
  shown: LevelItem | null | undefined
  indexed: LevelItem | null | undefined
  intent: 'hors' | 'appetiser' | 'talk'
  mode: 'hors' | 'appetiser'
}): LevelSwitchPlan {
  const item = input.shown ?? input.indexed
  if (!item) return { kind: 'say', message: input.intent === 'talk' ? NO_TALK : NO_EXTRACT }
  const lessonId = Number(item.lessonId) || 0
  if (input.intent === 'hors') {
    if (input.mode === 'hors') return { kind: 'stay' }
    return { kind: 'switch', level: 'hors', cutId: item.cutId, lessonId }
  }
  if (input.intent === 'appetiser') {
    if (!hasLongerExtract(item)) return { kind: 'say', message: NO_EXTRACT }
    if (input.mode === 'appetiser') return { kind: 'stay' }
    return { kind: 'switch', level: 'appetiser', cutId: item.cutId, lessonId }
  }
  if (!hasFullTalk(item)) return { kind: 'say', message: NO_TALK }
  return { kind: 'talk', cutId: item.cutId, lessonId }
}
