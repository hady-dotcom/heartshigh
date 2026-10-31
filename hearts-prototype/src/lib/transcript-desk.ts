// The Transcripts desk: one row per talk, timed lines you can fix, and those fixes
// flowing into clip lines that quote the same words.

import { formatTimestamp, parseTranscript, type Cue } from './transcript'
import { hiddenFromLearners, segmentsToVtt } from './youtube'

export const SHORT_SECONDS = 5 * 60
const HISTORY_CAP = 12

export type TranscriptVersion = { at: string; text: string; label: string }
export type TranscriptEdits = { history: TranscriptVersion[]; redo: TranscriptVersion[] }

export type TranscriptRow = {
  id: number
  title: string
  speaker: string
  seconds: number
  lengthLabel: string
  youtubeId: string
  initial: string
  sourceLabel: string
  timingLabel: string
  courses: string[]
  status: string
  hasTranscript: boolean
  timed: boolean
  tooShort: boolean
  canFetch: boolean
}

export function sourceLabel(source: string, hasTranscript: boolean) {
  if (!hasTranscript) return 'None yet'
  if (source === 'youtube') return 'YouTube captions'
  return 'Uploaded'
}

export function talkStatus(input: { hasTranscript: boolean; timed: boolean; publishState: string; note: string }) {
  if (!input.hasTranscript) return 'No transcript'
  if (!input.timed) return 'No timing'
  if (hiddenFromLearners(input.note)) return 'Not shown to learners'
  if (input.publishState === 'draft') return 'Draft'
  return 'Ready'
}

export function lengthSeconds(durationSeconds: number, cues: Cue[], timed: boolean) {
  if (durationSeconds > 0) return Math.round(durationSeconds)
  if (timed && cues.length) return Math.max(0, Math.round(cues[cues.length - 1].end))
  return 0
}

export function describeTalk(input: {
  id: number
  title: string
  speaker: string
  durationSeconds: number
  youtubeId: string
  transcript: string
  transcriptSource: string
  transcriptNote: string
  publishState: string
  courses: string[]
}): TranscriptRow {
  const title = input.title.trim() || 'Untitled talk'
  const parsed = parseTranscript(input.transcript || '')
  const hasTranscript = Boolean(input.transcript.trim()) && parsed.cues.length > 0
  const timed = hasTranscript && parsed.timed
  const seconds = lengthSeconds(input.durationSeconds, parsed.cues, timed)
  const youtubeId = input.youtubeId.trim()
  return {
    id: input.id,
    title,
    speaker: input.speaker.trim() || 'Speaker not named',
    seconds,
    lengthLabel: seconds > 0 ? formatTimestamp(seconds) : 'Length not set',
    youtubeId,
    initial: title.slice(0, 1).toUpperCase(),
    sourceLabel: sourceLabel(input.transcriptSource, hasTranscript),
    timingLabel: !hasTranscript ? 'No lines yet' : timed ? 'Has times' : 'No times',
    courses: input.courses.length ? input.courses : ['No course yet'],
    status: talkStatus({ hasTranscript, timed, publishState: input.publishState, note: input.transcriptNote }),
    hasTranscript,
    timed,
    tooShort: seconds > 0 && seconds < SHORT_SECONDS,
    canFetch: !hasTranscript && /^[\w-]{11}$/.test(youtubeId),
  }
}

export function coursesForFilm(youtubeId: string, lessonId: number, rows: { id: number; youtubeId: string; course: string }[]) {
  const id = youtubeId.trim()
  const names: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const same = id ? row.youtubeId.trim() === id : row.id === lessonId
    if (!same) continue
    const course = row.course.trim()
    if (!course || seen.has(course)) continue
    seen.add(course)
    names.push(course)
  }
  return names
}

export function filterTalks(
  rows: TranscriptRow[],
  query: { q?: string; missing?: boolean; untimed?: boolean; short?: boolean },
) {
  const q = (query.q || '').trim().toLowerCase()
  const narrowed = Boolean(query.missing || query.untimed || query.short)
  return rows.filter((row) => {
    if (q) {
      const hay = [row.title, row.speaker, row.courses.join(' '), row.status, row.sourceLabel].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (!narrowed) return true
    return Boolean(
      (query.missing && !row.hasTranscript) || (query.untimed && row.hasTranscript && !row.timed) || (query.short && row.tooShort),
    )
  })
}

export function replaceInLines<T extends { text: string }>(lines: T[], find: string, replace: string) {
  if (!find) return { lines, count: 0 }
  let count = 0
  const next = lines.map((line) => {
    if (!line.text.includes(find)) return line
    count += line.text.split(find).length - 1
    return { ...line, text: line.text.split(find).join(replace) }
  })
  return { lines: next, count }
}

export function cuesToTranscript(cues: Cue[], timed: boolean) {
  const kept = cues.map((cue) => ({ ...cue, text: cue.text.replace(/\s+/g, ' ').trim() })).filter((cue) => cue.text)
  if (!kept.length) return ''
  if (!timed) return kept.map((cue) => cue.text).join('\n\n')
  return segmentsToVtt(kept)
}

export function sameCues(left: Cue[], right: Cue[]) {
  if (left.length !== right.length) return false
  return left.every(
    (cue, index) =>
      cue.text === right[index].text && Math.abs(cue.start - right[index].start) < 0.02 && Math.abs(cue.end - right[index].end) < 0.02,
  )
}

export function downloadVtt(transcript: string, title: string) {
  const parsed = parseTranscript(transcript || '')
  const body = parsed.cues.length ? segmentsToVtt(parsed.cues) : 'WEBVTT\n\n'
  const file = `${(title || 'transcript').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'transcript'}.vtt`
  return { body, file }
}

function blankEdits(): TranscriptEdits {
  return { history: [], redo: [] }
}

export function readEdits(value: unknown): TranscriptEdits {
  let parsedValue = value
  if (typeof parsedValue === 'string') {
    try {
      parsedValue = JSON.parse(parsedValue) as unknown
    } catch {
      return blankEdits()
    }
  }
  if (!parsedValue || typeof parsedValue !== 'object') return blankEdits()
  const row = parsedValue as { history?: unknown; redo?: unknown }
  const list = (items: unknown) =>
    Array.isArray(items)
      ? items.filter((item): item is TranscriptVersion => Boolean(item && typeof item === 'object' && typeof (item as TranscriptVersion).text === 'string'))
      : []
  return { history: list(row.history).slice(-HISTORY_CAP), redo: list(row.redo).slice(-HISTORY_CAP) }
}

export function pushVersion(edits: TranscriptEdits | null, current: string, label: string, at: string): TranscriptEdits {
  const history = [...readEdits(edits).history]
  if (current.trim()) history.push({ at, text: current, label })
  return { history: history.slice(-HISTORY_CAP), redo: [] }
}

export function undoVersion(edits: TranscriptEdits | null, current: string, at: string) {
  const parsed = readEdits(edits)
  const history = [...parsed.history]
  const prev = history.pop()
  if (!prev) return null
  const redo = [...parsed.redo, { at, text: current, label: 'Before undo' }].slice(-HISTORY_CAP)
  return { edits: { history, redo }, text: prev.text }
}

export function redoVersion(edits: TranscriptEdits | null, current: string, at: string) {
  const parsed = readEdits(edits)
  const redo = [...parsed.redo]
  const next = redo.pop()
  if (!next) return null
  const history = [...parsed.history, { at, text: current, label: 'Before redo' }].slice(-HISTORY_CAP)
  return { edits: { history, redo }, text: next.text }
}

type Swap = { from: string; to: string; words: { from: string; to: string }[] }

function wordSwaps(from: string, to: string) {
  const left = from.split(/\s+/).filter(Boolean)
  const right = to.split(/\s+/).filter(Boolean)
  if (!left.length || left.length !== right.length) return []
  const swaps: { from: string; to: string }[] = []
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index] && left[index].length >= 3) swaps.push({ from: left[index], to: right[index] })
  }
  return swaps
}

export function lineSwaps(before: Cue[], after: Cue[]): Swap[] {
  const used = new Set<number>()
  const swaps: Swap[] = []
  for (const cue of before) {
    let hit = after.findIndex((row, index) => !used.has(index) && Math.abs(row.start - cue.start) < 0.051)
    if (hit < 0) continue
    used.add(hit)
    const next = after[hit].text.replace(/\s+/g, ' ').trim()
    const prev = cue.text.replace(/\s+/g, ' ').trim()
    if (!prev || prev === next) continue
    swaps.push({ from: prev, to: next, words: wordSwaps(prev, next) })
  }
  return swaps
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceWholeWord(text: string, from: string, to: string) {
  const pattern = new RegExp(`\\b${escapeRegExp(from)}\\b`, 'g')
  return text.replace(pattern, to)
}

/** Put edited lines into clip text that quotes them. A one-word fix such as Rokua → Ruku follows too. */
export function rewriteSpoken(before: Cue[], after: Cue[], text: string) {
  let next = text || ''
  let changed = false
  for (const swap of lineSwaps(before, after)) {
    if (swap.from.length >= 8 && next.includes(swap.from)) {
      next = next.split(swap.from).join(swap.to)
      changed = true
    }
    for (const word of swap.words) {
      const replaced = replaceWholeWord(next, word.from, word.to)
      if (replaced !== next) {
        next = replaced
        changed = true
      }
    }
  }
  return { text: next, changed }
}

export function rewriteStrings(before: Cue[], after: Cue[], fields: Record<string, string>) {
  const next = { ...fields }
  let changed = false
  for (const key of Object.keys(fields)) {
    const rewritten = rewriteSpoken(before, after, fields[key] || '')
    next[key] = rewritten.text
    if (rewritten.changed) changed = true
  }
  return { fields: next, changed }
}

export function transcriptSaveNotice(input: { changedLines: number; flowed: number; approved: number; skipped: number }) {
  const parts = ['Saved.']
  if (input.changedLines) parts.push(`${input.changedLines} ${input.changedLines === 1 ? 'line' : 'lines'} changed.`)
  if (input.flowed) parts.push('Clips that use those lines were updated.')
  if (input.approved === 1) parts.push('An approved clip changed. Check it before learners see the new words.')
  else if (input.approved > 1) parts.push(`${input.approved} approved clips changed. Check them before learners see the new words.`)
  if (input.skipped === 1) parts.push('One clip kept its old line, because the new words did not fit that clip.')
  else if (input.skipped > 1) parts.push(`${input.skipped} clips kept their old lines, because the new words did not fit.`)
  return parts.join(' ')
}

export function isApprovedClip(status: string) {
  return status === 'approved' || status === 'checked'
}
