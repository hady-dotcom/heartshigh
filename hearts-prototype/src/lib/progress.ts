// Course completion and the grow page count only full talks that sit inside a course, plus the questions on those talks.
// A hors d'oeuvre or an appetiser never counts. Browsing one fills the harvest and a drawn-to speaker signal.

import type { HarvestHit } from './harvest'
import { parseTimestamp } from './transcript'

export type PieceLevel = 'hors' | 'appetiser' | 'talk'
export type ProgressEvent = 'watch' | 'question'

export function pieceLevel(value: unknown): PieceLevel {
  return value === 'hors' || value === 'appetiser' ? value : 'talk'
}

export function countsTowardProgress(input: { level: PieceLevel; inCourse: boolean; event: ProgressEvent }): boolean {
  if (input.level !== 'talk') return false
  if (!input.inCourse) return false
  return input.event === 'watch' || input.event === 'question'
}

export function shortFormEffect(level: PieceLevel): { harvest: boolean; drawnTo: boolean; completion: false; grow: false } {
  const short = level === 'hors' || level === 'appetiser'
  return { harvest: short, drawnTo: short, completion: false, grow: false }
}

export type DrawnSignal = { speakerSlug: string; linger: number; learnMore: number }

/** Linger means the learner stayed with the clip. Learn more means they stepped down to its parent. */
export function applyDrawnTo(rows: DrawnSignal[], speakerSlug: string, event: 'linger' | 'learn-more'): DrawnSignal[] {
  const slug = speakerSlug.trim()
  if (!slug) return rows.map((row) => ({ ...row }))
  const next = rows.map((row) => ({ ...row }))
  const found = next.find((row) => row.speakerSlug === slug)
  if (!found) {
    next.push({ speakerSlug: slug, linger: event === 'linger' ? 1 : 0, learnMore: event === 'learn-more' ? 1 : 0 })
    return next
  }
  if (event === 'linger') found.linger += 1
  else found.learnMore += 1
  return next
}

/** Quotes whose timestamp sits inside the short clip, so browsing it can fill the harvest without finishing the talk. */
export function harvestInWindow(hits: HarvestHit[], start: number, end: number): HarvestHit[] {
  if (!(end > start)) return []
  return hits.filter((hit) => {
    const at = parseTimestamp(hit.timestamp || '')
    return at != null && at >= start - 1 && at <= end + 1
  })
}

export function keepForProgress<T extends { sourceLevel?: unknown; inCourse: boolean }>(rows: T[], event: ProgressEvent): T[] {
  return rows.filter((row) => countsTowardProgress({ level: pieceLevel(row.sourceLevel), inCourse: row.inCourse, event }))
}
