#!/usr/bin/env npx tsx
/**
 * Offline analyser: download a YouTube window long enough to read, pick treatments A–F
 * per shot, snap the clip to sentence ends, write a framing track, then delete the film.
 *
 *   pnpm framing:analyse <youtubeId> <start> <end>
 *   npm run framing:analyse -- 9gwe-HMwZv0 16:45 17:10
 *
 * Never writes to a production database. Pass --write-cms only against a local SQLite file.
 */
import { execFile, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { buildTrack } from '../src/lib/framing/choose'
import { fileNameFor } from '../src/lib/framing/store'
import { validateTrack } from '../src/lib/framing/validate'
import { sentencesFromWords, sentencesInWindow, wordsFromCues } from '../src/lib/framing/words'
import type { ShotAnalysis } from '../src/lib/framing/types'
import { parseTranscript } from '../src/lib/transcript'
import { parseTimestamp } from '../src/lib/transcript'
import { ytDlpBinary } from '../src/lib/youtube'
import { prototypeFor } from './framing/prototype-shots'

const exec = promisify(execFile)
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const MODEL_URL = 'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx'
const MODEL = path.join(here, 'framing', 'yunet.onnx')

function die(message: string): never {
  console.error(message)
  process.exit(1)
}

function clock(value: string) {
  const parsed = parseTimestamp(value)
  if (parsed == null) die(`Not a time: ${value}. Use 16:45 or seconds.`)
  return parsed
}

function arg(name: string) {
  const at = process.argv.indexOf(name)
  return at >= 0 ? process.argv[at + 1] : null
}

async function ensureModel() {
  if (existsSync(MODEL)) return
  console.log('Fetching YuNet face model (once).')
  const response = await fetch(MODEL_URL, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok) die(`Could not download YuNet: ${response.status}`)
  writeFileSync(MODEL, Buffer.from(await response.arrayBuffer()))
}

function localTranscript(youtubeId: string) {
  const file = path.join(root, 'content', 'transcripts', 'starters', `${youtubeId}.vtt`)
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

async function captions(youtubeId: string) {
  const local = localTranscript(youtubeId)
  if (local) return parseTranscript(local).cues
  const dir = await mkdtemp(path.join(tmpdir(), 'hearts-fr-cap-'))
  try {
    await exec(ytDlpBinary(), [
      '--skip-download', '--write-subs', '--write-auto-subs', '--sub-langs', 'en.*,en', '--sub-format', 'vtt',
      '--extractor-args', 'youtube:player_client=web_embedded',
      '-o', path.join(dir, '%(id)s.%(ext)s'),
      `https://www.youtube.com/watch?v=${youtubeId}`,
    ], { timeout: 90_000 })
    const { readdir } = await import('node:fs/promises')
    const files = (await readdir(dir)).filter((name) => name.endsWith('.vtt'))
    const preferred = files.find((name) => /\.en\.vtt$/.test(name)) || files[0]
    if (!preferred) return []
    return parseTranscript(readFileSync(path.join(dir, preferred), 'utf8')).cues
  } catch (error) {
    console.warn('Caption fetch from YouTube failed; using any local or prototype sentences.')
    console.warn(error instanceof Error ? error.message.split('\n').find((line) => /ERROR|blocked|bot/i.test(line)) || error.message : String(error))
    return []
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function download(youtubeId: string, start: number, end: number, dest: string) {
  const pad = 1.2
  const from = Math.max(0, start - pad)
  const extra = end - start + pad * 2
  const args = [
    '-f', 'bv*[height<=720]+ba/b[height<=720]/b',
    '--extractor-args', 'youtube:player_client=web_embedded',
    '--download-sections', `*${from}-${from + extra}`,
    '--force-keyframes-at-cuts',
    '-o', dest,
    '--no-playlist',
    `https://www.youtube.com/watch?v=${youtubeId}`,
  ]
  await exec(ytDlpBinary(), args, { timeout: 180_000, maxBuffer: 8 * 1024 * 1024 })
}

function pythonBin() {
  return process.env.PYTHON || 'python3'
}

function runVision(video: string, out: string, offset: number) {
  execFileSync(pythonBin(), [path.join(here, 'framing', 'analyse.py'), video, out, MODEL, String(offset)], {
    cwd: root,
    stdio: 'inherit',
  })
  return JSON.parse(readFileSync(out, 'utf8')) as { shots: ShotAnalysis[]; cuts: number[] }
}

async function main() {
  const argv = process.argv.slice(2).filter((row) => !row.startsWith('--'))
  if (argv.length < 3) die('Usage: pnpm framing:analyse <youtubeId> <start> <end>')
  const youtubeId = argv[0]
  const requestedStart = clock(argv[1])
  const requestedEnd = clock(argv[2])
  if (requestedEnd <= requestedStart) die('The end must be after the start.')
  if (process.env.DATABASE_URL?.startsWith('postgres') && process.argv.includes('--write-cms')) {
    die('Refusing --write-cms against Postgres. This analyser never touches production data.')
  }

  const work = await mkdtemp(path.join(tmpdir(), 'hearts-framing-'))
  const video = path.join(work, `${youtubeId}.mp4`)
  const analysisFile = path.join(work, 'analysis.json')
  let shots: ShotAnalysis[] = []
  let cuts: number[] = []
  let source = 'opencv'
  try {
    console.log(`Downloading ${youtubeId} ${argv[1]}–${argv[2]} to a temp folder.`)
    try {
      await ensureModel()
      await download(youtubeId, requestedStart, requestedEnd, video)
      if (!existsSync(video)) {
        const found = (await import('node:fs/promises')).readdir
        const names = await found(work)
        const mp4 = names.find((name) => name.endsWith('.mp4'))
        if (!mp4) throw new Error('yt-dlp did not leave a video file.')
        execFileSync('mv', [path.join(work, mp4), video])
      }
      runVision(video, analysisFile, Math.max(0, requestedStart - 1.2))
      const analysis = JSON.parse(readFileSync(analysisFile, 'utf8')) as { shots: ShotAnalysis[]; cuts: number[] }
      shots = analysis.shots || []
      cuts = analysis.cuts || []
    } catch (error) {
      const known = prototypeFor(youtubeId, requestedStart, requestedEnd)
      if (!known) throw error
      source = 'prototype-shots (YouTube blocked the temporary download)'
      shots = known.shots
      cuts = known.cuts
      console.warn(`Video download failed. Using the measured shots from the box prototype for ${known.kind}.`)
      console.warn(error instanceof Error ? error.message.split('\n').at(-1) : String(error))
    }
    const cues = await captions(youtubeId)
    const words = wordsFromCues(cues.filter((cue) => cue.end >= requestedStart - 2 && cue.start <= requestedEnd + 2))
    let sentences = sentencesInWindow(sentencesFromWords(words, requestedEnd + 2), requestedStart - 2, requestedEnd + 2)
    const known = prototypeFor(youtubeId, requestedStart, requestedEnd)
    if (!sentences.length && known?.sentences) sentences = known.sentences
    const track = buildTrack({
      youtubeId,
      requestedStart,
      requestedEnd,
      shots,
      sentences,
      cuts,
    })
    track.sentences = sentencesInWindow(sentences, track.start, track.end)
    track.words = track.sentences.flatMap((row) => row.words)
    const problems = validateTrack(track)
    if (problems.length) die(`Track failed checks: ${problems.map((row) => row.message).join(' ')}`)
    const dir = path.join(root, 'content', 'framing')
    mkdirSync(dir, { recursive: true })
    const file = path.join(dir, fileNameFor(track))
    writeFileSync(file, `${JSON.stringify(track, null, 2)}\n`)
    console.log(`Wrote ${path.relative(root, file)} (shots from ${source})`)
    for (const segment of track.segments) {
      console.log(`  ${segment.start.toFixed(2)}–${segment.end.toFixed(2)}  ${segment.mode}  c=${segment.confidence.toFixed(2)}`)
    }
    if (arg('--out')) writeFileSync(arg('--out')!, `${JSON.stringify(track, null, 2)}\n`)
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined)
    console.log('Deleted the temporary download.')
  }
}

main().catch((error) => die(error instanceof Error ? error.message : String(error)))
