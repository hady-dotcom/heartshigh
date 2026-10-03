import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { keyPhrasesFor } from '../../../remotion/src/emphasis'
import type { ManifestRow, StyleId } from '../../../remotion/src/manifest'
import { assignStyles } from '../../../remotion/src/manifest'
import { pickScene, SCENES, sceneById, type SceneId } from './scenes'

export type CardBeat = {
  beat: 'hook' | 'turn' | 'land'
  quote: string
  gold: string
  audio: string | null
}

export type StoredCard = {
  youtubeId: string
  title: string
  speaker: string
  course: string
  style: StyleId
  scene: SceneId
  beats: CardBeat[]
}

const ORDER = { hook: 0, turn: 1, land: 2 }
const BEATS = new Set(['hook', 'turn', 'land'])
const STYLES = new Set(['kinetic', 'windows', 'conversation', 'cinema', 'unfold'])

export function cardCataloguePath(root = process.cwd()) {
  return path.join(root, 'public', 'typography', 'cards.json')
}

export function readCardCatalogue(root = process.cwd()): { cards: StoredCard[] } {
  const file = cardCataloguePath(root)
  if (!existsSync(file)) return { cards: [] }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { cards?: StoredCard[] }
    const cards = (parsed.cards || []).filter((row) => row && row.youtubeId && STYLES.has(row.style) && SCENES.some((scene) => scene.id === row.scene) && Array.isArray(row.beats) && row.beats.length)
    return { cards }
  } catch {
    return { cards: [] }
  }
}

export function cardForTalk(catalogue: { cards: StoredCard[] }, youtubeId: string | null | undefined) {
  const id = (youtubeId || '').trim()
  if (!id) return null
  return catalogue.cards.find((row) => row.youtubeId === id) || null
}

function audioSrc(heartsRoot: string, youtubeId: string, beat: string) {
  const file = path.join(heartsRoot, 'public', 'typography', 'audio', `${youtubeId}-${beat}.m4a`)
  return existsSync(file) ? `/typography/audio/${youtubeId}-${beat}.m4a` : null
}

/**
 * One scenic card per talk, built from the same manifest rows as the face films.
 * Neighbouring talks in a course do not share a style or a background.
 * A beat's audio is attached only when that file is already in the repo.
 */
export function buildCards(rows: ManifestRow[], heartsRoot: string): StoredCard[] {
  const groups = new Map<string, ManifestRow[]>()
  for (const row of rows) {
    const list = groups.get(row.youtubeId) || []
    if (!list.some((held) => held.beat === row.beat)) list.push(row)
    groups.set(row.youtubeId, list)
  }
  const talks = [...groups.values()].map((beats) => {
    const first = beats[0]
    return {
      youtubeId: first.youtubeId,
      title: first.title,
      speaker: first.speaker,
      course: first.course,
      beats: [...beats].sort((a, b) => ORDER[a.beat] - ORDER[b.beat]),
    }
  })
  let previous = ''
  return assignStyles(talks).map((talk, index) => {
    const scene = pickScene(index, 0, previous, 0)
    previous = scene.id
    return {
      youtubeId: talk.youtubeId,
      title: talk.title,
      speaker: talk.speaker,
      course: talk.course,
      style: talk.style,
      scene: scene.id,
      beats: talk.beats.filter((beat) => BEATS.has(beat.beat)).map((beat) => {
        const phrases = keyPhrasesFor(talk.youtubeId, beat.beat, beat.quote)
        return {
          beat: beat.beat,
          quote: beat.quote,
          gold: phrases[phrases.length - 1] || '',
          audio: audioSrc(heartsRoot, talk.youtubeId, beat.beat),
        }
      }),
    }
  })
}

export function writeCardCatalogue(cards: StoredCard[], root = process.cwd()) {
  const prior = readCardCatalogue(root)
  const merged = new Map(prior.cards.map((card) => [card.youtubeId, card]))
  for (const card of cards) merged.set(card.youtubeId, card)
  const ordered = [...merged.values()].sort((a, b) => a.course.localeCompare(b.course) || a.youtubeId.localeCompare(b.youtubeId))
  const file = cardCataloguePath(root)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify({ cards: ordered }, null, 2)}\n`)
  return file
}

export function sceneSrc(id: string) {
  return sceneById(id).src
}
