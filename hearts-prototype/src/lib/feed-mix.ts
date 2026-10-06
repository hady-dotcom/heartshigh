import { appendUnseenItems, catalogueRemainder } from '@/lib/feed-nav'
import type { FeedItem } from '@/server/learner'

/** Map routed slots to display clips. If the spine/D0 route is empty, use every clip this learner already has. */
export function clipsFromRoute(
  slots: { cutId: number; laneKey?: string | null }[],
  clips: Record<string, FeedItem>,
  laneTitles: Record<string, string> = {},
): FeedItem[] {
  const mapped: FeedItem[] = []
  for (const slot of slots) {
    const clip = clips[String(slot.cutId)]
    if (!clip) continue
    mapped.push(
      slot.laneKey
        ? { ...clip, laneKey: slot.laneKey, lane: slot.laneKey, laneLabel: laneTitles[slot.laneKey] || clip.laneLabel }
        : { ...clip, laneKey: null },
    )
  }
  if (mapped.length) return mapped
  return Object.values(clips)
}

/**
 * The routed batch is only the opening handful. The session keeps that order,
 * then every other real talk already in the catalogue. There is no length cap.
 */
export function sessionPlaylist(routed: FeedItem[], catalogue: FeedItem[] | Record<string, FeedItem>, visit = 0, backgroundsBaseUrl: string | null = null): FeedItem[] {
  const library = Array.isArray(catalogue) ? catalogue : Object.values(catalogue)
  const front = mixFeed(routed, visit, backgroundsBaseUrl)
  const more = catalogueRemainder(front, library)
  if (!more.length) return front
  return appendUnseenItems(front, mixFeed(more, visit, backgroundsBaseUrl))
}

/**
 * The learner feed is hors d'oeuvres only. Face films and scenic typing cards
 * used to follow each talk; they are not inserted, and any that arrive here are dropped.
 * `visit` and `backgroundsBaseUrl` stay on the signature so callers do not change.
 */
export function mixFeed(items: FeedItem[], _visit = 0, _backgroundsBaseUrl: string | null = null): FeedItem[] {
  const out: FeedItem[] = []
  const seenTalks = new Set<number>()
  for (const item of items) {
    if (item.card && item.card !== 'talk') continue
    if (seenTalks.has(item.cutId)) continue
    seenTalks.add(item.cutId)
    out.push(item)
  }
  return out
}
