// YouTube search for the master-sheet creator. The Data API is used when a key is set; otherwise yt-dlp's
// ytsearch. Tests pass a fixture or a fetch stand-in, so nothing here has to reach the network.
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { promisify } from 'node:util'
import { parseVimeoId, parseYoutubeId } from './master-sheet'
import { ytDlpBinary } from './youtube'

const execFileAsync = promisify(execFile)

export type TalkCandidate = {
  provider: 'youtube'
  id: string
  title: string
  channel: string
  durationSeconds: number | null
  thumbnail: string | null
  captions: 'yes' | 'no' | 'unknown'
  url: string
}

export type SearchQuery = { topic: string; speaker?: string; limit?: number; minSeconds?: number | null; maxSeconds?: number | null }

type SearchDeps = {
  fetch?: typeof fetch
  apiKey?: string | null
  fixture?: TalkCandidate[] | null
  ytdlp?: (query: string, limit: number) => Promise<TalkCandidate[]>
}

export function parseIsoDuration(value: string): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value.trim())
  if (!match || (!match[1] && !match[2] && !match[3])) return null
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)
}

export function searchFixture(): TalkCandidate[] | null {
  const raw = process.env.HEARTS_SEARCH_FIXTURE
  if (!raw) return null
  try {
    const text = raw.trim().startsWith('[') ? raw : readFileSync(raw, 'utf8')
    const parsed = JSON.parse(text) as TalkCandidate[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function within(item: TalkCandidate, query: SearchQuery) {
  const min = query.minSeconds ?? null
  const max = query.maxSeconds ?? null
  if (min == null && max == null) return true
  if (item.durationSeconds == null) return false
  if (min != null && item.durationSeconds < min) return false
  if (max != null && item.durationSeconds > max) return false
  return true
}

function queryText(query: SearchQuery) {
  return [query.topic, query.speaker].map((part) => (part || '').trim()).filter(Boolean).join(' ')
}

async function youtubeApiSearch(query: SearchQuery, deps: SearchDeps, key: string): Promise<TalkCandidate[]> {
  const fetchImpl = deps.fetch || fetch
  const limit = Math.min(25, Math.max(query.limit || 8, 5))
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.searchParams.set('part', 'snippet')
  searchUrl.searchParams.set('type', 'video')
  searchUrl.searchParams.set('maxResults', String(limit))
  searchUrl.searchParams.set('q', queryText(query))
  searchUrl.searchParams.set('key', key)
  const found = await fetchImpl(searchUrl, { signal: AbortSignal.timeout(12_000) })
  if (!found.ok) throw new Error(`YouTube search returned ${found.status}.`)
  const body = (await found.json()) as { items?: { id?: { videoId?: string } }[] }
  const ids = (body.items || []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id))
  if (!ids.length) return []
  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  videosUrl.searchParams.set('part', 'snippet,contentDetails')
  videosUrl.searchParams.set('id', ids.join(','))
  videosUrl.searchParams.set('key', key)
  const details = await fetchImpl(videosUrl, { signal: AbortSignal.timeout(12_000) })
  if (!details.ok) throw new Error(`YouTube video details returned ${details.status}.`)
  const listed = (await details.json()) as { items?: { id?: string; snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } }; contentDetails?: { duration?: string; caption?: string } }[] }
  return (listed.items || []).map((item) => ({
    provider: 'youtube' as const,
    id: String(item.id || ''),
    title: item.snippet?.title || 'Untitled film',
    channel: item.snippet?.channelTitle || '',
    durationSeconds: parseIsoDuration(item.contentDetails?.duration || ''),
    thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null,
    captions: item.contentDetails?.caption === 'true' ? 'yes' as const : item.contentDetails?.caption === 'false' ? 'no' as const : 'unknown' as const,
    url: `https://www.youtube.com/watch?v=${item.id}`,
  })).filter((item) => item.id)
}

async function ytdlpSearch(query: string, limit: number): Promise<TalkCandidate[]> {
  if (process.env.HEARTS_DISABLE_YTDLP === '1') return []
  try {
    const { stdout } = await execFileAsync(ytDlpBinary(), [`ytsearch${Math.min(25, Math.max(1, limit))}:${query}`, '--flat-playlist', '--dump-single-json', '--skip-download', '--no-warnings'], { timeout: 45_000, maxBuffer: 8_000_000 })
    const body = JSON.parse(stdout) as { entries?: { id?: string; title?: string; channel?: string; uploader?: string; duration?: number; thumbnails?: { url?: string }[] }[] }
    return (body.entries || []).map((entry) => ({
      provider: 'youtube' as const,
      id: String(entry.id || ''),
      title: entry.title || 'Untitled film',
      channel: entry.channel || entry.uploader || '',
      durationSeconds: typeof entry.duration === 'number' ? Math.round(entry.duration) : null,
      thumbnail: entry.thumbnails?.[0]?.url || null,
      captions: 'unknown' as const,
      url: `https://www.youtube.com/watch?v=${entry.id}`,
    })).filter((item) => /^[A-Za-z0-9_-]{11}$/.test(item.id))
  } catch {
    return []
  }
}

/** A pasted line: a YouTube link or id, or a Vimeo link or id. */
export function parsePastedSources(text: string): { ok: true; sources: { provider: 'youtube' | 'vimeo'; id: string; title: string }[] } | { ok: false; error: string } {
  const sources: { provider: 'youtube' | 'vimeo'; id: string; title: string }[] = []
  for (const line of text.split(/\n+/)) {
    const raw = line.trim()
    if (!raw) continue
    const vimeo = parseVimeoId(raw)
    const youtube = parseYoutubeId(raw)
    if (vimeo.ok && (/vimeo\.com/i.test(raw) || !youtube.ok)) sources.push({ provider: 'vimeo', id: vimeo.id, title: `Vimeo ${vimeo.id}` })
    else if (youtube.ok) sources.push({ provider: 'youtube', id: youtube.id, title: `YouTube ${youtube.id}` })
    else return { ok: false, error: vimeo.ok ? youtube.message : `${vimeo.message} ${youtube.message}` }
  }
  return { ok: true, sources }
}

/** Candidates for one topic. Length bounds drop films whose duration is known to fall outside them. */
export async function searchTalks(query: SearchQuery, deps: SearchDeps = {}): Promise<{ ok: true; candidates: TalkCandidate[]; via: string } | { ok: false; error: string }> {
  const topic = query.topic.trim()
  if (topic.length < 2) return { ok: false, error: 'Name the topic in at least two characters.' }
  const limit = Math.min(25, Math.max(1, query.limit || 8))
  const fixture = deps.fixture === undefined ? searchFixture() : deps.fixture
  let via = 'fixture'
  let rows: TalkCandidate[] = []
  if (fixture) rows = fixture
  else {
    const key = deps.apiKey === undefined ? process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_DATA_API_KEY || '' : deps.apiKey || ''
    if (key) {
      try {
        rows = await youtubeApiSearch(query, deps, key)
        via = 'youtube'
      } catch (error) {
        const fallback = await (deps.ytdlp || ytdlpSearch)(queryText(query), limit)
        if (!fallback.length) return { ok: false, error: error instanceof Error ? error.message : 'YouTube search failed.' }
        rows = fallback
        via = 'yt-dlp'
      }
    } else {
      rows = await (deps.ytdlp || ytdlpSearch)(queryText(query), limit)
      via = 'yt-dlp'
      if (!rows.length) return { ok: false, error: 'Search needs a YouTube Data API key (YOUTUBE_API_KEY), or yt-dlp on this machine.' }
    }
  }
  const candidates = rows.filter((item) => within(item, query)).slice(0, limit)
  return { ok: true, candidates, via }
}
