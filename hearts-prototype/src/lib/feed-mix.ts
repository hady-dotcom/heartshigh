import { CATALOGUE, backgroundSrc, pickBackground, type Background } from '@/lib/backgrounds'
import { appendUnseenItems, catalogueRemainder } from '@/lib/feed-nav'
import { pickScene } from '@/lib/scenes'
import { beatLine } from '@/lib/sentences'
import type { FeedItem, SlideStyle } from '@/server/learner'

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

type CardBeat = NonNullable<FeedItem['beats']>[number]

const STYLE_LIST = ['kinetic', 'windows', 'conversation', 'cinema', 'unfold'] as const

function pickStyle(index: number, visit: number, previous: string, base = 0): SlideStyle {
  let at = (base + visit + index) % STYLE_LIST.length
  if (STYLE_LIST[at] === previous) at = (at + 1) % STYLE_LIST.length
  return STYLE_LIST[at]
}

/** Every beat, voiced or not, is at most two sentences and about 30 words, and never stops on a hanging word. */
function beatsOf(item: FeedItem): CardBeat[] {
  if (item.beats?.length) return item.beats.map((row) => ({ ...row, quote: beatLine(row.quote || '') || row.quote })).filter((row) => row.quote)
  return (['hook', 'turn', 'land'] as const)
    .map((beat) => ({ beat, quote: beatLine(item[beat] || ''), gold: '', audio: null }))
    .filter((row) => row.quote)
}

/**
 * After each talk, a face film or a scenic card. Questions stay inside the full talk.
 * Face films and cards alternate through the session. A return visit swaps which
 * one a talk leads with, and steps the card's style.
 * Without BACKGROUNDS_BASE_URL the six local stills are used, and a shared tag steps on.
 * With the bucket URL, the card's stored catalogue still is used. A neighbour that
 * shares landscape, palette or time steps on. The step-up always opens this clip's own 3-minute version.
 */
export function mixFeed(items: FeedItem[], visit = 0, backgroundsBaseUrl: string | null = null): FeedItem[] {
  const out: FeedItem[] = []
  let previousStyle = ''
  let previousScene: { id: string; tags: readonly string[] } | null = null
  let previousBackground: Background | null = null
  const base = (backgroundsBaseUrl || '').trim()
  const talks = items.filter((item) => !item.card || item.card === 'talk')
  const seenTalks = new Set<number>()
  talks.forEach((item, index) => {
    if (seenTalks.has(item.cutId)) return
    seenTalks.add(item.cutId)
    out.push(item)
    const films = item.films || []
    const showFilm = films.length > 0 && Math.abs(visit + index) % 2 === 0
    const questionFilm = films[Math.abs(visit + index) % films.length]
    if (showFilm && questionFilm) {
      previousStyle = questionFilm.style
      out.push({ ...item, id: `film-${item.cutId}`, card: 'film', film: questionFilm, typography: { style: questionFilm.style, inPlace: true, src: questionFilm.src } })
    } else {
      const beats = beatsOf(item)
      if (beats.length) {
        const styleBase = Math.max(0, STYLE_LIST.indexOf((item.cardStyle || 'kinetic') as (typeof STYLE_LIST)[number]))
        const style = pickStyle(index, visit, previousStyle, styleBase)
        previousStyle = style
        const local = pickScene(item.cardScene || 'road', 0, previousScene)
        previousScene = local
        const chosen = base && CATALOGUE.length ? pickBackground(CATALOGUE, item.cardBackground || index, previousBackground) : null
        if (chosen) previousBackground = chosen
        out.push({
          ...item,
          id: `scene-${item.cutId}`,
          card: 'scene',
          scene: {
            style,
            scene: (chosen && backgroundSrc(chosen.file, base)) || local.src,
            destination: 'clip',
            beats,
            brightness: chosen?.brightness || null,
          },
        })
      }
    }
  })
  return out
}
