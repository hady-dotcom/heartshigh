import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { keyPhrasesFor, restoreSpokenTail } from '../../../remotion/src/emphasis'
import { withoutStutters } from '../../../remotion/src/lines'
import type { ManifestRow, StyleId } from '../../../remotion/src/manifest'
import { assignStyles } from '../../../remotion/src/manifest'
import { placeOnSpeech, speechRuns } from '../../../remotion/src/timing'
import { cleanSpokenQuote, type SpokenWord } from './card-voice'
import { CATALOGUE, pickBackground } from './backgrounds'
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
  /** Local still, used when BACKGROUNDS_BASE_URL is unset. */
  scene: SceneId
  /** Catalogue file, stable for this card. Served from the bucket when the base URL is set. */
  background?: string | null
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
  if (!existsSync(windowsFile)) return undefined
  try {
    const windows = JSON.parse(readFileSync(windowsFile, 'utf8')) as { talks: { id: string; beats: { beat: string; in: number }[] }[] }
    const origin = windows.talks.find((row) => row.id === youtubeId)?.beats.find((row) => row.beat === beat)?.in
    if (origin === undefined) return undefined
    const talk = existsSync(talkFile) ? JSON.parse(readFileSync(talkFile, 'utf8')) as { words?: { text: string; talkAt: number; beat: string }[] } : { words: [] }
    const raw = (talk.words || []).filter((word) => word.beat === beat).map((word) => ({ text: word.text, at: Math.max(0, word.talkAt - origin) }))
    const cleaned = withoutStutters(raw)
    const line = cleaned.map((word) => word.text).join(' ')
    // Captions that stop early have no clock for the closing name, so place the whole line on the speech.
    if (!line || restoreSpokenTail(youtubeId, beat, line) !== line) {
      const placed = placeExtendedLine(heartsRoot, youtubeId, beat, quote, origin)
      if (placed && sameLine(placed.map((word) => word.text).join(' '), quote)) return placed
    }
    if (line && sameLine(line, quote)) return cleaned
    return undefined
  } catch {
    return undefined
  }
}

type WindowBeat = {
  beat: string
  in: number
  speechStart: number
  speechEnd: number
  sentenceStart?: number
  window: { start: number; end: number }
}

/** Lay a restored line on this beat's speech, so the last word appears as it is said. */
function placeExtendedLine(heartsRoot: string, youtubeId: string, beat: string, quote: string, origin: number): SpokenWord[] | undefined {
  const remotionRoot = path.resolve(heartsRoot, '..', 'remotion')
  const footage = path.join(remotionRoot, 'public', 'footage', `${youtubeId}-${beat}.mp4`)
  const windowsFile = path.join(remotionRoot, 'talks', 'windows.json')
  if (!existsSync(footage) || !existsSync(windowsFile)) return undefined
  const windows = JSON.parse(readFileSync(windowsFile, 'utf8')) as { talks: { id: string; beats: WindowBeat[] }[] }
  const row = windows.talks.find((talk) => talk.id === youtubeId)?.beats.find((item) => item.beat === beat)
  if (!row) return undefined
  const from = Math.max(row.window.start, row.speechStart - 0.2)
  const until = Math.min(row.window.end, row.speechEnd + 0.2)
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', footage, '-ss', Math.max(0, from - row.window.start).toFixed(3), '-t', Math.max(0.2, until - from).toFixed(3), '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 32_000_000 })
  const step = 800
  const levels: number[] = []
  for (let index = 0; index + step <= raw.length / 4; index += step) {
    let sum = 0
    for (let sample = 0; sample < step; sample++) sum += Math.abs(raw.readFloatLE((index + sample) * 4))
    levels.push(sum / step)
  }
  const runs = speechRuns(levels, from).filter((run) => run.end > row.speechStart - 0.05 && run.start < row.speechEnd + 0.05)
  const placed = placeOnSpeech(quote, runs.length ? runs : [{ start: row.speechStart, end: row.speechEnd }])
  if (placed[0] && row.sentenceStart && placed[0].talkAt < row.sentenceStart) placed[0].talkAt = row.sentenceStart
  for (let index = 1; index < placed.length; index++) if (placed[index].talkAt < placed[index - 1].talkAt + 0.05) placed[index].talkAt = placed[index - 1].talkAt + 0.05
  return placed.map((word) => ({ text: word.text, at: Math.max(0, word.talkAt - origin) }))
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
  let previousBackground: (typeof CATALOGUE)[number] | null = null
  return assignStyles(talks).map((talk, index) => {
    const scene = pickScene(SCENES[index % SCENES.length].id, 0, previous)
    previous = scene
    const background = CATALOGUE.length ? pickBackground(CATALOGUE, index, previousBackground) : null
    previousBackground = background
    return {
      youtubeId: talk.youtubeId,
      title: talk.title,
      speaker: talk.speaker,
      course: talk.course,
      style: talk.style,
      scene: scene.id,
      background: background?.file || null,
      beats: talk.beats.filter((beat) => BEATS.has(beat.beat)).map((beat) => {
        const quote = cleanSpokenQuote(restoreSpokenTail(talk.youtubeId, beat.beat, beat.quote))
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
