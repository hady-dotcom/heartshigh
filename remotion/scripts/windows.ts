// Writes remotion/talks/windows.json: the footage to download for each beat.
// Each beat is snapped to a whole sentence, with about 0.3s of breath in the pause,
// then 10s of padding either side. Times are seconds in the full talk.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { draftTiers, sentencesOf, type Spoken } from '../../hearts-prototype/src/lib/tiers.ts'
import { BREATH, snapBeat, sourceWindow, WINDOW_PAD } from '../src/timing.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const hearts = path.join(root, 'hearts-prototype')
const audioDir = path.join(hearts, 'content', 'audio')
const TALKS = [
  { id: 'ECaTWkof57E', title: 'Ar-Rabb' },
  { id: 'NIR88RRpat4', title: 'Al-Nur' },
  { id: 'TLCGBj4AlB0', title: 'How to Live Like the Prophet' },
] as const

const round = (value: number) => Math.round(value * 100) / 100

function transcript(id: string) {
  const vtt = path.join(hearts, 'content', 'transcripts', 'starters', `${id}.vtt`)
  if (existsSync(vtt)) return readFileSync(vtt, 'utf8')
  if (id === 'NIR88RRpat4') return readFileSync(path.join(hearts, 'content', 'transcripts', 'mikaeel-al-nur.md'), 'utf8')
  throw new Error(`No transcript for ${id}`)
}

function parts(id: string) {
  const single = ['.m4a', '.mp3', '.wav', '.aac'].map((ext) => path.join(audioDir, `${id}${ext}`)).find((file) => existsSync(file))
  if (single) return [{ file: single, start: 0 }]
  const found = [0, 1, 2, 3, 4]
    .map((index) => path.join(audioDir, `${id}-part${index}.m4a`))
    .filter((file) => existsSync(file))
  let cursor = 0
  return found.map((file) => {
    const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }))
    const span = { file, start: cursor }
    cursor += duration
    return span
  })
}

function locate(id: string, talkAt: number) {
  const spans = parts(id)
  const span = spans.find((row, index) => talkAt >= row.start && (index === spans.length - 1 || talkAt < spans[index + 1].start))
  if (!span) throw new Error(`${id} has no audio at ${talkAt}`)
  return { file: span.file, offset: talkAt - span.start }
}

/** Mean absolute amplitude in 0.05s steps. Speech is a bin at or above 0.02. */
function energy(file: string, start: number, duration: number) {
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-ss', start.toFixed(3), '-t', duration.toFixed(3), '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 32_000_000 })
  const step = 800
  const bins: boolean[] = []
  for (let index = 0; index + step <= raw.length / 4; index += step) {
    let sum = 0
    for (let sample = 0; sample < step; sample++) sum += Math.abs(raw.readFloatLE((index + sample) * 4))
    bins.push(sum / step >= 0.02)
  }
  return bins
}

/**
 * Spoken edges of one caption sentence.
 * Caption times can sit a little early or late, so the start is the phrase that
 * begins out of a pause nearest the caption, and the end is the last phrase of
 * this sentence before the next one. A gap under 0.15s is a consonant, not a
 * new sentence. The cut then keeps about 0.3s of the pause on either side.
 */
function speechEdges(id: string, sentence: Spoken, nextStart: number) {
  const span = 2.2
  const from = Math.max(0, sentence.start - span)
  const until = Math.max(sentence.end, nextStart) + span
  const { file, offset } = locate(id, from)
  const bins = energy(file, offset, until - from)
  const at = (index: number) => from + index * 0.05
  const raw: { start: number; end: number }[] = []
  let open = -1
  bins.forEach((spoken, index) => {
    if (spoken && open < 0) open = index
    if (!spoken && open >= 0) {
      raw.push({ start: open, end: index })
      open = -1
    }
  })
  if (open >= 0) raw.push({ start: open, end: bins.length })
  const kept = raw.filter((run, index) => {
    if (run.end - run.start >= 2) return true
    const previous = index > 0 ? run.start - raw[index - 1].end : 99
    const following = index + 1 < raw.length ? raw[index + 1].start - run.end : 99
    return previous < 8 || following < 8
  })
  const runs: { start: number; end: number }[] = []
  for (const run of kept) {
    const prev = runs[runs.length - 1]
    if (prev && run.start - prev.end < 3) prev.end = run.end
    else runs.push({ ...run })
  }
  const begins = (run: { start: number }) => at(run.start)
  const ends = (run: { end: number }) => at(run.end)
  const paused = (run: { start: number }) => {
    let quiet = 0
    for (let index = run.start - 1; index >= 0 && !bins[index]; index--) quiet += 0.05
    return quiet >= 0.2
  }
  const startRun = runs.find((run) => paused(run) && begins(run) >= sentence.start - 0.9 && begins(run) <= sentence.start + 1.2 && ends(run) - begins(run) >= 0.15)
  const speechStart = startRun ? begins(startRun) : sentence.start
  // A run that begins with the next caption is the next sentence. A run that
  // started earlier still belongs here, even when its last word lands a little late.
  const own = runs.filter((run) => {
    if (begins(run) < speechStart - 0.05 || begins(run) >= nextStart - 0.15) return false
    const gapBefore = (() => {
      let quiet = 0
      for (let index = run.start - 1; index >= 0 && !bins[index]; index--) quiet += 0.05
      return quiet
    })()
    // A short pop after the caption has already ended, with a long pause before it, is not the last word.
    if (ends(run) - begins(run) < 0.2 && begins(run) > sentence.end && gapBefore > 0.6) return false
    return true
  })
  let speechEnd = own.length ? ends(own[own.length - 1]) : sentence.end
  if (speechEnd > nextStart + 0.45) speechEnd = nextStart
  const startIndex = Math.round((speechStart - from) / 0.05)
  const endIndex = Math.round((speechEnd - from) / 0.05)
  let lead = 0
  for (let index = startIndex - 1; index >= 0 && !bins[index]; index--) lead += 0.05
  let tail = 0
  const tailFrom = Math.min(endIndex, bins.length)
  for (let index = tailFrom; index < bins.length && !bins[index]; index++) tail += 0.05
  const nextBin = tailFrom + Math.round(tail / 0.05)
  if (tail > 0.05 && nextBin < bins.length && bins[nextBin]) tail -= 0.05
  return { speechStart: round(speechStart), speechEnd: round(speechEnd), before: round(Math.max(0, speechStart - lead)), after: round(speechEnd + Math.max(tail, 0.05)) }
}

function nearestSentence(sentences: Spoken[], at: number, text: string) {
  const want = text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
  const same = sentences.filter((sentence) => sentence.text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim() === want)
  const pool = same.length ? same : sentences
  return pool.reduce((best, sentence) => (Math.abs(sentence.start - at) < Math.abs(best.start - at) ? sentence : best))
}

const talks = TALKS.map((talk) => {
  const raw = transcript(talk.id)
  const draft = draftTiers(raw)
  if (!draft) throw new Error(`${talk.id} has no draft`)
  const sentences = sentencesOf(raw)
  const beats = (['hook', 'turn', 'land'] as const).map((beat) => {
    const text = draft[beat]
    const sentence = nearestSentence(sentences, draft[`${beat}At`], text)
    const index = sentences.indexOf(sentence)
    const nextStart = index + 1 < sentences.length ? sentences[index + 1].start : sentence.end + 2
    const { speechStart, speechEnd, before, after } = speechEdges(talk.id, sentence, nextStart)
    const edge = snapBeat(speechStart, speechEnd, before, after)
    const window = sourceWindow({ ...edge, in: round(edge.in), out: round(edge.out) })
    return {
      beat,
      text,
      sentenceStart: round(sentence.start),
      sentenceEnd: round(sentence.end),
      nextCaption: round(nextStart),
      speechStart,
      speechEnd,
      before: round(before),
      after: round(after),
      in: round(edge.in),
      out: round(edge.out),
      window,
    }
  })
  return { id: talk.id, title: talk.title, beats }
})

const dest = path.join(root, 'remotion', 'talks', 'windows.json')
mkdirSync(path.dirname(dest), { recursive: true })
writeFileSync(dest, JSON.stringify({ breathSeconds: BREATH, padSeconds: WINDOW_PAD, talks }, null, 2) + '\n')
for (const talk of talks) {
  console.log(`\n${talk.title} (${talk.id})`)
  for (const beat of talk.beats) {
    console.log(`  ${beat.beat}  sentence ${beat.sentenceStart}–${beat.sentenceEnd}  next ${beat.nextCaption}  speech ${beat.speechStart}–${beat.speechEnd}  cut ${beat.in}–${beat.out}  window ${beat.window.start}–${beat.window.end} (${(beat.window.end - beat.window.start).toFixed(2)}s)`)
  }
}
console.log(`\n${dest}`)
