import { youtubeIdFromUrl } from './extractor'
import type { FieldPlacement } from './bring-in-place'
import { broughtInCourseName } from './human-date'
import { CAPTION_QUEUE_DETAIL, bringInNote, captionLang, cleanedTimedTranscript, isUnavailableFilm, publishedClockSeconds, type YoutubeIngest } from './youtube'

export { isUnavailableFilm }

/** Films shorter than this stay unticked. Five minutes on the published clock. */
export const MIN_BRING_IN_SECONDS = 300

export type CaptionFlag = 'yes' | 'no' | 'unknown' | 'unavailable'

export type BringInRow = {
  index: number
  id: string
  url: string
  title: string
  durationSeconds: number | null
  channel: string
  channelId: string
  captions: CaptionFlag
  lineSpeaker: string
  speaker: string
  jibril: string
  ghunya: string
  /** Why the Jibril select was filled, or why it was left blank. */
  jibrilPlace?: FieldPlacement
  /** Why the Ghunya field was filled, or why it was left blank. */
  ghunyaPlace?: FieldPlacement
  skipReason: '' | 'short' | 'duplicate' | 'library' | 'unavailable'
  selected: boolean
}

export function bringInSourceKind(input: string): 'video' | 'playlist' | 'channel' | 'bad' {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return 'bad'
  }
  const host = url.hostname.replace(/^www\./, '')
  if (!(host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com'))) return 'bad'
  const path = url.pathname
  if (path === '/playlist' || (url.searchParams.get('list') && !youtubeIdFromUrl(input))) return 'playlist'
  if (path.startsWith('/@') || path.startsWith('/channel/') || path.startsWith('/c/') || path.startsWith('/user/')) return 'channel'
  if (youtubeIdFromUrl(input)) return 'video'
  if (url.searchParams.get('list')) return 'playlist'
  return 'bad'
}

export function jibrilSection(raw: string | null | undefined) {
  const match = String(raw || '').trim().toUpperCase().match(/^W(\d{1,2})$/)
  if (!match) return ''
  const number = Number(match[1])
  if (number < 1 || number > 20) return ''
  return `W${number}`
}

export function ghunyaHeading(raw: string | null | undefined) {
  return String(raw || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

export type ChannelMapRow = { channelKey: string; speaker: string }

/** The line, then the course, then a channel the desk has mapped. Never the raw channel name. */
export function speakerForCandidate(input: {
  lineSpeaker?: string | null
  courseSpeaker?: string | null
  channel?: string | null
  channelId?: string | null
  channelMap?: ChannelMapRow[] | null
}) {
  const line = String(input.lineSpeaker || '').trim()
  if (line) return line
  const course = String(input.courseSpeaker || '').trim()
  if (course) return course
  const id = String(input.channelId || '').trim().toLowerCase()
  const name = String(input.channel || '').trim().toLowerCase()
  const match = (input.channelMap || []).find((row) => {
    const key = row.channelKey.trim().toLowerCase()
    return key && (key === id || key === name)
  })
  return String(match?.speaker || '').trim()
}

export function markBringInSkips(
  rows: Omit<BringInRow, 'index' | 'skipReason' | 'selected' | 'speaker' | 'jibril' | 'ghunya'>[],
  libraryIds: Set<string>,
): BringInRow[] {
  const seen = new Set<string>()
  return rows.map((row, index) => {
    let skipReason: BringInRow['skipReason'] = ''
    if (seen.has(row.id)) skipReason = 'duplicate'
    else if (libraryIds.has(row.id)) skipReason = 'library'
    else if (row.captions === 'unavailable' || isUnavailableFilm({ title: row.title })) skipReason = 'unavailable'
    else if (row.durationSeconds != null && row.durationSeconds < MIN_BRING_IN_SECONDS) skipReason = 'short'
    seen.add(row.id)
    return { ...row, index, speaker: '', jibril: '', ghunya: '', skipReason, selected: skipReason === '' }
  })
}

export type ListedEntry = {
  id: string
  title: string
  durationRaw: number | null
  channel: string
  channelId: string
  captions: CaptionFlag | ''
  playlistTitle: string
}

/** One yt-dlp flat-playlist line: id, title, duration, channel, channel id, captions. */
export function parseFlatPlaylistLine(line: string): ListedEntry | null {
  const parts = line.split('\t')
  const id = (parts[0] || '').trim()
  if (!/^[A-Za-z0-9_-]{6,}$/.test(id)) return null
  const duration = Number(parts[2])
  const flag = (parts[5] || '').trim().toLowerCase()
  const captions: ListedEntry['captions'] = flag === 'yes' || flag === 'no' || flag === 'unavailable' ? flag : flag === 'unknown' ? 'unknown' : ''
  const playlistTitle = cleanPlaylistTitle(parts[6] || (captions ? '' : parts[5] || ''))
  return {
    id,
    title: (parts[1] || '').trim() || `Film ${id}`,
    durationRaw: Number.isFinite(duration) && duration > 0 ? duration : null,
    channel: (parts[3] || '').trim(),
    channelId: (parts[4] || '').trim(),
    captions,
    playlistTitle,
  }
}

/** yt-dlp prints NA when a film is not inside a playlist. */
export function cleanPlaylistTitle(value: string | null | undefined) {
  const title = String(value || '').replace(/\s+/g, ' ').trim()
  if (!title || /^(na|none|null|undefined)$/i.test(title)) return ''
  return title
}

/** Every pasted line is one film, not a playlist or a channel. */
export function looseBringInPaste(raw: string) {
  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return false
  return lines.every((line) => bringInSourceKind(line.split('|')[0] || '') === 'video')
}

function usableFilmTitle(title: string | null | undefined) {
  const value = String(title || '').replace(/\s+/g, ' ').trim()
  if (!value || /^Film [A-Za-z0-9_-]{6,}$/.test(value)) return ''
  return value
}

/**
 * A playlist lends its title. Loose links lend the first film's title, then the channel.
 * A channel with no playlist title lends the channel name.
 */
export function suggestedCourseName(input: {
  playlistTitle?: string | null
  loose: boolean
  videos: { title?: string | null; channel?: string | null }[]
  when?: Date
}) {
  const when = input.when || new Date()
  if (input.loose && input.videos.length === 1) return broughtInCourseName(when).slice(0, 180)
  const playlist = input.loose ? '' : cleanPlaylistTitle(input.playlistTitle)
  const firstTitle = input.videos.map((video) => usableFilmTitle(video.title)).find(Boolean) || ''
  const channel = input.videos.map((video) => String(video.channel || '').trim()).find(Boolean) || ''
  const chosen = input.loose ? firstTitle || channel : playlist || channel || firstTitle
  return (chosen || broughtInCourseName(when)).slice(0, 180)
}

/** A typed speaker wins. Otherwise the channel name, so the box is not left blank. */
export function suggestedCourseSpeaker(input: { typed?: string | null; videos: { channel?: string | null }[] }) {
  const typed = String(input.typed || '').trim()
  if (typed) return typed.slice(0, 120)
  const channel = input.videos.map((video) => String(video.channel || '').trim()).find(Boolean) || ''
  return channel.slice(0, 120)
}

export function clockFromListed(durationRaw: number | null) {
  return publishedClockSeconds(durationRaw)
}

/** "No captions" waits for the helper, which can run speech-to-text. The desk still says there are no captions. */
export function decideBringInWrite(result: YoutubeIngest, wantTranscript: boolean, lang: string) {
  const code = captionLang(lang)
  if (isUnavailableFilm({ title: result.meta?.title, error: result.ok ? '' : result.error }) || (!result.ok && result.captionOutcome === 'unavailable')) {
    const reason = !result.ok && result.error ? result.error : 'This film is not available.'
    return {
      note: bringInNote('failed', reason, code),
      source: 'none' as const,
      bucket: 'failed' as const,
      transcript: undefined as string | undefined,
      raw: undefined as string | undefined,
    }
  }
  if (!result.id) {
    return {
      note: bringInNote('failed', result.ok ? 'That link had no film id.' : result.error, code),
      source: 'none' as const,
      bucket: 'failed' as const,
      transcript: undefined as string | undefined,
      raw: undefined as string | undefined,
    }
  }
  const filmOnly = !wantTranscript
  const outcome = result.ok ? 'captions' : result.captionOutcome
  if (result.ok) {
    const stored = cleanedTimedTranscript(result.transcript)
    return {
      note: bringInNote('processed', `Captions fetched by ${result.provider}.`, code),
      source: 'youtube' as const,
      bucket: 'saved' as const,
      transcript: stored.cleaned,
      raw: stored.raw,
    }
  }
  if (filmOnly) {
    return {
      note: bringInNote('waiting', CAPTION_QUEUE_DETAIL, code),
      source: 'pending' as const,
      bucket: 'waiting' as const,
      transcript: undefined,
      raw: undefined,
    }
  }
  if (outcome === 'blocked' || outcome === 'failed' || outcome === 'missing') {
    return {
      note: bringInNote('waiting', result.error, code),
      source: 'pending' as const,
      bucket: 'waiting' as const,
      transcript: undefined,
      raw: undefined,
    }
  }
  if (outcome === 'none') {
    return {
      note: bringInNote('waiting', result.error, code),
      source: 'pending' as const,
      bucket: 'waiting' as const,
      transcript: undefined,
      raw: undefined,
    }
  }
  return {
    note: bringInNote('failed', result.error, code),
    source: 'none' as const,
    bucket: 'failed' as const,
    transcript: undefined,
    raw: undefined,
  }
}

export function skipLabel(reason: BringInRow['skipReason']) {
  if (reason === 'short') return 'Under 5 minutes, left unticked'
  if (reason === 'library') return 'Already in the library'
  if (reason === 'duplicate') return 'Already in this list'
  if (reason === 'unavailable') return 'Not available, left unticked'
  return ''
}

/** Draft talks a desk can publish. Master sees every draft. A portal admin sees drafts made in that portal. */
export function draftLessonWhere(actor: { role: string; portalId: number | null }) {
  if (actor.role === 'master') return { publishState: { equals: 'draft' } }
  return {
    and: [
      { publishState: { equals: 'draft' } },
      { master: { not_equals: true } },
      { portal: { equals: actor.portalId || 0 } },
    ],
  }
}
