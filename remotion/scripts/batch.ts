// Renders one film per row of a manifest.csv. Safe to stop and run again: a row whose
// film is already on disk, with the same style and quote, is left alone.
//
//   npm run batch -- manifest.csv
//   npm run batch -- manifest.csv --dry-run
//   npm run batch -- manifest.csv --force
//   npm run batch -- manifest.csv --limit 8
//
// Clips are 720p face files cut on the sentence (time 0 is `start`). Put them in
// remotion/public/footage/, or pass a path and the script links them there.
// A row with face-visible set to no is skipped. A missing clip is skipped, not fatal.
import { execFileSync } from 'node:child_process'
import { availableParallelism } from 'node:os'
import { existsSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { keyPhrasesFor } from '../src/emphasis'
import { assignStyles, filmSrc, parseManifest, sameFilm, type FilmRecord } from '../src/manifest'
import { scheduleFootage } from '../src/timing'
import { buildCards, writeCardCatalogue } from '../../hearts-prototype/src/lib/cards'
import { prepareSentence } from './footage'

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const hearts = path.resolve(here, '../hearts-prototype')
const cataloguePath = path.join(hearts, 'public', 'typography', 'films.json')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const limitAt = args.indexOf('--limit')
const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : Infinity
const csvPath = args.find((arg, index) => !arg.startsWith('--') && index !== (limitAt >= 0 ? limitAt + 1 : -1))
if (!csvPath) {
  console.error('Usage: npm run batch -- <manifest.csv> [--dry-run] [--force] [--limit N]')
  process.exit(1)
}

function readCatalogue(): { films: FilmRecord[] } {
  if (!existsSync(cataloguePath)) return { films: [] }
  try {
    const parsed = JSON.parse(readFileSync(cataloguePath, 'utf8')) as { films?: FilmRecord[] }
    return { films: Array.isArray(parsed.films) ? parsed.films : [] }
  } catch {
    return { films: [] }
  }
}

function writeCatalogue(films: FilmRecord[]) {
  mkdirSync(path.dirname(cataloguePath), { recursive: true })
  const ordered = [...films].sort((a, b) => a.course.localeCompare(b.course) || a.youtubeId.localeCompare(b.youtubeId) || a.beat.localeCompare(b.beat))
  writeFileSync(cataloguePath, `${JSON.stringify({ films: ordered }, null, 2)}\n`)
}

function clipFile(name: string) {
  if (!name.trim()) return null
  const named = path.resolve(name)
  const local = path.join(here, 'public', 'footage', path.basename(name))
  if (existsSync(local)) return local
  if (existsSync(named)) {
    mkdirSync(path.dirname(local), { recursive: true })
    symlinkSync(named, local)
    return local
  }
  return null
}

const rows = assignStyles(parseManifest(readFileSync(path.resolve(csvPath), 'utf8')))
if (!rows.length) throw new Error(`No usable rows in ${csvPath}`)
let catalogue = readCatalogue()
const planned = rows.slice(0, Number.isFinite(limit) ? limit : rows.length)
let rendered = 0
let skipped = 0
let waiting = 0

const serveUrl = dryRun ? '' : await bundle({ entryPoint: path.join(here, 'src', 'index.ts') })

for (const row of planned) {
  const src = filmSrc(row.youtubeId, row.beat)
  const record: FilmRecord = { ...row, src, face: row.face }
  const output = path.join(hearts, 'public', src)
  const held = catalogue.films.find((film) => film.youtubeId === row.youtubeId && film.beat === row.beat)
  const phrases = keyPhrasesFor(row.youtubeId, row.beat, row.quote)
  console.log(`plan ${row.youtubeId} ${row.beat} ${row.style}: ${phrases.join(' / ') || row.quote}`)
  if (!row.face) {
    console.log(`  skip: face not visible`)
    waiting += 1
    continue
  }
  const file = clipFile(row.clip)
  if (!file) {
    console.log(`  wait: clip not found (${row.clip})`)
    waiting += 1
    continue
  }
  if (!force && sameFilm(held, record) && existsSync(output) && statSync(output).size > 8000) {
    console.log(`  keep`)
    skipped += 1
    continue
  }
  if (dryRun) {
    rendered += 1
    continue
  }
  const span = prepareSentence(file, row.beat, row.quote, row.start, row.end, phrases)
  const schedule = scheduleFootage([span])
  const inputProps = {
    ...schedule,
    style: row.style,
    id: row.youtubeId,
    title: row.title,
    speaker: row.speaker,
    courseTitle: row.course || row.title,
    lane: 'Reflections',
    audio: null,
    footage: [{ beat: row.beat, src: `footage/${path.basename(file)}`, windowStart: row.start, in: row.start, out: row.end }],
    emphasis: { [row.beat]: phrases },
    width: 720,
    height: 1280,
  }
  const composition = await selectComposition({ serveUrl, id: row.style, inputProps })
  mkdirSync(path.dirname(output), { recursive: true })
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: output,
    inputProps,
    crf: 28,
    x264Preset: 'veryfast',
    concurrency: Math.max(2, Math.min(4, availableParallelism())),
    audioBitrate: '96k',
  })
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', output], { encoding: 'utf8' })
  catalogue = { films: [...catalogue.films.filter((film) => !(film.youtubeId === row.youtubeId && film.beat === row.beat)), record] }
  writeCatalogue(catalogue.films)
  rendered += 1
  console.log(`  ${output}`)
}

const cards = buildCards(rows, hearts)
for (const card of cards) {
  console.log(`card ${card.youtubeId} ${card.style} ${card.scene} → ${card.beats.map((beat) => beat.gold || beat.beat).join(' / ')}`)
}
if (!dryRun) {
  const file = writeCardCatalogue(cards, hearts)
  console.log(`cards ${file}`)
}

console.log(`${dryRun ? 'Planned' : 'Rendered'} ${rendered}, kept ${skipped}, waiting ${waiting}, of ${planned.length}`)
