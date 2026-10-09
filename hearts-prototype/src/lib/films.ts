import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { filesForTalk, readTypographyManifest, TYPOGRAPHY_STYLES } from '@/lib/typography'
import type { SlideStyle } from '@/server/learner'

/** The prophet face films stay out of the feed until those clips arrive. */
const HELD_BACK = new Set(['TLCGBj4AlB0'])

export { mixFeed } from './feed-mix'

export type BeatFilm = { beat: 'hook' | 'turn' | 'land'; style: SlideStyle; src: string; quote: string }

type StoredFilm = BeatFilm & {
  youtubeId: string
  title?: string
  speaker?: string
  course?: string
  start?: number
  end?: number
  face?: boolean
}

const BEATS = new Set(['hook', 'turn', 'land'])
const STYLES = new Set(['kinetic', 'windows', 'conversation', 'cinema', 'unfold'])
const ORDER = { hook: 0, turn: 1, land: 2 }

export function readFilmCatalogue(root = process.cwd()): { films: StoredFilm[] } {
  const file = path.join(root, 'public', 'typography', 'films.json')
  if (!existsSync(file)) return { films: [] }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { films?: StoredFilm[] }
    const films = (parsed.films || []).filter((row) => row && row.youtubeId && BEATS.has(row.beat) && STYLES.has(row.style) && row.src && row.quote && row.face !== false)
    return { films }
  } catch {
    return { films: [] }
  }
}

function renderedStyles(youtubeId: string): BeatFilm[] {
  if (HELD_BACK.has(youtubeId)) return []
  const talk = filesForTalk(readTypographyManifest(), youtubeId, '')
  if (!talk) return []
  return TYPOGRAPHY_STYLES.flatMap((style) => {
    const src = talk.styles[style]
    if (!src || !existsSync(path.join(process.cwd(), 'public', src))) return []
    return [{ beat: 'hook' as const, style, src, quote: talk.title }]
  })
}

export function filmsForTalk(catalogue: { films: StoredFilm[] }, youtubeId: string | null | undefined): BeatFilm[] {
  const id = (youtubeId || '').trim()
  if (!id) return []
  const listed = catalogue.films
    .filter((row) => row.youtubeId === id)
    .sort((a, b) => ORDER[a.beat] - ORDER[b.beat])
    .map((row) => ({ beat: row.beat, style: row.style, src: row.src, quote: row.quote }))
  return listed.length ? listed : renderedStyles(id)
}
