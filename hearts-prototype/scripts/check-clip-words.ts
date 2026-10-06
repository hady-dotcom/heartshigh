#!/usr/bin/env npx tsx
/**
 * Runs the feed's own track resolver against a saved live opening response and prints, per clip, how much of the
 * hors d'oeuvre has timed words in F before (tier caption lines) and after (clip word tracks).
 *
 *   npx tsx scripts/check-clip-words.ts [--opening /path/to/opening.json]
 *
 * Also prints the opening response size with the tracks attached, as the server would send it. Exit code 1 if any
 * clip is under 80%.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { wordCoverage } from '../src/lib/framing/clip-words'
import { trackForClip } from '../src/lib/framing/store'
import { sentencesFromCaptions } from '../src/lib/framing/words'

type Clip = { cutId: number; youtubeId: string; hors: { start: number; end: number; lines?: { at?: number; text?: string }[] }; framingTrack?: unknown }

const at = process.argv.indexOf('--opening')
const file = at >= 0 ? process.argv[at + 1] : '/workspace/proto-test/research-words/opening-anon.json'
const opening = JSON.parse(readFileSync(file, 'utf8')) as { clips: Record<string, Clip>; starters: Record<string, Clip> }
const workAt = process.argv.indexOf('--work')
const workDir = workAt >= 0 ? process.argv[workAt + 1] : '/workspace/own-cms/content-load/work'
/** Optional: the processed captions, to count how many of the window's spoken words F shows. */
function captionWords(youtubeId: string, start: number, end: number) {
  if (!existsSync(workDir)) return null
  for (const source of readdirSync(workDir)) {
    const file = path.join(workDir, source, `${youtubeId}.json`)
    if (source.startsWith('backup') || !existsSync(file)) continue
    const work = JSON.parse(readFileSync(file, 'utf8')) as { words: [string, number, number][]; disp?: string[] }
    return work.words.filter((row, index) => row[1] >= start && row[1] < end && /[\p{L}\p{N}]/u.test(work.disp?.[index] || row[0]) && !/^\[|\]$|^>>|^foreign$/i.test(row[0])).length
  }
  return null
}
const pct = (value: number) => `${Math.round(value * 100)}%`.padStart(4)

let full = 0
let before = 0
let blankNow = 0
const rows = Object.values(opening.clips).sort((a, b) => a.cutId - b.cutId)
let spokenTotal = 0
let shownTotal = 0
console.log('cut  youtube      window        before  after  pages words  of spoken  source')
for (const clip of rows) {
  const { start, end } = clip.hors
  const was = wordCoverage(sentencesFromCaptions(clip.hors.lines, start, end), start, end)
  const track = trackForClip(clip.youtubeId, start, end, clip.framingTrack)
  // As the feed does it: a track's words when it has any, otherwise the tier's caption lines.
  const shown = track?.sentences?.length ? track.sentences : sentencesFromCaptions(clip.hors.lines, start, end)
  const now = wordCoverage(shown, start, end)
  if (now >= 0.8) full++
  if (was >= 0.8) before++
  if (!track?.sentences?.length) blankNow++
  const words = track?.sentences?.reduce((sum, row) => sum + row.words.length, 0) || 0
  const spoken = captionWords(clip.youtubeId, start, end)
  if (spoken) {
    spokenTotal += spoken
    shownTotal += Math.min(words, spoken)
  }
  const share = spoken ? pct(Math.min(1, words / spoken)) : '   ?'
  console.log(`${String(clip.cutId).padStart(3)}  ${clip.youtubeId}  ${`${start}-${end}`.padEnd(12)}  ${pct(was)}   ${pct(now)}  ${String(track?.sentences?.length || 0).padStart(5)} ${String(words).padStart(5)}  ${share}  ${track?.sentences?.length ? 'track' : now ? 'lines' : 'none '}${was === 0 ? '  (was blank)' : ''}`)
}
if (spokenTotal) console.log(`\nCaption words inside the windows: ${spokenTotal}; shown in F: ${shownTotal} (${pct(shownTotal / spokenTotal).trim()}). The rest are sentence fragments trimmed at a clip edge, or words cut by the out-point.`)
console.log(`\nBefore: ${before}/${rows.length} clips at 80% or more. After: ${full}/${rows.length}. Clips without a words track: ${blankNow}.`)

const size = (value: unknown) => {
  const text = JSON.stringify(value)
  return { raw: Buffer.byteLength(text), gzip: gzipSync(text).length }
}
const attach = (map: Record<string, Clip>) =>
  Object.fromEntries(Object.entries(map).map(([key, clip]) => [key, { ...clip, framingTrack: trackForClip(clip.youtubeId, clip.hors.start, clip.hors.end, clip.framingTrack) }]))
const was = size(opening)
const now = size({ ...opening, clips: attach(opening.clips), starters: attach(opening.starters || {}) })
console.log(`Opening response: before ${was.raw} bytes (${was.gzip} gzip), after ${now.raw} bytes (${now.gzip} gzip).`)
if (full < rows.length) process.exitCode = 1
