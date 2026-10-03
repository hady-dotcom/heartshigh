// Renders the five typography styles for seeded talks (or the ids you pass).
// Usage: npm run render -- [youtube-id ...] [--style kinetic]
import { execFileSync } from 'node:child_process'
import { availableParallelism } from 'node:os'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { BEAT_GAP, LEAD_IN, type BeatSpan, type ScheduledWord } from '../src/timing'

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
const styleFlag = args.includes('--style') ? args[args.indexOf('--style') + 1] : ''
const ids = args.filter((arg) => !arg.startsWith('--') && arg !== styleFlag)
const styles = (styleFlag ? [styleFlag] : [...STYLES]).filter((style): style is StyleId => (STYLES as string[]).includes(style))

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
  if (process.env.TYPOGRAPHY_SILENT === '1') {
    console.warn(`${talk.id}: TYPOGRAPHY_SILENT is set, so this render is silent.`)
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
  const pieces: string[] = []
  const scratch = path.join(here, 'public', 'audio', talk.id)
  mkdirSync(scratch, { recursive: true })
  const silence = (seconds: number) => {
    if (seconds < 0.02) return
    const file = path.join(scratch, `s${pieces.length}.wav`)
    ffmpeg(['-f', 'lavfi', '-t', seconds.toFixed(3), '-i', 'anullsrc=channel_layout=mono:sample_rate=44100', '-ac', '1', file])
    pieces.push(file)
  }
  const slice = (offset: number, duration: number) => {
    const file = path.join(scratch, `b${pieces.length}.wav`)
    ffmpeg(['-ss', Math.max(0, offset).toFixed(3), '-t', Math.max(0.2, duration).toFixed(3), '-i', raw, '-vn', '-ac', '1', '-ar', '44100', file])
    pieces.push(file)
  }
  silence(LEAD_IN)
  talk.beats.forEach((beat, index) => {
    slice(beat.talkAt - rangeStart, beat.duration)
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
  filters.push(`${hstacks.join('')}vstack=inputs=${rows.length}[out]`)
  const dest = path.join(artifacts, `contact-${style}.png`)
  ffmpeg([...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', dest])
  return dest
}

exportTalks()
const talks = talkFiles()
if (!talks.length) throw new Error('No talks to render. Run the export first.')

for (const talk of talks) {
  if (talk.audio && existsSync(path.join(here, 'public', talk.audio))) continue
  talk.audio = tryAudio(talk)
  writeFileSync(path.join(here, 'talks', `${talk.id}.json`), JSON.stringify(talk))
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
    const inputProps: TalkProps = { ...talk, style, audio: talk.audio }
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
    const sit = style === 'cinema' ? talk.cinemaSeconds : talk.spokenSeconds
    const beatTime = (id: 'hook' | 'turn' | 'land') => {
      const beat = talk.beats.find((row) => row.beat === id)
      return beat ? beat.videoAt + Math.max(0.2, beat.duration - 0.18) : 1
    }
    const moments = [
      ['lead', 0.08],
      ['hook', beatTime('hook')],
      ['turn', beatTime('turn')],
      ['land', beatTime('land')],
      ['card', sit + 0.35],
    ] as const
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
