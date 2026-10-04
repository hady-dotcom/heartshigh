// Live sessions: a teacher in a portal goes live, and that portal’s learners can watch.
// Pure rules. No database. YouTube and Vimeo are the primary path; Mux is a stub adapter.

import { isProduction, isRemoteDatabase, type Env } from './env'
import { youtubeIdFromUrl } from './extractor'

export const DEMO_PORTAL_SLUG = 'hearts-demo'
export const LIVE_POLL_MS = 12_000
export const PRESENCE_WINDOW_MS = 45_000
export const QUESTION_MAX = 240
export const QUESTION_MIN = 3
export const QUESTION_GAP_MS = 15_000
export const QUESTION_PER_HOUR = 40

export type LiveSource = 'youtube' | 'vimeo' | 'mux'
export type LiveStatus = 'scheduled' | 'live' | 'ended'

export const LIVE_SOURCES: LiveSource[] = ['youtube', 'vimeo', 'mux']
export const LIVE_STATUSES: LiveStatus[] = ['scheduled', 'live', 'ended']

export const SOURCE_LABEL: Record<LiveSource, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  mux: 'Mux (OBS or a phone app)',
}

export type ParsedLiveSource =
  | { ok: true; source: 'youtube'; id: string; sourceUrl: string; embedUrl: string; vodUrl: string }
  | { ok: true; source: 'vimeo'; id: string; sourceUrl: string; embedUrl: string; vodUrl: string }
  | { ok: false; error: string }

export type MuxStream = {
  streamId: string
  streamKey: string
  rtmpUrl: string
  playbackId: string
}

export type MuxResult =
  | { ok: true; configured: true; stream: MuxStream }
  | { ok: false; configured: false; error: string }
  | { ok: false; configured: true; error: string }

export type LiveProvider = {
  kind: LiveSource
  label: string
  parse?(url: string): ParsedLiveSource
  muxConfigured(env?: Env): boolean
  createMuxStream?(env?: Env): Promise<MuxResult>
}

export function isLiveSource(value: unknown): value is LiveSource {
  return value === 'youtube' || value === 'vimeo' || value === 'mux'
}

export function isLiveStatus(value: unknown): value is LiveStatus {
  return value === 'scheduled' || value === 'live' || value === 'ended'
}

/** Members of that portal, plus the master. Anyone else is out. */
export function canSeeLive(role: string | null | undefined, userPortalId: number | null | undefined, sessionPortalId: number) {
  if (role === 'master') return true
  return Boolean(userPortalId && userPortalId === sessionPortalId)
}

/** Teachers, imams (the teacher role) and portal admins on this portal. The master may act on any portal. */
export function canGoLive(role: string | null | undefined, userPortalId: number | null | undefined, sessionPortalId: number) {
  if (role === 'master') return true
  if (role !== 'teacher' && role !== 'portal-admin') return false
  return Boolean(userPortalId && userPortalId === sessionPortalId)
}

export function muxConfigured(env: Env = process.env) {
  return Boolean(env.MUX_TOKEN_ID?.trim() && env.MUX_TOKEN_SECRET?.trim())
}

export const youtubeProvider: LiveProvider = {
  kind: 'youtube',
  label: SOURCE_LABEL.youtube,
  parse: (url) => parseYoutubeLive(url),
  muxConfigured,
}

export const vimeoProvider: LiveProvider = {
  kind: 'vimeo',
  label: SOURCE_LABEL.vimeo,
  parse: (url) => parseVimeoLive(url),
  muxConfigured,
}

export const muxProvider: LiveProvider = {
  kind: 'mux',
  label: SOURCE_LABEL.mux,
  muxConfigured,
  createMuxStream: (env) => createMuxLiveStream(env),
}

export const LIVE_PROVIDERS: Record<LiveSource, LiveProvider> = {
  youtube: youtubeProvider,
  vimeo: vimeoProvider,
  mux: muxProvider,
}

export function providerOf(kind: LiveSource): LiveProvider {
  return LIVE_PROVIDERS[kind]
}

function youtubeEmbed(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&controls=0&playsinline=1&rel=0&modestbranding=1`
}

function vimeoEmbed(id: string) {
  return `https://player.vimeo.com/video/${id}?autoplay=1&controls=0`
}

export function parseYoutubeLive(raw: string): ParsedLiveSource {
  const text = raw.trim()
  if (!text) return { ok: false, error: 'Paste a YouTube Live or unlisted stream link.' }
  const id = youtubeIdFromUrl(text)
  if (!id) return { ok: false, error: 'That does not look like a YouTube link. Use a youtube.com or youtu.be address, including /live/.' }
  const sourceUrl = /youtube\.com|youtu\.be/i.test(text) ? text : `https://www.youtube.com/watch?v=${id}`
  return { ok: true, source: 'youtube', id, sourceUrl, embedUrl: youtubeEmbed(id), vodUrl: sourceUrl }
}

function vimeoIdFrom(raw: string): string | null {
  const text = raw.trim()
  if (/^\d{6,12}$/.test(text)) return text
  try {
    const url = new URL(text)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      return url.pathname.split('/').filter(Boolean).reverse().find((part) => /^\d{6,12}$/.test(part)) || null
    }
  } catch {
    /* not a url */
  }
  return null
}

export function parseVimeoLive(raw: string): ParsedLiveSource {
  const text = raw.trim()
  if (!text) return { ok: false, error: 'Paste a Vimeo live link.' }
  const id = vimeoIdFrom(text)
  if (!id) return { ok: false, error: 'That does not look like a Vimeo link. Use a vimeo.com address.' }
  const sourceUrl = /vimeo\.com/i.test(text) ? text : `https://vimeo.com/${id}`
  return { ok: true, source: 'vimeo', id, sourceUrl, embedUrl: vimeoEmbed(id), vodUrl: sourceUrl }
}

/** The primary path: paste a YouTube Live / unlisted stream or a Vimeo live link. */
export function parseLiveSource(raw: string, prefer?: LiveSource): ParsedLiveSource {
  const text = raw.trim()
  if (!text) return { ok: false, error: 'Paste a YouTube Live or Vimeo live link, or choose Mux if it is configured.' }
  if (prefer === 'youtube') return parseYoutubeLive(text)
  if (prefer === 'vimeo') return parseVimeoLive(text)
  const youtube = parseYoutubeLive(text)
  if (youtube.ok) return youtube
  const vimeo = parseVimeoLive(text)
  if (vimeo.ok) return vimeo
  return { ok: false, error: 'Use a YouTube or Vimeo link. Mux needs its own keys, not a pasted address.' }
}

export function muxNotConfiguredMessage() {
  return 'Mux is not configured. Add MUX_TOKEN_ID and MUX_TOKEN_SECRET, or paste a YouTube or Vimeo link.'
}

/** Mux Live adapter stub. When the keys are present it asks Mux for a stream key and an RTMP URL. */
export async function createMuxLiveStream(env: Env = process.env): Promise<MuxResult> {
  const tokenId = env.MUX_TOKEN_ID?.trim() || ''
  const tokenSecret = env.MUX_TOKEN_SECRET?.trim() || ''
  if (!tokenId || !tokenSecret) return { ok: false, configured: false, error: muxNotConfiguredMessage() }
  const auth = Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64')
  try {
    const res = await fetch('https://api.mux.com/video/v1/live-streams', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ playback_policies: ['public'], new_asset_settings: { playback_policies: ['public'] } }),
    })
    const body = (await res.json().catch(() => null)) as {
      data?: { id?: string; stream_key?: string; playback_ids?: { id?: string }[]; rtmp?: { url?: string } }
      error?: { messages?: string[] }
    } | null
    if (!res.ok || !body?.data?.id || !body.data.stream_key) {
      const detail = body?.error?.messages?.filter(Boolean).join(' ') || `Mux replied ${res.status}.`
      return { ok: false, configured: true, error: `Mux could not open a live stream. ${detail}` }
    }
    const playbackId = body.data.playback_ids?.[0]?.id || ''
    return {
      ok: true,
      configured: true,
      stream: {
        streamId: body.data.id,
        streamKey: body.data.stream_key,
        rtmpUrl: body.data.rtmp?.url || 'rtmps://global-live.mux.com:443/app',
        playbackId,
      },
    }
  } catch {
    return { ok: false, configured: true, error: 'Mux could not be reached. Try a YouTube or Vimeo link, or try again in a moment.' }
  }
}

export function muxPlaybackUrl(playbackId: string) {
  return playbackId ? `https://player.mux.com/${playbackId}` : ''
}

export function muxVodUrl(playbackId: string) {
  return playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : ''
}

export function cleanQuestion(raw: string) {
  return raw.replace(/\s+/g, ' ').trim()
}

export function questionProblem(raw: string): string | null {
  const body = cleanQuestion(raw)
  if (body.length < QUESTION_MIN) return 'Write a short question, at least a few words.'
  if (body.length > QUESTION_MAX) return `Keep it to ${QUESTION_MAX} characters.`
  return null
}

export function questionRateProblem(lastAtMs: number | null, nowMs: number, hourCount = 0) {
  if (lastAtMs != null && nowMs - lastAtMs < QUESTION_GAP_MS) {
    const wait = Math.ceil((QUESTION_GAP_MS - (nowMs - lastAtMs)) / 1000)
    return `Wait ${wait} second${wait === 1 ? '' : 's'} before sending another question.`
  }
  if (hourCount >= QUESTION_PER_HOUR) return 'You have sent enough questions for now. Come back in a little while.'
  return null
}

export function viewerCount(lastSeenAt: Array<string | number | Date>, nowMs: number, windowMs = PRESENCE_WINDOW_MS) {
  return lastSeenAt.filter((at) => {
    const ms = typeof at === 'number' ? at : new Date(at).getTime()
    return Number.isFinite(ms) && nowMs - ms <= windowMs
  }).length
}

export function replayTitle(at: Date) {
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }).format(at)
  return `From the live session on ${date}`
}

export function replayCourseTitle() {
  return 'Live replays'
}

/** Watching live or the replay never finishes a course unless the admin later attaches the talk to a course. */
export function liveCountsTowardProgress(attachedToPublishedCourse: boolean) {
  return attachedToPublishedCourse
}

export function liveDemoGuard(slug: string | null | undefined, env: Env = process.env) {
  if (isProduction(env) || isRemoteDatabase(env)) return 'Refusing to seed live sessions. This script never runs against production.'
  if (slug !== DEMO_PORTAL_SLUG) return `Refusing to seed live sessions. This script only touches ${DEMO_PORTAL_SLUG}.`
  return null
}

/** When a session is due, or “now”, in the portal’s zone. Accepts ISO, datetime-local, or DD/MM/YYYY HH:mm. */
export function parseLiveWhen(raw: string, now = new Date()): Date | null {
  const trimmed = raw.trim()
  if (!trimmed || /^now$/i.test(trimmed)) return now
  const uk = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[,\s]+(\d{1,2})[:.](\d{2}))?$/)
  if (uk) {
    const iso = `${uk[3]}-${uk[2].padStart(2, '0')}-${uk[1].padStart(2, '0')}T${(uk[4] || '00').padStart(2, '0')}:${uk[5] || '00'}:00`
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

export function liveWhenLabel(iso: string | Date | null | undefined, timeZone = 'Europe/London') {
  const date = iso instanceof Date ? iso : new Date(String(iso || ''))
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function hostFirstName(full: string) {
  return full.trim().split(/\s+/).filter(Boolean)[0] || 'Teacher'
}
