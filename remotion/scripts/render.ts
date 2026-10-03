// Renders the five typography styles for seeded talks (or the ids you pass).
// Usage:
//   npm run render -- [youtube-id ...] [--style kinetic]
//   npm run render -- ECaTWkof57E --audio ../hearts-prototype/content/audio/ECaTWkof57E.m4a
//   npm run render -- --audio ECaTWkof57E=../hearts-prototype/content/audio/ECaTWkof57E.m4a
// A file at hearts-prototype/content/audio/{youtubeId}.m4a (or .mp3, .wav, .aac) is used
// with no flag. The beats are sliced from that file. If no file is there, the script
// tries yt-dlp and otherwise renders silent. TYPOGRAPHY_SILENT=1 skips the download.
import { execFileSync } from 'node:child_process'
import { availableParallelism } from 'node:os'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { EMPHASIS, phraseSpans } from '../src/emphasis'
import { prepareFootage } from './footage'
import { BEAT_GAP, INTERTITLE, LEAD_IN, scheduleFootage, type BeatSpan, type ScheduledTalk, type ScheduledWord } from '../src/timing'

const STYLES = ['kinetic', 'windows', 'conversation', 'cinema', 'unfold'] as const
type StyleId = (typeof STYLES)[number]
type TalkProps = {
  style: StyleId
  id: string
  title: string
  speaker: string
  courseTitle: string
  lane: string
  audio: string | null
  footage?: { beat: 'hook' | 'turn' | 'land'; src: string; windowStart: number; in: number; out: number }[] | null
  words: ScheduledWord[]
  beats: BeatSpan[]
  spokenSeconds: number
  cinemaSeconds: number
  learnMoreSeconds: number
}

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const hearts = path.resolve(here, '../hearts-prototype')
const artifacts = '/opt/cursor/artifacts/typography'
const publicDir = path.join(hearts, 'public', 'typography')

const args = process.argv.slice(2)
const audioById = new Map<string, string>()
let styleFlag = ''
let audioOnly = false
const ids: string[] = []
for (let index = 0; index < args.length; index++) {
  const arg = args[index]
  if (arg === '--style') {
    styleFlag = args[++index] || ''
    continue
  }
  if (arg === '--audio-only') {
    audioOnly = true
    continue
  }
  if (arg === '--audio') {
    const value = args[++index] || ''
    const eq = value.indexOf('=')
    if (eq > 0) audioById.set(value.slice(0, eq), value.slice(eq + 1))
    else audioById.set('*', value)
    continue
  }
  if (!arg.startsWith('--')) ids.push(arg)
}
const styles = (styleFlag ? [styleFlag] : [...STYLES]).filter((style): style is StyleId => (STYLES as string[]).includes(style))

const AUDIO_EXT = ['.m4a', '.mp3', '.wav', '.aac', '.m4b']
/** Click-removal at each beat join. Short enough that the first syllable is still the cue. */
const JOIN_FADE = 0.06

type AudioSpan = { file: string; start: number; end: number }

function mediaDuration(file: string) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' })
  const duration = Number(out.trim())
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`No duration for ${file}`)
  return duration
}

function partPaths(id: string) {
  const dir = path.join(hearts, 'content', 'audio')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => {
      const stem = name.slice(0, name.lastIndexOf('.'))
      return stem.startsWith(`${id}-part`) && AUDIO_EXT.some((ext) => name.endsWith(ext))
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => path.join(dir, name))
}

/** One full recording, or consecutive parts laid end to end from 0. */
function timelineFor(id: string): AudioSpan[] | null {
  const named = audioById.get(id) || (ids.length === 1 ? audioById.get('*') || '' : '')
  const single = (() => {
    if (named) {
      const file = path.resolve(named)
      if (!existsSync(file)) {
        console.warn(`${id}: audio file not found at ${file}.`)
        return null
      }
      return file
    }
    const dir = path.join(hearts, 'content', 'audio')
    for (const ext of AUDIO_EXT) {
      const file = path.join(dir, `${id}${ext}`)
      if (existsSync(file)) return file
    }
    return null
  })()
  if (single) {
    const duration = mediaDuration(single)
    return [{ file: single, start: 0, end: duration }]
  }
  const parts = partPaths(id)
  if (!parts.length) return null
  let cursor = 0
  const spans = parts.map((file) => {
    const duration = mediaDuration(file)
    const span = { file, start: cursor, end: cursor + duration }
    cursor += duration
    return span
  })
  console.log(`${id}: ${spans.length} parts, ${cursor.toFixed(3)}s end to end`)
  spans.forEach((span, index) => console.log(`  part${index} ${span.start.toFixed(3)}–${span.end.toFixed(3)} ${path.basename(span.file)}`))
  return spans
}

function run(cmd: string, cmdArgs: string[], opts: { cwd?: string; timeout?: number } = {}) {
  execFileSync(cmd, cmdArgs, { stdio: 'inherit', ...opts })
}

function exportTalks() {
  const extra = ids.length ? ids : []
  run('npx', ['tsx', 'scripts/export-typography.ts', ...extra], { cwd: hearts, timeout: 180_000 })
}

function talkFiles() {
  const dir = path.join(here, 'talks')
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as TalkProps)
    .filter((talk) => !ids.length || ids.includes(talk.id))
}

function ffmpeg(args: string[]) {
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' })
}

function tryAudio(talk: TalkProps): string | null {
  const local = timelineFor(talk.id)
  if (local) {
    console.log(`${talk.id}: slicing beats from ${local.map((span) => path.basename(span.file)).join(' + ')}`)
    return assemble(local, talk)
  }
  if (process.env.TYPOGRAPHY_SILENT === '1') {
    console.warn(`${talk.id}: no local audio and TYPOGRAPHY_SILENT is set, so this render is silent.`)
    return null
  }
  const bin = existsSync(path.join(hearts, 'bin', 'yt-dlp')) ? path.join(hearts, 'bin', 'yt-dlp') : 'yt-dlp'
  try {
    execFileSync(bin, ['--version'], { stdio: 'ignore' })
  } catch {
    try {
      run('node', ['scripts/get-yt-dlp.mjs'], { cwd: hearts, timeout: 120_000 })
    } catch {
      console.warn(`${talk.id}: yt-dlp is not available, so this render is silent`)
      return null
    }
  }
  const tool = existsSync(path.join(hearts, 'bin', 'yt-dlp')) ? path.join(hearts, 'bin', 'yt-dlp') : bin
  const rangeStart = Math.max(0, talk.beats[0].talkAt - 0.4)
  const last = talk.beats[talk.beats.length - 1]
  const rangeEnd = last.talkAt + last.duration + 1
  const raw = path.join(here, 'public', 'audio', `${talk.id}-src.m4a`)
  mkdirSync(path.dirname(raw), { recursive: true })
  try {
    execFileSync(tool, [
      '-f', 'ba/b',
      '--extractor-args', 'youtube:player_client=web_embedded',
      '--download-sections', `*${rangeStart.toFixed(2)}-${rangeEnd.toFixed(2)}`,
      '--force-keyframes-at-cuts',
      '-o', raw,
      `https://www.youtube.com/watch?v=${talk.id}`,
    ], { stdio: 'inherit', timeout: 150_000 })
  } catch (error) {
    console.warn(`${talk.id}: could not fetch the speaker's audio (${error instanceof Error ? error.message : 'yt-dlp failed'}). Rendering silent.`)
    return null
  }
  if (!existsSync(raw)) {
    console.warn(`${talk.id}: yt-dlp wrote no audio file. Rendering silent.`)
    return null
  }
  return assemble([{ file: raw, start: rangeStart, end: rangeEnd }], talk)
}

/** Slice each beat to its cue. A part boundary is only crossed when a beat actually straddles it. */
function assemble(spans: AudioSpan[], talk: TalkProps): string | null {
  const pieces: string[] = []
  const scratch = path.join(here, 'public', 'audio', talk.id)
  mkdirSync(scratch, { recursive: true })
  const silence = (seconds: number) => {
    if (seconds < 0.02) return
    const file = path.join(scratch, `s${pieces.length}.wav`)
    ffmpeg(['-f', 'lavfi', '-t', seconds.toFixed(3), '-i', 'anullsrc=channel_layout=mono:sample_rate=44100', '-ac', '1', file])
    pieces.push(file)
  }
  const cut = (file: string, offset: number, duration: number, dest: string, fade: boolean) => {
    const length = Math.max(0.2, duration)
    const preroll = Math.min(1, Math.max(0, offset))
    const fast = Math.max(0, offset - preroll)
    const fine = offset - fast
    const fadeD = Math.min(JOIN_FADE, length / 4)
    const args = ['-ss', fast.toFixed(3), '-i', file, '-ss', fine.toFixed(3), '-t', length.toFixed(3), '-vn', '-ac', '1', '-ar', '44100']
    if (fade) args.push('-af', `afade=t=in:st=0:d=${fadeD.toFixed(3)},afade=t=out:st=${Math.max(0, length - fadeD).toFixed(3)}:d=${fadeD.toFixed(3)}`)
    ffmpeg([...args, dest])
  }
  const slice = (talkAt: number, duration: number) => {
    const end = talkAt + duration
    const hits = spans.filter((span) => talkAt < span.end - 0.001 && end > span.start + 0.001)
    const file = path.join(scratch, `b${pieces.length}.wav`)
    if (!hits.length) {
      console.warn(`${talk.id}: beat at ${talkAt.toFixed(2)}s is outside the audio. Inserting silence.`)
      silence(duration)
      return
    }
    if (hits.length === 1) {
      cut(hits[0].file, talkAt - hits[0].start, duration, file, true)
      pieces.push(file)
      return
    }
    const chunks: string[] = []
    for (const span of hits) {
      const from = Math.max(talkAt, span.start)
      const to = Math.min(end, span.end)
      const chunk = path.join(scratch, `c${pieces.length}-${chunks.length}.wav`)
      cut(span.file, from - span.start, to - from, chunk, false)
      chunks.push(chunk)
    }
    const list = path.join(scratch, `j${pieces.length}.txt`)
    const joined = path.join(scratch, `j${pieces.length}.wav`)
    writeFileSync(list, chunks.map((chunk) => `file '${chunk.replace(/'/g, "'\\''")}'`).join('\n'))
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined])
    const fadeD = Math.min(JOIN_FADE, duration / 4)
    ffmpeg(['-i', joined, '-af', `afade=t=in:st=0:d=${fadeD.toFixed(3)},afade=t=out:st=${Math.max(0, duration - fadeD).toFixed(3)}:d=${fadeD.toFixed(3)}`, file])
    pieces.push(file)
  }
  silence(LEAD_IN)
  talk.beats.forEach((beat, index) => {
    slice(beat.talkAt, beat.duration)
    if (index < talk.beats.length - 1) silence(BEAT_GAP)
  })
  const spokenEnd = talk.beats[talk.beats.length - 1].videoAt + talk.beats[talk.beats.length - 1].duration
  silence(Math.max(0, talk.cinemaSeconds - spokenEnd))
  const list = path.join(scratch, 'list.txt')
  writeFileSync(list, pieces.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n'))
  const wav = path.join(here, 'public', 'audio', `${talk.id}.wav`)
  try {
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', wav])
  } catch {
    console.warn(`${talk.id}: could not assemble the audio. Rendering silent.`)
    return null
  }
  return `audio/${talk.id}.wav`
}

function still(video: string, at: number, dest: string) {
  ffmpeg(['-ss', Math.max(0, at).toFixed(3), '-i', video, '-frames:v', '1', dest])
}

function contactSheet(style: string, rows: string[][]) {
  const filters: string[] = []
  const inputs: string[] = []
  let n = 0
  const scaled: string[] = []
  for (const row of rows) {
    for (const file of row) {
      inputs.push('-i', file)
      filters.push(`[${n}]scale=180:320[${n}s]`)
      scaled.push(`[${n}s]`)
      n += 1
    }
  }
  const across = rows[0].length
  const hstacks: string[] = []
  for (let row = 0; row < rows.length; row++) {
    const cells = scaled.slice(row * across, row * across + across).join('')
    filters.push(`${cells}hstack=inputs=${across}[r${row}]`)
    hstacks.push(`[r${row}]`)
  }
  if (rows.length === 1) filters.push(`${hstacks[0]}copy[out]`)
  else filters.push(`${hstacks.join('')}vstack=inputs=${rows.length}[out]`)
  const dest = path.join(artifacts, `contact-${style}.png`)
  ffmpeg([...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', dest])
  return dest
}

exportTalks()
const talks = talkFiles()
if (!talks.length) throw new Error('No talks to render. Run the export first.')

const footageById = new Map<string, NonNullable<ReturnType<typeof prepareFootage>>>()
for (const talk of talks) {
  const footage = prepareFootage(here, talk.id)
  if (footage) {
    footageById.set(talk.id, footage)
    talk.audio = null
    talk.footage = footage.clips
    console.log(`${talk.id}: face clips, ${footage.beats.map((beat) => beat.beat).join(' ')}`)
    continue
  }
  if (!audioOnly && talk.audio && existsSync(path.join(here, 'public', talk.audio))) continue
  talk.audio = tryAudio(talk)
  writeFileSync(path.join(here, 'talks', `${talk.id}.json`), JSON.stringify(talk))
}

if (audioOnly) {
  for (const talk of talks) console.log(`${talk.id}: ${talk.audio ? `mixed ${talk.audio}` : 'silent'}`)
  process.exit(0)
}

console.log('Bundling the Remotion project…')
const sheets: Record<string, string[][]> = {}
const serveUrl = await bundle({ entryPoint: path.join(here, 'src', 'index.ts') })
mkdirSync(publicDir, { recursive: true })
mkdirSync(artifacts, { recursive: true })

const manifest: { talks: { id: string; title: string; speaker: string; styles: Record<string, string> }[] } = { talks: [] }

for (const talk of talks) {
  const stylesOut: Record<string, string> = {}
  for (const style of styles) {
    const footage = footageById.get(talk.id)
    const schedule = footage ? scheduleFootage(footage.beats, style === 'cinema' ? INTERTITLE : 0) : talk
    const inputProps: TalkProps = { ...talk, ...schedule, style, width: 720, height: 1280, audio: footage ? null : talk.audio, footage: footage ? footage.clips : null }
    const composition = await selectComposition({ serveUrl, id: style, inputProps })
    const folder = path.join(publicDir, talk.id)
    mkdirSync(folder, { recursive: true })
    const output = path.join(folder, `${style}.mp4`)
    console.log(`Rendering ${talk.id} ${style} (${composition.durationInFrames} frames)`)
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: output,
      inputProps,
      crf: 28,
      x264Preset: 'veryfast',
      concurrency: Math.max(2, Math.min(8, availableParallelism())),
      audioBitrate: '96k',
    })
    const artifact = path.join(artifacts, `${talk.id}-${style}.mp4`)
    copyFileSync(output, artifact)
    stylesOut[style] = `/typography/${talk.id}/${style}.mp4`
    const sit = schedule.spokenSeconds
    const beatEnd = (schedule: ScheduledTalk, beat: string) => {
      const span = schedule.beats.find((row) => row.beat === beat)
      return span ? span.videoAt + span.duration : schedule.spokenSeconds
    }
    const beatTime = (id: 'hook' | 'turn' | 'land') => {
      const group = schedule.words.filter((word) => word.beat === id)
      const spans = phraseSpans(group, EMPHASIS[talk.id]?.[id] || [])
      const span = spans[spans.length - 1]
      const at = span ? group[span.to].showAt + 0.16 : (() => {
        const beat = schedule.beats.find((row) => row.beat === id)
        return beat ? beat.videoAt + Math.max(0.2, beat.duration - 0.18) : 1
      })()
      return Math.min(at, beatEnd(schedule, id) - 0.06)
    }
    const moments = [
      ['hook', beatTime('hook')],
      ['turn', beatTime('turn')],
      ['land', beatTime('land')],
      ['card', sit + 0.35],
    ] as const
    for (const beat of ['hook', 'turn', 'land'] as const) {
      const group = schedule.words.filter((word) => word.beat === beat)
      for (const span of phraseSpans(group, EMPHASIS[talk.id]?.[beat] || [])) {
        const slug = span.phrase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const frame = path.join(artifacts, 'frames', `${talk.id}-${style}-${beat}-${slug}.jpg`)
        mkdirSync(path.dirname(frame), { recursive: true })
        still(output, Math.min(group[span.to].showAt + 0.14, beatEnd(schedule, beat) - 0.06), frame)
      }
    }
    const row: string[] = []
    for (const [name, at] of moments) {
      const frame = path.join(artifacts, 'frames', `${talk.id}-${style}-${name}.jpg`)
      mkdirSync(path.dirname(frame), { recursive: true })
      still(output, at, frame)
      row.push(frame)
    }
    const bucket = sheets[style] || []
    bucket.push(row)
    sheets[style] = bucket
    console.log(`  ${output}`)
  }
  manifest.talks.push({ id: talk.id, title: talk.title, speaker: talk.speaker, styles: stylesOut })
}

for (const style of styles) if (sheets[style]?.length) console.log(contactSheet(style, sheets[style]))
const existing = existsSync(path.join(publicDir, 'manifest.json')) ? JSON.parse(readFileSync(path.join(publicDir, 'manifest.json'), 'utf8')) as typeof manifest : { talks: [] }
for (const talk of manifest.talks) {
  const prior = existing.talks.find((row) => row.id === talk.id)
  if (prior) prior.styles = { ...prior.styles, ...talk.styles }
  else existing.talks.push(talk)
}
writeFileSync(path.join(publicDir, 'manifest.json'), JSON.stringify(existing, null, 2))
console.log(`Manifest ${path.join(publicDir, 'manifest.json')}`)
