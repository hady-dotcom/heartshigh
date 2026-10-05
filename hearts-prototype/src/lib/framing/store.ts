import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { parseTrack } from './validate'
import type { FramingTrack } from './types'

export function framingDir(root = process.cwd()) {
  return path.join(root, 'content', 'framing')
}

export function loadFramingFiles(root = process.cwd()): FramingTrack[] {
  const dir = framingDir(root)
  if (!existsSync(dir)) return []
  const tracks: FramingTrack[] = []
  for (const name of readdirSync(dir)) {
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

export function trackForClip(youtubeId: string | null | undefined, start: number, end: number, stored?: unknown, root = process.cwd()): FramingTrack | null {
  const fromStore = parseTrack(stored)
  if (fromStore) return fromStore
  if (!youtubeId) return null
  const mid = (start + end) / 2
  return loadFramingFiles(root).find((row) => row.youtubeId === youtubeId && mid >= row.start - 1 && mid <= row.end + 1) || null
}

export function fileNameFor(track: FramingTrack) {
  const stamp = `${Math.floor(track.start)}-${Math.ceil(track.end)}`
  return `${track.youtubeId}-${stamp}.json`
}
