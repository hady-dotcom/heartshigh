import { youtubeIdFromUrl } from './extractor'
import { publishedClockSeconds, type YoutubeIngest, bringInNote, cleanedTimedTranscript, captionLang } from './youtube'

/** Films shorter than this stay unticked. Five minutes on the published clock. */
export const MIN_BRING_IN_SECONDS = 300

export type CaptionFlag = 'yes' | 'no' | 'unknown'

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
  skipReason: '' | 'short' | 'duplicate' | 'library'
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
}

/** One yt-dlp flat-playlist line: id, title, duration, channel, channel id, captions. */
export function parseFlatPlaylistLine(line: string): ListedEntry | null {
  const parts = line.split('\t')
  const id = (parts[0] || '').trim()
  if (!/^[A-Za-z0-9_-]{6,}$/.test(id)) return null
  const duration = Number(parts[2])
  const flag = (parts[5] || '').trim().toLowerCase()
  const captions: ListedEntry['captions'] = flag === 'yes' || flag === 'no' ? flag : flag === 'unknown' ? 'unknown' : ''
  return {
    id,
    title: (parts[1] || '').trim() || `Film ${id}`,
    durationRaw: Number.isFinite(duration) && duration > 0 ? duration : null,
    channel: (parts[3] || '').trim(),
    channelId: (parts[4] || '').trim(),
    captions,
  }
}

export function clockFromListed(durationRaw: number | null) {
  return publishedClockSeconds(durationRaw)
}

/** "No captions" waits for the helper, which can run speech-to-text. The desk still says there are no captions. */
export function decideBringInWrite(result: YoutubeIngest, wantTranscript: boolean, lang: string) {
  const code = captionLang(lang)
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
      note: bringInNote('processed', 'Film saved. The transcript box was clear, so captions were not fetched.', code),
      source: 'none' as const,
      bucket: 'saved' as const,
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
  return ''
}
