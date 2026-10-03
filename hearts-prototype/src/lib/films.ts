import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { FeedItem, SlideStyle } from '@/server/learner'

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

export function filmsForTalk(catalogue: { films: StoredFilm[] }, youtubeId: string | null | undefined): BeatFilm[] {
  const id = (youtubeId || '').trim()
  if (!id) return []
  return catalogue.films
    .filter((row) => row.youtubeId === id)
    .sort((a, b) => ORDER[a.beat] - ORDER[b.beat])
    .map((row) => ({ beat: row.beat, style: row.style, src: row.src, quote: row.quote }))
}

/**
 * After each talk, add its film, the line, and a question. The order of those three
 * changes with `visit`, so a return visit is not the same sequence. The talk stays first.
 */
export function mixFeed(items: FeedItem[], visit = 0): FeedItem[] {
  const out: FeedItem[] = []
  items.forEach((item, index) => {
    out.push(item)
    if (item.card && item.card !== 'talk') return
    const films = item.films || []
    if (!films.length) return
    const film = films[Math.abs(visit + index) % films.length]
    const filmCard: FeedItem = { ...item, id: `film-${item.cutId}`, card: 'film', film, typography: { style: film.style, inPlace: true, src: film.src } }
    const textCard: FeedItem = { ...item, id: `text-${item.cutId}`, card: 'text', film }
    const questionCard: FeedItem = { ...item, id: `question-${item.cutId}`, card: 'question', film, prompt: 'What stays with you from this?' }
    const pattern = Math.abs(visit + index) % 3
    const extras = pattern === 0 ? [filmCard, textCard, questionCard] : pattern === 1 ? [textCard, filmCard, questionCard] : [questionCard, filmCard, textCard]
    out.push(...extras)
  })
  return out
}
