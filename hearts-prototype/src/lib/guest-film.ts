import { vimeoPlayerSrc } from './vimeo'

/** One film in the "Up next" row. */
export type GuestNext = {
  lessonId: number
  title: string
  place: number
  poster: string | null
  href: string
  seconds: number | null
}

/** The first film a signed-out visitor can press play on. */
export type GuestFilm = {
  courseId: number
  courseTitle: string
  lessonId: number
  title: string
  place: number
  poster: string | null
  /** A real sentence from the film or the course, never a made-up plot. */
  description: string
  /** Null when the length is missing or under five seconds. */
  seconds: number | null
  filmCount: number
  vimeoId: string
  vimeoHash: string | null
  youtubeId: string | null
  href: string
  coursesHref: string
  /** Every film in this course, for a signed-out visitor. */
  listHref: string
  upNext: GuestNext[]
}

/** A stored length a guest can trust. Anything under five seconds stays unknown. */
export function knownSeconds(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  if (!Number.isFinite(n) || n < 5) return null
  return Math.round(n)
}

function tidy(raw: string) {
  return raw.replace(/\s+/g, ' ').trim()
}

function clip(raw: string) {
  const text = tidy(raw).replace(/^[\d.\s:-]+/, '').trim()
  if (text.length < 8) return ''
  const sentence = text.split(/(?<=[.!?])\s+/)[0] || text
  if (sentence.length <= 160) return sentence
  const cut = sentence.slice(0, 157)
  const space = cut.lastIndexOf(' ')
  const base = (space > 60 ? cut.slice(0, space) : cut).trim()
  return `${base}…`
}

/** The first spoken line of a caption file, skipping the WEBVTT header and notes. */
export function firstSpoken(raw: string) {
  const lines = String(raw || '').replace(/^\uFEFF/, '').split(/\r?\n/)
  const kept: string[] = []
  let note = false
  for (const line of lines) {
    const text = line.trim()
    if (!text || /^WEBVTT\b/i.test(text)) {
      note = false
      continue
    }
    if (/^NOTE\b/i.test(text)) {
      note = true
      continue
    }
    if (note) continue
    if (/-->/.test(text) || /^\d+$/.test(text)) continue
    kept.push(text)
    if (kept.join(' ').length > 240) break
  }
  return clip(kept.join(' '))
}

/** Transcript sentence, then the course summary, then a factual place line. */
export function guestDescription(input: { transcript?: string | null; summary?: string | null; place: number; count: number; courseTitle: string }) {
  const spoken = firstSpoken(input.transcript || '')
  if (spoken) return spoken
  const summary = clip(input.summary || '')
  if (summary) return summary
  const title = (input.courseTitle || '').trim() || 'this course'
  const count = Math.max(1, Math.floor(Number(input.count)) || 1)
  const place = Math.max(1, Math.floor(Number(input.place)) || 1)
  return `Film ${place} of ${count} in ${title}.`
}

/** A Vimeo player postMessage event name, or '' when the message is not one of ours. */
export function vimeoPlayerEvent(data: unknown): string {
  if (typeof data === 'string') {
    try {
      return vimeoPlayerEvent(JSON.parse(data))
    } catch {
      return ''
    }
  }
  if (!data || typeof data !== 'object') return ''
  const event = (data as { event?: unknown }).event
  return typeof event === 'string' ? event : ''
}

export function guestPlayerSrc(film: Pick<GuestFilm, 'vimeoId' | 'vimeoHash' | 'youtubeId'>, autoplay: boolean) {
  const extra: Record<string, string> = { playsinline: '1', autopause: '0' }
  if (autoplay) extra.autoplay = '1'
  if (film.vimeoId) return vimeoPlayerSrc(film.vimeoId, film.vimeoHash, extra)
  if (film.youtubeId) {
    const params = new URLSearchParams({ playsinline: '1', rel: '0' })
    if (autoplay) params.set('autoplay', '1')
    return `https://www.youtube-nocookie.com/embed/${film.youtubeId}?${params.toString()}`
  }
  return ''
}
