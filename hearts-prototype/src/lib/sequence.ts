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
} | null | undefined

export function portalShape(portal: ShapeSource): PortalShape {
  return portal?.shape === 'sequence' ? 'sequence' : 'hearts'
}

export function isSequencePortal(portal: ShapeSource) {
  return portalShape(portal) === 'sequence'
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
  paste: 'Paste links, or upload a CSV from a Google Sheet (File → Download → Comma-separated values).',
  captions: 'Captions were not available from here.',
  examples: 'These are example films until the real videos arrive.',
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
