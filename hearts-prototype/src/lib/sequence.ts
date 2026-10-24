import { DOORS, doorCode } from './doors'
import { refusalForTalk, talkClock } from './talk-length'
import { parseVimeoLink } from './vimeo'
import { youtubeIdFromUrl } from './extractor'

/** A portal is a sequenced course only when it says so. Missing means the HEARTS portal it already was. */
export type PortalShape = 'hearts' | 'sequence'

export type ShapeSource = {
  shape?: string | null
  teacherCap?: number | null
  minTalkSeconds?: number | null
  lockOrder?: boolean | null
  colour?: string | null
  accent?: string | null
  /** Explicit false hides kinetic clips on a sequenced course. Missing stays on. */
  kineticOn?: boolean | null
} | null | undefined

export function portalShape(portal: ShapeSource): PortalShape {
  return portal?.shape === 'sequence' ? 'sequence' : 'hearts'
}

export function isSequencePortal(portal: ShapeSource) {
  return portalShape(portal) === 'sequence'
}

/** Kinetic clips stay on unless a sequenced course has switched them off. HEARTS portals are unchanged. */
export function kineticMomentsOn(portal: ShapeSource) {
  if (!isSequencePortal(portal)) return true
  return portal?.kineticOn !== false
}

/** HEARTS portals keep a cap of 19 teachers. A sequenced course has no cap unless one is saved. */
export const HEARTS_TEACHER_CAP = 19

export function teacherCapOf(portal: ShapeSource): number | null {
  const explicit = portal?.teacherCap
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit >= 0) return Math.floor(explicit)
  return isSequencePortal(portal) ? null : HEARTS_TEACHER_CAP
}

export function teacherCapRefusal(count: number, cap: number | null) {
  if (cap == null) return null
  if (count >= cap) return `This portal already has ${cap} teachers. That is the limit.`
  return null
}

/** HEARTS talks stay at five minutes. A sequenced course allows short films unless a minimum is saved. */
export function minTalkSecondsOf(portal: ShapeSource): number {
  const explicit = portal?.minTalkSeconds
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit >= 0) return Math.floor(explicit)
  return isSequencePortal(portal) ? 0 : 300
}

export function isUnderPortalMin(seconds: number | null | undefined, minSeconds: number) {
  if (!(minSeconds > 0)) return false
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 && seconds < minSeconds
}

/** Five minutes keeps the existing sentence. Any other minimum uses its own. */
export function minTalkRefusal(seconds: number | null | undefined, minSeconds: number) {
  if (minSeconds === 300) return refusalForTalk(seconds)
  if (!isUnderPortalMin(seconds, minSeconds)) return null
  return `This film is ${talkClock(Math.round(seconds as number))}. Films need to be at least ${talkClock(minSeconds)}.`
}

/** Hadith Jibril doors stay on HEARTS portals and stay off a sequenced course. */
export function portalUsesJibrilDoors(portal: ShapeSource) {
  return !isSequencePortal(portal)
}

export function heartsDoorCodes() {
  return DOORS.map((door) => doorCode(door.number))
}

export const SEQUENCE_VIDEO_CAP = 200

export type ParsedVideo = {
  provider: 'youtube' | 'vimeo'
  id: string
  hash: string
  url: string
  title: string
  speaker: string
}

export type ParsedList = {
  videos: ParsedVideo[]
  skipped: string[]
  error?: string
}

const URL_HEADER = /url|link|video|youtube|vimeo/i

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const source = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"'
          i += 1
        } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') {
      quoted = true
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (ch === '\n') {
      row.push(cell)
      if (row.some((item) => item.trim())) rows.push(row)
      row = []
      cell = ''
      continue
    }
    if (ch !== '\r') cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    if (row.some((item) => item.trim())) rows.push(row)
  }
  return rows
}

function videoFromUrl(raw: string, title = '', speaker = ''): ParsedVideo | null {
  const input = raw.trim()
  if (!input) return null
  const youtubeId = youtubeIdFromUrl(input)
  if (youtubeId) {
    return { provider: 'youtube', id: youtubeId, hash: '', url: `https://www.youtube.com/watch?v=${youtubeId}`, title: title.trim(), speaker: speaker.trim() }
  }
  const vimeo = parseVimeoLink(input)
  if (vimeo) return { provider: 'vimeo', id: vimeo.id, hash: vimeo.hash, url: vimeo.url, title: title.trim(), speaker: speaker.trim() }
  return null
}

function splitTitleUrl(line: string) {
  const pipe = line.split('|')
  if (pipe.length >= 2) {
    const url = pipe[pipe.length - 1].trim()
    if (videoFromUrl(url)) return { title: pipe.slice(0, -1).join('|').trim(), url, speaker: '' }
  }
  return { title: '', url: line.trim(), speaker: '' }
}

function fromTable(rows: string[][]): { videos: { title: string; url: string; speaker: string }[]; used: boolean } {
  if (!rows.length) return { videos: [], used: false }
  const head = rows[0].map((cell) => cell.trim().toLowerCase())
  const urlAt = head.findIndex((cell) => URL_HEADER.test(cell))
  const titleAt = head.findIndex((cell) => cell === 'title' || cell === 'name' || cell === 'film')
  const speakerAt = head.findIndex((cell) => cell === 'speaker' || cell === 'author' || cell === 'name of speaker')
  if (urlAt < 0 && titleAt < 0) return { videos: [], used: false }
  const videos = rows.slice(1).map((cells) => {
    const url = urlAt >= 0 ? cells[urlAt] || '' : cells.find((cell) => videoFromUrl(cell)) || ''
    return { title: titleAt >= 0 ? cells[titleAt] || '' : '', url, speaker: speakerAt >= 0 ? cells[speakerAt] || '' : '' }
  })
  return { videos, used: true }
}

/** Paste, CSV, or a Google Sheet saved as CSV. Order is the order of the rows. */
export function parseVideoList(raw: string): ParsedList {
  const text = String(raw || '').replace(/^\uFEFF/, '').trim()
  if (!text) return { videos: [], skipped: [] }
  const looksLikeCsv = text.includes(',') && (text.includes('"') || /^(title|url|link|name|speaker)\b/i.test(text))
  const table = looksLikeCsv ? fromTable(parseCsv(text)) : { videos: [], used: false }
  const rows = table.used
    ? table.videos
    : text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map(splitTitleUrl)
  const videos: ParsedVideo[] = []
  const skipped: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const video = videoFromUrl(row.url, row.title, row.speaker)
    if (!video) {
      if (row.url.trim()) skipped.push(`Skipped a line that is not a YouTube or Vimeo link.`)
      continue
    }
    const key = `${video.provider}:${video.id}`
    if (seen.has(key)) {
      skipped.push(`Skipped a repeat of ${video.url}.`)
      continue
    }
    seen.add(key)
    videos.push(video)
  }
  if (videos.length > SEQUENCE_VIDEO_CAP) {
    return { videos: [], skipped, error: `That list has more than ${SEQUENCE_VIDEO_CAP} films. Split it and add the rest after.` }
  }
  return { videos, skipped }
}

export type CourseCallout = {
  /** Seconds into the film. An "end" mark with no length yet is 0, so the question is on screen. */
  second: number
  atEnd: boolean
  type: string
  kind: 'question' | 'multiple_choice'
  prompt: string
  options: string[]
  correct: string
}

export type CourseFilm = {
  order: number
  module: string
  /** The sheet's own title. Learners see publicTitle. */
  title: string
  publicTitle: string
  vimeoId: string
  vimeoLink: string
  drive: string
  transcript: string
  callouts: CourseCallout[]
}

export type CourseSheet = {
  films: CourseFilm[]
  skipped: string[]
  error?: string
}

const CHOICE_TYPE = /^(?:choice|multiple|multiple_choice|mcq)$/i
const CALLOUT = /^\[(\d+(?:\.\d+)?|end)\s+([a-z0-9_-]+)\]\s*([\s\S]+)$/i

function headerIndex(head: string[], name: string) {
  return head.findIndex((cell) => cell === name)
}

/** A bare number, scientific notation from a spreadsheet, or blank. */
export function plainVimeoId(raw: string) {
  const text = raw.trim()
  if (!text) return ''
  if (/^\d{6,12}$/.test(text)) return text
  if (/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)) {
    const number = Math.round(Number(text))
    if (Number.isFinite(number) && number > 0) return String(number)
  }
  return ''
}

function calloutFrom(piece: string): CourseCallout | null {
  const match = CALLOUT.exec(piece.trim())
  if (!match) return null
  let prompt = match[3].trim()
  let options: string[] = []
  let correct = ''
  const tail = prompt.match(/^(.*)\(([^()]*)\)\s*$/)
  if (tail && tail[2].includes(';')) {
    prompt = tail[1].trim()
    for (const part of tail[2].split(';').map((item) => item.trim()).filter(Boolean)) {
      const marked = part.match(/^correct\s*:\s*(.+)$/i)
      if (marked) correct = marked[1].trim()
      else options.push(part)
    }
  }
  const atEnd = match[1].toLowerCase() === 'end'
  const type = match[2].toLowerCase()
  return {
    second: atEnd ? 0 : Math.max(0, Math.round(Number(match[1]))),
    atEnd,
    type,
    kind: CHOICE_TYPE.test(type) ? 'multiple_choice' : 'question',
    prompt,
    options,
    correct,
  }
}

export function parseCallouts(cell: string): CourseCallout[] {
  return cell.split(/\s*\|\|\s*/).map((piece) => piece.trim()).filter(Boolean).flatMap((piece) => {
    const callout = calloutFrom(piece)
    return callout && callout.prompt ? [callout] : []
  })
}

function courseHeader(cells: string[]) {
  const head = cells.map((cell) => cell.trim().toLowerCase())
  if (!head.includes('public_title') || !head.includes('vimeo_id')) return null
  return head
}

/** True when the text is the Guiding-style course sheet, not a plain list of links. */
export function isCourseSheet(raw: string) {
  const text = String(raw || '').replace(/^\uFEFF/, '').trim()
  if (!/public_title/i.test(text) || !/vimeo_id/i.test(text)) return false
  return parseCsv(text).some((cells) => courseHeader(cells) != null)
}

/**
 * order, module, title, public_title, vimeo_id, vimeo_link, final_video_drive, transcript, callouts.
 * Callouts are "[seconds type] question (options; correct)" separated by " || ".
 * A missing Vimeo id stays in the list so the player can show Video coming.
 */
export function parseCourseSheet(raw: string): CourseSheet {
  const text = String(raw || '').replace(/^\uFEFF/, '').trim()
  if (!text) return { films: [], skipped: [] }
  const table = parseCsv(text)
  const headerAt = table.findIndex((cells) => courseHeader(cells) != null)
  if (headerAt < 0) return { films: [], skipped: [], error: 'That sheet needs a public_title column and a vimeo_id column.' }
  const head = table[headerAt].map((cell) => cell.trim().toLowerCase())
  const at = (name: string) => headerIndex(head, name)
  const films: CourseFilm[] = []
  const skipped: string[] = []
  const seen = new Set<string>()
  for (const cells of table.slice(headerAt + 1)) {
    const value = (name: string) => {
      const index = at(name)
      return index >= 0 ? String(cells[index] || '').trim() : ''
    }
    const title = value('title')
    const publicTitle = value('public_title') || title
    let vimeoId = plainVimeoId(value('vimeo_id'))
    let vimeoLink = value('vimeo_link')
    if (!vimeoId && vimeoLink) vimeoId = parseVimeoLink(vimeoLink)?.id || ''
    if (!vimeoId) vimeoId = plainVimeoId(vimeoLink)
    if (vimeoId && !vimeoLink) vimeoLink = `https://vimeo.com/${vimeoId}`
    if (!publicTitle && !title && !vimeoId) continue
    const orderCell = Number(value('order'))
    const order = Number.isFinite(orderCell) && orderCell > 0 ? Math.round(orderCell) : films.length + 1
    const key = vimeoId ? `vimeo:${vimeoId}` : `title:${title.toLowerCase()}`
    if (seen.has(key)) {
      skipped.push(`Skipped a repeat of ${vimeoId || title || publicTitle}.`)
      continue
    }
    seen.add(key)
    films.push({
      order,
      module: value('module') || 'Films',
      title: title || publicTitle,
      publicTitle,
      vimeoId,
      vimeoLink,
      drive: value('final_video_drive'),
      transcript: value('transcript'),
      callouts: parseCallouts(value('callouts')),
    })
  }
  films.sort((a, b) => a.order - b.order || 0)
  if (films.length > SEQUENCE_VIDEO_CAP) {
    return { films: [], skipped, error: `That list has more than ${SEQUENCE_VIDEO_CAP} films. Split it and add the rest after.` }
  }
  return { films, skipped }
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items.slice()
  const next = items.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function lockMessage(lockOrder: boolean, previousDone: boolean, index: number) {
  if (!lockOrder || index <= 0 || previousDone) return null
  return 'Watch the previous one first.'
}

/** A saved place worth offering. The opening moments and a finished film are not a resume point. */
export function resumeChoice(position: number | null | undefined, duration: number | null | undefined) {
  const at = Number(position)
  if (!Number.isFinite(at) || at < 8) return null
  const length = Number(duration)
  if (Number.isFinite(length) && length > 0 && at >= length - 2) return null
  return Math.floor(at)
}

export function sequenceBar() {
  return [
    { key: 'home' as const, label: 'Home', path: '' },
    { key: 'me' as const, label: 'Me', path: '/me' },
  ]
}

export function sequenceProgress(done: number, total: number) {
  const safeDone = Math.max(0, Math.min(done, total))
  return {
    eyebrow: 'Your progress',
    line: `${safeDone} of ${total} videos`,
    back: 'Back to the list',
  }
}

const ISLAMIC = /\b(hadith|jibril|qur['’]?an|allah|salah|prayers?|mosque|masjid|iman|islam(?:ic)?|muslims?|ghunya|prophet|fajr|ramadan|hajj|zakat|garden)\b/i

export function hasIslamicWording(value: string) {
  return ISLAMIC.test(value)
}

export function hasHeartsWord(value: string) {
  return /\bhearts\b/i.test(value)
}

export function hexColour(value: string, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : fallback
}

export function brandColours(portal: ShapeSource) {
  return {
    colour: hexColour(String(portal?.colour || ''), '#1f3a5f'),
    accent: hexColour(String(portal?.accent || ''), '#e07a5f'),
  }
}

export function httpsLogo(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:') return ''
    return url.toString()
  } catch {
    return ''
  }
}

/** Learner words for a sequenced course. Kept here so a test can read them in one place. */
export const SEQUENCE_COPY = {
  lock: 'Watch the previous one first.',
  progress: 'Your progress',
  videos: 'videos',
  back: 'Back to the list',
  export: 'Export app',
  paste: 'Paste links, or upload a CSV from a Google Sheet. A course sheet with a public title column updates the films already here.',
  captions: 'Captions were not available from here.',
  examples: 'Watch the films in order.',
  sheetUpdated: 'Updated the course.',
  continue: 'Continue',
  signIn: 'Sign in',
  join: 'Join with a code',
  keep: 'Keep my place',
  logout: 'Log out',
  moveUp: 'Move up',
  moveDown: 'Move down',
  shortOk: 'Short films are allowed',
  shortOff: 'Turn away films under 5 minutes',
  anyOrder: 'Any film can be opened',
  lockedOrder: 'Watch the previous one first',
  playClip: 'Play a short clip',
  opening: 'Opening line',
  turn: 'The turn',
  landing: 'Landing line',
  question: 'A question',
  saved: 'Your place in the course is saved on this account.',
  closed: 'This portal is paused. Your progress is kept, and will be here when it opens again.',
} as const
