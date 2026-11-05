#!/usr/bin/env npx tsx
/**
 * Writes a Framing F word track for every live feed clip, cut from content-load's processed captions.
 *
 *   npx tsx scripts/clip-words-from-work.ts                      # rebuild content/framing/clip-words from the fixture
 *   npx tsx scripts/clip-words-from-work.ts --opening opening.json   # first refresh the clip list from a saved
 *                                                                   # GET /api/hearts/opening?portal=hearts-demo
 *   options: --work <dir> (default /workspace/own-cms/content-load/work), --dry-run,
 *            --fixes-report (print every mishearing fix it applied), --fixes-md <file> (write them as a review table)
 *
 * The clip list (youtube id, hors d'oeuvre in and out) lives in tests/fixtures/live-clips.json so the tests and the
 * build use the same windows. Each work file is <work>/<source>/<youtubeId>.json with `words` ([word, start, end])
 * and `disp` (the same words punctuated). Words are chosen, not changed, except for the hand-checked mishearing fixes
 * in content/framing/clip-words-fixes.json, which are applied on every run; a per-video fix that no longer matches its
 * clip fails the run. Nothing touches a database.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixesFor, type FixHit, type WordFix, type WordFixes } from '../src/lib/framing/clip-word-fixes'
import { clipWordsTrack, shownCoverage, wordCoverage, type WorkFile } from '../src/lib/framing/clip-words'
import { CLIP_WORDS_DIR, fileNameFor } from '../src/lib/framing/store'
import { validateTrack } from '../src/lib/framing/validate'
import { HOLD_GAP, sentencesFromCaptions } from '../src/lib/framing/words'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const FIXTURE = path.join(root, 'tests', 'fixtures', 'live-clips.json')
const OUT = path.join(root, 'content', 'framing', CLIP_WORDS_DIR)
export const FIXES = path.join(root, 'content', 'framing', 'clip-words-fixes.json')

export type LiveClip = { cutId: number; youtubeId: string; start: number; end: number; before: 'none' | 'partial' | 'full'; beforeCoverage: number }
export type LiveClips = { source: string; portal: string; saved: string; clips: LiveClip[] }

function arg(name: string) {
  const at = process.argv.indexOf(name)
  return at >= 0 ? process.argv[at + 1] : null
}

type OpeningClip = { cutId: number; youtubeId: string; hors: { start: number; end: number; lines?: { at?: number; text?: string; tidy?: string; role?: string }[] } }

function clipsFromOpening(file: string): LiveClips {
  const opening = JSON.parse(readFileSync(file, 'utf8')) as { portal: string; clips: Record<string, OpeningClip> }
  const clips = Object.values(opening.clips)
    .filter((row) => row.youtubeId && Number.isFinite(row.hors?.start) && Number.isFinite(row.hors?.end))
    .map((row) => {
      // What F showed before this change: the tier's caption lines, timed by sentence.
      const old = sentencesFromCaptions(row.hors.lines, row.hors.start, row.hors.end)
      const cover = Math.round(wordCoverage(old, row.hors.start, row.hors.end) * 100) / 100
      return { cutId: row.cutId, youtubeId: row.youtubeId, start: row.hors.start, end: row.hors.end, before: cover === 0 ? 'none' : cover >= 0.8 ? 'full' : 'partial', beforeCoverage: cover } as LiveClip
    })
    .sort((a, b) => a.cutId - b.cutId)
  return { source: `GET /api/hearts/opening?portal=${opening.portal}`, portal: opening.portal, saved: statSync(file).mtime.toISOString(), clips }
}

function workIndex(dir: string) {
  const found = new Map<string, string>()
  for (const source of readdirSync(dir, { withFileTypes: true })) {
    if (!source.isDirectory() || source.name.startsWith('backup')) continue
    for (const name of readdirSync(path.join(dir, source.name))) {
      if (!name.endsWith('.json')) continue
      const id = name.slice(0, -5)
      if (!found.has(id)) found.set(id, path.join(dir, source.name, name))
    }
  }
  return found
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const openingFile = arg('--opening')
  if (openingFile) {
    const fresh = clipsFromOpening(openingFile)
    if (!dryRun) writeFileSync(FIXTURE, `${JSON.stringify(fresh, null, 1)}\n`)
    console.log(`Clip list: ${fresh.clips.length} clips from ${openingFile}${dryRun ? ' (dry run, not saved)' : ''}`)
  }
  if (!existsSync(FIXTURE)) throw new Error(`No clip list at ${FIXTURE}. Pass --opening <saved opening json>.`)
  const live = JSON.parse(readFileSync(FIXTURE, 'utf8')) as LiveClips
  const workDir = arg('--work') || '/workspace/own-cms/content-load/work'
  const index = workIndex(workDir)
  const fixes = existsSync(FIXES) ? (JSON.parse(readFileSync(FIXES, 'utf8')) as WordFixes) : null
  const hits: (FixHit & { cutId: number; youtubeId: string })[] = []
  const tracks = []
  const problems: string[] = []
  for (const clip of live.clips) {
    const file = index.get(clip.youtubeId)
    if (!file) {
      problems.push(`cut ${clip.cutId} ${clip.youtubeId}: no work file`)
      continue
    }
    const work = JSON.parse(readFileSync(file, 'utf8')) as WorkFile
    const track = clipWordsTrack(work, clip, {
      fixes: fixesFor(fixes, clip.youtubeId),
      onFix: (hit) => hits.push({ ...hit, cutId: clip.cutId, youtubeId: clip.youtubeId }),
    })
    if (!track) {
      problems.push(`cut ${clip.cutId} ${clip.youtubeId}: no timed words in ${clip.start}-${clip.end}`)
      continue
    }
    const invalid = validateTrack(track)
    if (invalid.length) {
      problems.push(`cut ${clip.cutId}: ${invalid.map((row) => row.message).join(' ')}`)
      continue
    }
    tracks.push({ clip, track, kind: work.kind || 'unknown', cover: shownCoverage(track.sentences, clip.start, clip.end) })
  }
  if (!dryRun) {
    rmSync(OUT, { recursive: true, force: true })
    mkdirSync(OUT, { recursive: true })
    for (const { track } of tracks) writeFileSync(path.join(OUT, fileNameFor(track)), `${JSON.stringify(track)}\n`)
  }
  const atLeast = tracks.filter((row) => row.cover >= 0.8).length
  const manual = tracks.filter((row) => row.kind === 'manual').length
  console.log(`${dryRun ? 'Would write' : 'Wrote'} ${tracks.length} of ${live.clips.length} clip word tracks to ${path.relative(root, OUT)}`)
  console.log(`${atLeast} show words for at least 80% of their clip (a pause longer than ${HOLD_GAP} s shows nothing). ${manual} come from line-timed (manual) captions, spread by length within each line.`)
  if (fixes) {
    const used = new Set<WordFix>(hits.map((row) => row.fix))
    const own = fixes.fixes.length
    const dropped = hits.filter((row) => !row.after).length
    console.log(`Mishearing fixes: ${hits.length} changes from ${used.size} of ${own + fixes.global.length} entries (${dropped} dropped words).`)
    for (const fix of fixes.fixes) if (!used.has(fix)) problems.push(`fix for ${fix.youtubeId} (cut ${fix.cutId ?? '?'}) "${fix.from}" matched nothing`)
    for (const fix of fixes.global) if (!used.has(fix)) console.log(`  (global fix "${fix.from}" matched nothing this run)`)
    if (process.argv.includes('--fixes-report')) {
      for (const row of hits) console.log(`  cut ${row.cutId} ${row.youtubeId} @${row.t.toFixed(2)} [${row.fix.youtubeId ? row.fix.severity : 'global'}] ${row.before} -> ${row.after || '(dropped)'}`)
    }
    const md = arg('--fixes-md')
    if (md) writeFileSync(md, fixesMarkdown(hits))
  }
  for (const row of problems) console.log(`  ! ${row}`)
  if (problems.length) process.exitCode = 1
}

const ORDER = ['offensive', 'jarring', 'mishearing', 'spelling', 'punctuation', 'global']

function fixesMarkdown(hits: (FixHit & { cutId: number; youtubeId: string })[]) {
  const cell = (text: string) => text.replace(/\|/g, '\\|')
  const kind = (hit: FixHit) => (hit.fix.youtubeId ? hit.fix.severity || 'mishearing' : 'global')
  const sorted = [...hits].sort((a, b) => ORDER.indexOf(kind(a)) - ORDER.indexOf(kind(b)) || a.cutId - b.cutId || a.t - b.t)
  const lines = [
    '# Clip word fixes',
    '',
    `${hits.length} changes across ${new Set(hits.map((row) => row.cutId)).size} clips, from content/framing/clip-words-fixes.json.`,
    'Offensive and jarring first. "global" rows are one-spelling-everywhere normalisations (honorifics, Qur\'an, du\'a).',
    '',
    '| kind | clip (cut, video, time) | before | after | why |',
    '| --- | --- | --- | --- | --- |',
  ]
  for (const row of sorted) {
    const clock = `${Math.floor(row.t / 60)}:${String(Math.floor(row.t % 60)).padStart(2, '0')}`
    lines.push(`| ${kind(row)} | ${row.cutId} ${row.youtubeId} ${clock} | ${cell(row.before)} | ${cell(row.after || '(dropped)')} | ${cell(row.fix.reason || '')} |`)
  }
  return `${lines.join('\n')}\n`
}

main()
