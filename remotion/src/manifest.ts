// A manifest.csv is the whole render list: one row, one film, one beat.
import type { BeatId } from './timing'

export type StyleId = 'kinetic' | 'windows' | 'conversation' | 'cinema' | 'unfold'
export const FILM_STYLES: StyleId[] = ['kinetic', 'windows', 'conversation', 'cinema', 'unfold']

export type ManifestRow = {
  title: string
  speaker: string
  youtubeId: string
  beat: BeatId
  start: number
  end: number
  quote: string
  clip: string
  face: boolean
  /** Groups neighbouring films. Empty means the file is one sequence. */
  course: string
}

export type FilmRecord = {
  youtubeId: string
  title: string
  speaker: string
  course: string
  beat: BeatId
  style: StyleId
  src: string
  quote: string
  start: number
  end: number
  face: boolean
}

const BEATS = new Set<BeatId>(['hook', 'turn', 'land'])

const headerKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '')

const HEADER: Record<string, keyof ManifestRow | 'face'> = {
  title: 'title',
  talktitle: 'title',
  speaker: 'speaker',
  youtubeid: 'youtubeId',
  videoid: 'youtubeId',
  beat: 'beat',
  start: 'start',
  end: 'end',
  quote: 'quote',
  verbatimquote: 'quote',
  clip: 'clip',
  clipfilename: 'clip',
  face: 'face',
  facevisible: 'face',
  facevisibleflag: 'face',
  course: 'course',
}

function parseRow(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"'
          index += 1
        } else quoted = false
      } else current += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      cells.push(current.trim())
      current = ''
    } else current += char
  }
  cells.push(current.trim())
  return cells
}

function faceOf(value: string) {
  const text = value.trim().toLowerCase()
  if (!text) return true
  return !['no', 'n', 'false', '0', 'hidden'].includes(text)
}

/** Parse the batch manifest. A blank face flag means the face is in frame. */
export function parseManifest(csv: string): ManifestRow[] {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) return []
  const headers = parseRow(lines[0]).map((cell) => HEADER[headerKey(cell)] || '')
  const rows: ManifestRow[] = []
  for (const line of lines.slice(1)) {
    const cells = parseRow(line)
    const raw: Record<string, string> = {}
    headers.forEach((key, index) => {
      if (key) raw[key] = cells[index] || ''
    })
    const beat = raw.beat as BeatId
    const start = Number(raw.start)
    const end = Number(raw.end)
    if (!raw.youtubeId || !BEATS.has(beat) || !raw.quote || !raw.clip) continue
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    rows.push({
      title: raw.title || raw.youtubeId,
      speaker: raw.speaker || 'The speaker',
      youtubeId: raw.youtubeId,
      beat,
      start,
      end,
      quote: raw.quote,
      clip: raw.clip,
      face: faceOf(raw.face ?? ''),
      course: raw.course || '',
    })
  }
  return rows
}

function courseOffset(course: string) {
  let hash = 0
  for (const char of course) hash = (hash * 33 + char.charCodeAt(0)) >>> 0
  return hash % FILM_STYLES.length
}

/**
 * One style per film. Inside a course the styles cycle, so the next film never
 * repeats the one before it. Courses start on different styles.
 */
export function assignStyles<T extends { course?: string }>(rows: T[]): (T & { style: StyleId })[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const course = row.course || ''
    const index = seen.get(course) || 0
    seen.set(course, index + 1)
    const style = FILM_STYLES[(courseOffset(course) + index) % FILM_STYLES.length]
    return { ...row, style }
  })
}

export function filmSrc(youtubeId: string, beat: BeatId) {
  return `/typography/${youtubeId}/${beat}.mp4`
}

export function sameFilm(held: FilmRecord | undefined, next: Pick<FilmRecord, 'youtubeId' | 'beat' | 'style' | 'quote' | 'start' | 'end'>) {
  if (!held) return false
  return held.youtubeId === next.youtubeId && held.beat === next.beat && held.style === next.style && held.quote === next.quote && held.start === next.start && held.end === next.end
}
