// Search and filters for the library of talks. No database. The screen and the tests share this.
import { approvedTeacherBySlug, matchApprovedTeacher } from './approved-teachers'
import { capitalAfterColon, doorByNumber, doorCode, doorLabel } from './doors'
import { isUnderMinTalk } from './talk-length'
import { hiddenFromLearners } from './youtube'

export const TALK_PAGE_SIZE = 12

export type TalkStatus = 'draft' | 'published' | 'needs-captions'
export type TalkSource = 'youtube' | 'vimeo' | 'file' | 'none'

export type LibraryTalk = {
  id: number
  title: string
  /** Name as stored on the talk. Matching uses the approved catalogue. */
  teacher: string
  series: string
  unit: string
  tags: string[]
  /** Also searched, not shown twice when it repeats the title. */
  also: string
  door: number | null
  status: TalkStatus
  durationSeconds: number | null
  source: TalkSource
  addedAt: string
  binned: boolean
  tooShort: boolean
  courseId: number
  youtubeId: string
  vimeoId: string
}

export type TalkFilters = {
  q?: string
  teacher?: string
  door?: string
  status?: string
  length?: string
  source?: string
  added?: string
}

export type JoinCode = { id: number; code: string; courses: number[] }

export const LENGTH_CHOICES = [
  { value: '5-15', label: '5 to 15 minutes' },
  { value: '15-30', label: '15 to 30 minutes' },
  { value: '30-60', label: '30 to 60 minutes' },
  { value: '60+', label: 'Longer than an hour' },
] as const

export const STATUS_CHOICES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'needs-captions', label: 'Needs captions' },
] as const

export const SOURCE_CHOICES = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'vimeo', label: 'Vimeo' },
] as const

export const ADDED_CHOICES = [
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'year', label: 'This year' },
] as const

/** HJ1 to HJ20. The older W-code still matches a search. */
export function hjCode(number: number) {
  return number >= 1 && number <= 20 ? `HJ${number}` : ''
}

export function hjLabel(number: number) {
  const door = doorByNumber(number)
  if (!door) return ''
  return `${hjCode(door.number)} · ${capitalAfterColon(door.title)}`
}

/** Reads HJ10, W10, Door 10, or 10. Anything else is no door. */
export function parseLibraryDoor(raw: string | undefined | null) {
  const match = String(raw || '').trim().match(/^(?:hj|w|door\s*)?\s*(\d{1,2})$/i)
  if (!match) return null
  const number = Number(match[1])
  return number >= 1 && number <= 20 ? number : null
}

export function doorSearchText(number: number | null) {
  if (!number) return ''
  const door = doorByNumber(number)
  if (!door) return ''
  return [hjCode(door.number), hjLabel(door.number), doorCode(door.number), doorLabel(door), capitalAfterColon(door.title), `Door ${door.number}`].join(' ')
}

export function videoSource(input: { videoProvider?: string | null; youtubeId?: string | null; vimeoId?: string | null }): TalkSource {
  const provider = String(input.videoProvider || '')
  const youtubeId = String(input.youtubeId || '').trim()
  const vimeoId = String(input.vimeoId || '').trim()
  if (provider === 'file') return 'file'
  if (provider === 'vimeo') return 'vimeo'
  if (provider === 'youtube' || youtubeId) return 'youtube'
  if (vimeoId) return 'vimeo'
  return 'none'
}

/** No words yet, or the words are still on their way. Otherwise draft or published. */
export function talkStatus(input: {
  publishState?: string | null
  transcript?: string | null
  transcriptSource?: string | null
  transcriptNote?: string | null
}): TalkStatus {
  const words = String(input.transcript || '').trim()
  const source = String(input.transcriptSource || 'none')
  if (!words || source === 'none' || source === 'pending' || hiddenFromLearners(input.transcriptNote)) return 'needs-captions'
  if (input.publishState === 'draft') return 'draft'
  return 'published'
}

export function watchHref(talk: Pick<LibraryTalk, 'source' | 'youtubeId' | 'vimeoId'>) {
  if (talk.source === 'youtube' && talk.youtubeId) return `https://www.youtube.com/watch?v=${encodeURIComponent(talk.youtubeId)}`
  if (talk.source === 'vimeo' && talk.vimeoId) return `https://vimeo.com/${encodeURIComponent(talk.vimeoId)}`
  return ''
}

/** The library list: video talks of at least five minutes, by an approved teacher, not in the bin. */
export function shownInLibrary(talk: LibraryTalk) {
  if (talk.binned) return false
  if (talk.tooShort || isUnderMinTalk(talk.durationSeconds)) return false
  if (talk.source !== 'youtube' && talk.source !== 'vimeo') return false
  if (!matchApprovedTeacher(talk.teacher)) return false
  return true
}

function haystack(talk: LibraryTalk) {
  const teacher = matchApprovedTeacher(talk.teacher)
  const names = teacher ? [teacher.name, teacher.displayName, talk.teacher, ...teacher.aliases] : [talk.teacher]
  return [talk.title, talk.also, talk.series, talk.unit, ...talk.tags, ...names, doorSearchText(talk.door)].join(' ').toLowerCase()
}

function matchesLength(seconds: number | null, length: string) {
  if (!length) return true
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return false
  const minutes = seconds / 60
  if (length === '5-15') return minutes >= 5 && minutes < 15
  if (length === '15-30') return minutes >= 15 && minutes < 30
  if (length === '30-60') return minutes >= 30 && minutes < 60
  if (length === '60+') return minutes >= 60
  return true
}

function matchesAdded(iso: string, added: string, now: Date) {
  if (!added) return true
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return false
  const day = 24 * 60 * 60 * 1000
  if (added === 'today') return time >= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (added === '7') return now.getTime() - time <= 7 * day && now.getTime() - time >= 0
  if (added === '30') return now.getTime() - time <= 30 * day && now.getTime() - time >= 0
  if (added === 'year') return new Date(time).getUTCFullYear() === now.getUTCFullYear()
  return true
}

export function filterLibraryTalks(talks: LibraryTalk[], filters: TalkFilters, now = new Date()) {
  const q = (filters.q || '').trim().toLowerCase()
  const door = parseLibraryDoor(filters.door)
  const teacherSlug = (filters.teacher || '').trim().toLowerCase()
  if (teacherSlug && !approvedTeacherBySlug(teacherSlug)) return []
  return talks
    .filter((talk) => {
      if (!shownInLibrary(talk)) return false
      if (q && !haystack(talk).includes(q)) return false
      if (teacherSlug && matchApprovedTeacher(talk.teacher)?.slug !== teacherSlug) return false
      if (filters.door && door == null) return false
      if (door && talk.door !== door) return false
      if (filters.status && talk.status !== filters.status) return false
      if (!matchesLength(talk.durationSeconds, filters.length || '')) return false
      if (filters.source && talk.source !== filters.source) return false
      if (filters.added && !matchesAdded(talk.addedAt, filters.added, now)) return false
      return true
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'en') || a.id - b.id)
}

export function pageTalks<T>(talks: T[], page: number, size = TALK_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(talks.length / size))
  const current = Math.min(Math.max(Number(page) || 1, 1), pages)
  const start = (current - 1) * size
  return { talks: talks.slice(start, start + size), page: current, pages, total: talks.length }
}

export function talkListHref(base: string, filters: TalkFilters, page = 1) {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.teacher) params.set('teacher', filters.teacher)
  if (filters.door) params.set('door', filters.door)
  if (filters.status) params.set('status', filters.status)
  if (filters.length) params.set('length', filters.length)
  if (filters.source) params.set('source', filters.source)
  if (filters.added) params.set('added', filters.added)
  if (page > 1) params.set('tp', String(page))
  const text = params.toString()
  return text ? `${base}?${text}` : base
}

function copyCodes(codes: JoinCode[]) {
  return codes.map((code) => ({ id: code.id, code: code.code, courses: [...code.courses] }))
}

/** The talk stays on its course. Join codes keep the same letters and the same courses. */
export function moveTalkToBin<T extends { id: number; courseId: number; binned: boolean }>(talk: T, codes: JoinCode[]) {
  return { talk: { ...talk, binned: true }, codes: copyCodes(codes) }
}

export function restoreBinnedTalk<T extends { id: number; courseId: number; binned: boolean }>(talk: T, codes: JoinCode[]) {
  return { talk: { ...talk, binned: false }, codes: copyCodes(codes) }
}

export function emptyBinPlan(input: { ids: number[]; codes: JoinCode[]; sure: boolean }) {
  const codes = copyCodes(input.codes)
  if (!input.sure) return { error: 'Tick Yes, empty the bin. Nothing was removed.', removeIds: [] as number[], codes }
  return { error: null as string | null, removeIds: [...input.ids], codes }
}

export function sameJoinCodes(before: JoinCode[], after: JoinCode[]) {
  if (before.length !== after.length) return false
  return before.every((code, index) => {
    const next = after[index]
    return next.id === code.id && next.code === code.code && next.courses.join(',') === code.courses.join(',')
  })
}
