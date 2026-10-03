import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { keyPhrasesFor } from '../../../remotion/src/emphasis'
import { withoutStutters } from '../../../remotion/src/lines'
import type { ManifestRow, StyleId } from '../../../remotion/src/manifest'
import { assignStyles } from '../../../remotion/src/manifest'
import { cleanSpokenQuote, type SpokenWord } from './card-voice'
import { pickScene, SCENES, sceneById, type SceneId } from './scenes'

export type CardBeat = {
  beat: 'hook' | 'turn' | 'land'
  quote: string
  gold: string
  audio: string | null
  /** Word starts, in seconds from the start of this beat's audio. */
  words?: SpokenWord[]
  /** Shown after the spoken line when that line only points at a verse. */
  verse?: string | null
}

/** Qur'an 6:122, the verse Al-Nur's land line is talking about. */
const VERSE_FOR: Record<string, { gold: string; text: string }> = {
  NIR88RRpat4: {
    gold: 'made for him light',
    text: 'أَوَمَن كَانَ مَيْتًا فَأَحْيَيْنَاهُ وَجَعَلْنَا لَهُ نُورًا يَمْشِي بِهِ فِي النَّاسِ كَمَن مَّثَلُهُ فِي الظُّلُمَاتِ لَيْسَ بِخَارِجٍ مِّنْهَا — And is one who was dead and We gave him life and made for him light by which to walk among the people like one who is in darkness, never to emerge therefrom?',
  },
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

const bare = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'\u0600-\u06FF]/g, '')

function sameLine(a: string, b: string) {
  const norm = (value: string) => value.split(/\s+/).map(bare).filter(Boolean).join(' ')
  return norm(a) === norm(b)
}

/** Word times from the talk schedule, measured from the beat's audio in-point. */
function wordTimes(heartsRoot: string, youtubeId: string, beat: string, quote: string): SpokenWord[] | undefined {
  const talks = path.resolve(heartsRoot, '..', 'remotion', 'talks')
  const talkFile = path.join(talks, `${youtubeId}.json`)
  const windowsFile = path.join(talks, 'windows.json')
  if (!existsSync(talkFile) || !existsSync(windowsFile)) return undefined
  try {
    const talk = JSON.parse(readFileSync(talkFile, 'utf8')) as { words?: { text: string; talkAt: number; beat: string }[] }
    const windows = JSON.parse(readFileSync(windowsFile, 'utf8')) as { talks: { id: string; beats: { beat: string; in: number }[] }[] }
    const origin = windows.talks.find((row) => row.id === youtubeId)?.beats.find((row) => row.beat === beat)?.in
    if (origin === undefined || !talk.words?.length) return undefined
    const raw = talk.words.filter((word) => word.beat === beat).map((word) => ({ text: word.text, at: Math.max(0, word.talkAt - origin) }))
    const cleaned = withoutStutters(raw)
    if (!sameLine(cleaned.map((word) => word.text).join(' '), quote)) return undefined
    return cleaned
  } catch {
    return undefined
  }
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
  let previous: { id: string; tags: readonly string[] } | null = null
  return assignStyles(talks).map((talk, index) => {
    const scene = pickScene(SCENES[index % SCENES.length].id, 0, previous)
    previous = scene
    return {
      youtubeId: talk.youtubeId,
      title: talk.title,
      speaker: talk.speaker,
      course: talk.course,
      style: talk.style,
      scene: scene.id,
      beats: talk.beats.filter((beat) => BEATS.has(beat.beat)).map((beat) => {
        const quote = cleanSpokenQuote(beat.quote)
        const phrases = keyPhrasesFor(talk.youtubeId, beat.beat, quote)
        const verse = beat.beat === 'land' && /\bthis verse\b/i.test(quote) ? VERSE_FOR[talk.youtubeId] : undefined
        return {
          beat: beat.beat,
          quote,
          gold: verse?.gold || phrases[phrases.length - 1] || '',
          audio: audioSrc(heartsRoot, talk.youtubeId, beat.beat),
          words: wordTimes(heartsRoot, talk.youtubeId, beat.beat, quote),
          verse: verse?.text || null,
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
