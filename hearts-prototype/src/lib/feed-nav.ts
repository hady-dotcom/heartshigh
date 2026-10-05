import { learnMore } from '@/lib/nesting'
import type { FeedItem } from '@/server/learner'

/**
 * Feed navigation keeps to one level. On clips (talk clips, typography films and scenic cards)
 * a swipe stays in the clip loop; on 3-minute versions, in that loop. Only the step-up goes down a level,
 * and only to the parent of the item being watched.
 */
export type FeedLevel = 'hors' | 'appetiser'
export type Swipe = 'topic' | 'speaker' | 'lane' | 'next' | 'prev'

type NavItem = Pick<FeedItem, 'id' | 'cutId' | 'lane' | 'speaker' | 'card' | 'courseId' | 'lessonId' | 'parents'>

/** Film, scene and text cards that follow a talk and share its cut. They live only at the clip level. */
export function isInterstitial(item: Pick<FeedItem, 'card'> | undefined) {
  return Boolean(item?.card && item.card !== 'talk')
}

/** Whether an item can be shown at this level. */
export function onLevel(item: NavItem | undefined, level: FeedLevel) {
  return Boolean(item) && (level === 'hors' || !isInterstitial(item))
}

export function itemKey(item: Pick<NavItem, 'cutId' | 'card'>) {
  return `${item.cutId}:${item.card || 'talk'}`
}

/** Session key: the same talk clip and its 3-minute version are different cards. */
export function cardKey(item: Pick<NavItem, 'cutId' | 'card'>, level: FeedLevel = 'hors') {
  return `${item.cutId}:${item.card || 'talk'}:${level}`
}

export function appendUnseenItems<T extends Pick<NavItem, 'cutId' | 'card' | 'id'>>(existing: T[], incoming: T[]) {
  const have = new Set(existing.map(itemKey))
  return [...existing, ...incoming.filter((row) => !have.has(itemKey(row)))]
}

/**
 * Real talks from the catalogue that this feed has not loaded yet.
 * A routed batch is only a handful of slots; the rest of the library stays available.
 */
export function catalogueRemainder<T extends Pick<NavItem, 'cutId' | 'card'>>(loaded: T[], catalogue: T[]): T[] {
  const have = new Set(loaded.map((row) => row.cutId))
  const out: T[] = []
  const added = new Set<number>()
  for (const row of catalogue) {
    if (isInterstitial(row) || have.has(row.cutId) || added.has(row.cutId)) continue
    added.add(row.cutId)
    out.push(row)
  }
  return out
}

function ring(length: number, from: number, step: 1 | -1) {
  return Array.from({ length: Math.max(0, length - 1) }, (_, offset) => (((from + step * (offset + 1)) % length) + length) % length)
}

/** The nearest index at or after `to`, in the direction of travel, that belongs on this level. */
export function settleOnLevel(list: NavItem[], to: number, level: FeedLevel, step: 1 | -1 = 1) {
  if (!list.length) return null
  let at = ((to % list.length) + list.length) % list.length
  for (let tries = 0; tries < list.length; tries++) {
    if (onLevel(list[at], level)) return at
    at = (((at + step) % list.length) + list.length) % list.length
  }
  return null
}

/**
 * Where a swipe lands, or null when there is nowhere else on this level. The level never changes:
 * topic, speaker and lane move to another talk; next and previous step through the loop, and the
 * appetiser loop passes over the cards that only exist as hors d'oeuvres.
 */
function unseenCard(list: NavItem[], at: number, level: FeedLevel, seen: ReadonlySet<string> | undefined) {
  const row = list[at]
  if (!row) return false
  if (!seen || !seen.size) return true
  if (seen.has(cardKey(row, level))) return false
  return !(level === 'hors' && seen.has(itemKey(row)))
}

export function swipeTarget(list: NavItem[], index: number, level: FeedLevel, swipe: Swipe, seen?: ReadonlySet<string>): number | null {
  const item = list[index]
  if (!item || list.length < 2) return null
  if (swipe === 'next' || swipe === 'prev') {
    const step = swipe === 'next' ? 1 : -1
    const order = ring(list.length, index, step)
    // Next still skips a card the learner has already been shown, then stops at the end of the pool.
    // Prev is one step back to the previous talk clip. It must not skip that clip for being seen,
    // and it must not stop on the scenic card that sits between two talks — that jump landed on
    // an older unseen speaker instead of the clip just left.
    if (swipe === 'prev') {
      return order.find((at) => onLevel(list[at], level) && (level !== 'hors' || !isInterstitial(list[at]))) ?? null
    }
    return order.find((at) => onLevel(list[at], level) && unseenCard(list, at, level, seen)) ?? null
  }
  const talks = ring(list.length, index, 1).filter((at) => list[at].cutId !== item.cutId && !isInterstitial(list[at]))
  const unused = talks.filter((at) => unseenCard(list, at, level, seen))
  if (swipe === 'topic') return unused.find((at) => list[at].lane === item.lane) ?? unused[0] ?? null
  // Same speaker first. If that person has no further talk, keep going through the rest of the real catalogue.
  if (swipe === 'speaker') return unused.find((at) => list[at].speaker === item.speaker) ?? unused[0] ?? null
  return unused.find((at) => list[at].lane !== item.lane) ?? unused[0] ?? null
}

export type LearnMoreStep =
  | { level: 'appetiser'; index: number; cutId: number }
  | { level: 'talk'; cutId: number; lessonId: number; href: string }

/**
 * Step-up from the item being watched: a clip (or one of its cards) opens its own 3-minute version,
 * and that version opens its own full talk. Never a neighbour's. Null when the item's parent is not the next level down.
 */
export function learnMoreTarget(list: NavItem[], index: number, level: FeedLevel, base: string): LearnMoreStep | null {
  const item = list[index]
  if (!item) return null
  if (level === 'hors') {
    const parent = item.parents?.hors
    if (parent && parent.parentLevel !== 'appetiser') return null
    const own = list.findIndex((row) => row.cutId === item.cutId && !isInterstitial(row) && row.lessonId === item.lessonId && row.speaker === item.speaker)
    return { level: 'appetiser', index: own >= 0 ? own : index, cutId: item.cutId }
  }
  const parent = item.parents?.appetiser
  if (parent && parent.parentLevel !== 'talk') return null
  const step = learnMore(item, 'appetiser', base)
  if (!step?.href) return null
  return { level: 'talk', cutId: item.cutId, lessonId: item.lessonId, href: step.href }
}

/** True when a step-up stays on this clip's own speaker and lesson. */
export function stepUpIsOwn(from: Pick<NavItem, 'speaker' | 'lessonId' | 'cutId'>, to: Pick<NavItem, 'speaker' | 'lessonId' | 'cutId'> | undefined) {
  return Boolean(to && to.cutId === from.cutId && to.speaker === from.speaker && to.lessonId === from.lessonId)
}
