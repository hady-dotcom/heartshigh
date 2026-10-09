import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { parseTrack } from './validate'
import type { FramingTrack } from './types'

export function framingDir(root = process.cwd()) {
  return path.join(root, 'content', 'framing')
}

/** Clip word tracks cut from processed captions (scripts/clip-words-from-work.ts). Regenerated as a set. */
export const CLIP_WORDS_DIR = 'clip-words'

export function clipWordsDir(root = process.cwd()) {
  return path.join(framingDir(root), CLIP_WORDS_DIR)
}

function readDir(dir: string): FramingTrack[] {
  if (!existsSync(dir)) return []
  const tracks: FramingTrack[] = []
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue
    try {
      const parsed = parseTrack(JSON.parse(readFileSync(path.join(dir, name), 'utf8')))
      if (parsed) tracks.push(parsed)
    } catch {
      // A broken file is skipped; the player falls back to F.
    }
  }
  return tracks
}

function stamp(dir: string) {
  try {
    return String(statSync(dir).mtimeMs)
  } catch {
    return 'none'
  }
}

/** Parsed once per folder change: the feed asks for a track per clip, and re-reading every file each time is slow. */
const cache = new Map<string, { key: string; tracks: FramingTrack[] }>()

export function loadFramingFiles(root = process.cwd()): FramingTrack[] {
  const dir = framingDir(root)
  const words = clipWordsDir(root)
  const key = `${stamp(dir)}|${stamp(words)}`
  const hit = cache.get(root)
  if (hit && hit.key === key) return hit.tracks
  const generated = readDir(words)
  for (const row of generated) clipWordTracks.add(row)
  const tracks = [...readDir(dir), ...generated]
  cache.set(root, { key, tracks })
  return tracks
}

/** Tracks from the clip-words set. They hold only that clip's words, so they serve the same window only. */
const clipWordTracks = new WeakSet<FramingTrack>()
/** Share of a clip a clip-words track must span. Below it (a window that has moved) the feed keeps its own caption lines. */
export const CLIP_WORDS_MIN_OVERLAP = 0.9

function overlap(track: FramingTrack, start: number, end: number) {
  return Math.max(0, Math.min(end, track.end) - Math.max(start, track.start))
}

export function trackForClip(youtubeId: string | null | undefined, start: number, end: number, stored?: unknown, root = process.cwd()): FramingTrack | null {
  const fromStore = parseTrack(stored)
  if (fromStore) return fromStore
  if (!youtubeId) return null
  const mid = (start + end) / 2
  const span = Math.max(0.01, end - start)
  const candidates = loadFramingFiles(root).filter(
    (row) =>
      row.youtubeId === youtubeId &&
      mid >= row.start - 1 &&
      mid <= row.end + 1 &&
      (!clipWordTracks.has(row) || overlap(row, start, end) >= span * CLIP_WORDS_MIN_OVERLAP),
  )
  if (candidates.length < 2) return candidates[0] || null
  // Several tracks near this clip: the one that shares the most of its window wins, and a track with words beats one without.
  const words = (row: FramingTrack) => (row.sentences?.length ? 1 : 0)
  return [...candidates].sort((a, b) => overlap(b, start, end) - overlap(a, start, end) || words(b) - words(a))[0]
}

export function fileNameFor(track: FramingTrack) {
  const stamp = `${Math.floor(track.start)}-${Math.ceil(track.end)}`
  return `${track.youtubeId}-${stamp}.json`
}

/** Seed clips that ship a timed word track (not the placeholder, and not the generated clip-words set). */
export function seedTracksWithWords(root = process.cwd()) {
  return readDir(framingDir(root))
    .filter((row) => row.youtubeId !== 'placeholder' && Boolean(row.sentences?.length || row.words?.length))
    .map((row) => ({ youtubeId: row.youtubeId, start: row.start, end: row.end, sentences: row.sentences?.length || 0 }))
    .sort((a, b) => a.youtubeId.localeCompare(b.youtubeId) || a.start - b.start)
}
