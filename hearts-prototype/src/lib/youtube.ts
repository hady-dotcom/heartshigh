import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { youtubeIdFromUrl } from './extractor'

const execFileAsync = promisify(execFile)

export type YoutubeMeta = {
  id: string
  title: string
  author: string
  thumbnail: string
  /** oEmbed's player size. A Short answers taller than wide. */
  width?: number
  height?: number
}

export type TranscriptProvider = {
  name: string
  fetch(id: string): Promise<string | null>
  /** Why the last fetch came back empty, in plain English, when the provider can tell. */
  lastProblem?: string | null
}

export type YoutubeIngest =
  | { ok: true; meta: YoutubeMeta | null; id: string; transcript: string; provider: string; tried: string[] }
  | { ok: false; meta: YoutubeMeta | null; id: string | null; error: string; needsTranscript: boolean; tried: string[] }

export function looksLikeYoutube(input: string) {
  try {
    const host = new URL(input.trim()).hostname.replace(/^www\./, '')
    return host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')
  } catch {
    return false
  }
}

/** null means YouTube said the film does not exist. undefined means we could not ask. */
export async function fetchYoutubeMeta(id: string): Promise<YoutubeMeta | null | undefined> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(12_000) })
    if (response.status === 404 || response.status === 400) return null
    if (!response.ok) return undefined
    const body = (await response.json()) as { title?: string; author_name?: string; thumbnail_url?: string; width?: number; height?: number }
    if (!body.title) return undefined
    return {
      id,
      title: body.title,
      author: body.author_name || 'YouTube',
      thumbnail: body.thumbnail_url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      ...(Number(body.width) > 0 && Number(body.height) > 0 ? { width: Number(body.width), height: Number(body.height) } : {}),
    }
  } catch {
    return undefined
  }
}

function isCaptionText(text: string | null | undefined): text is string {
  return Boolean(text && text.includes('-->') && !/<html/i.test(text))
}

/** Where yt-dlp is: YT_DLP_PATH, else the pinned copy setup puts in bin/, else whatever is on the PATH. */
export function ytDlpBinary() {
  if (process.env.YT_DLP_PATH) return process.env.YT_DLP_PATH
  const local = path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
  return existsSync(local) ? local : 'yt-dlp'
}

/** The arguments for one caption fetch. The web_embedded player client is the one YouTube blocks least from servers. */
export function ytDlpArgs(id: string, dir: string) {
  return [
    '--skip-download', '--write-subs', '--write-auto-subs', '--sub-langs', 'en.*,en', '--sub-format', 'vtt',
    '--extractor-args', 'youtube:player_client=web_embedded',
    '-o', path.join(dir, '%(id)s.%(ext)s'), `https://www.youtube.com/watch?v=${id}`,
  ]
}

/** A plain-English reason from yt-dlp's error output. */
export function ytDlpProblem(stderr: string, missing = false) {
  if (missing) return 'yt-dlp is not installed. Run npm run setup (it puts a pinned copy in bin/) or set YT_DLP_PATH.'
  if (/not a bot|sign in to confirm|429|too many requests|blocked|forbidden|403/i.test(stderr)) {
    return 'YouTube blocked yt-dlp from this network, even with the web_embedded player. Run the import from a home connection, or set TRANSCRIPT_SERVICE_URL to a caption service that YouTube does not block.'
  }
  if (/no subtitles|there are no subtitles|no captions/i.test(stderr)) return 'This film has no English captions on YouTube.'
  const line = stderr.split('\n').map((row) => row.trim()).filter((row) => /^ERROR/.test(row))[0]
  return line ? `yt-dlp could not fetch the captions: ${line.replace(/^ERROR:\s*/, '').slice(0, 200)}` : 'yt-dlp could not fetch the captions.'
}

/** 1. yt-dlp, from bin/ (setup fetches a pinned copy) or the PATH. */
export const ytDlpProvider: TranscriptProvider = {
  name: 'yt-dlp',
  lastProblem: null,
  async fetch(id) {
    ytDlpProvider.lastProblem = null
    if (process.env.HEARTS_DISABLE_YTDLP === '1') return null
    const dir = await mkdtemp(path.join(tmpdir(), 'hearts-ytdlp-'))
    try {
      await execFileAsync(ytDlpBinary(), ytDlpArgs(id, dir), { timeout: 60_000 })
      const files = (await readdir(dir)).filter((file) => file.endsWith('.vtt'))
      const preferred = files.find((file) => /\.en\.vtt$/.test(file)) || files[0]
      if (!preferred) {
        ytDlpProvider.lastProblem = 'This film has no English captions on YouTube.'
        return null
      }
      const text = await readFile(path.join(dir, preferred), 'utf8')
      return isCaptionText(text) ? text : null
    } catch (error) {
      const failure = error as { code?: string; stderr?: string }
      ytDlpProvider.lastProblem = ytDlpProblem(String(failure.stderr || ''), failure.code === 'ENOENT')
      return null
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  },
}

/** 2. The caption track listed on the watch page, the same route the youtube-transcript package takes. */
export const watchPageProvider: TranscriptProvider = {
  name: 'youtube-transcript',
  async fetch(id) {
    try {
      const page = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-GB,en;q=0.8' },
        signal: AbortSignal.timeout(12_000),
      })
      const html = await page.text()
      const tracks = html.match(/"captionTracks":(\[.*?\])/)
      if (!tracks) return null
      const list = JSON.parse(tracks[1]) as { baseUrl: string; languageCode?: string }[]
      const track = list.find((row) => row.languageCode?.startsWith('en')) || list[0]
      if (!track) return null
      const response = await fetch(`${track.baseUrl.replace(/\\u0026/g, '&')}&fmt=vtt`, { signal: AbortSignal.timeout(12_000) })
      const text = await response.text()
      return response.ok && isCaptionText(text) ? text : null
    } catch {
      return null
    }
  },
}

/**
 * 3. An external transcript service you run somewhere YouTube does not block, for example a small
 * yt-dlp box at home. Set TRANSCRIPT_SERVICE_URL. The service receives ?id=&url= and returns
 * WebVTT/SRT text, or JSON with a `vtt`, `transcript` or `segments: [{start, end, text}]` field.
 */
export const serviceProvider: TranscriptProvider = {
  name: 'transcript-service',
  async fetch(id) {
    const base = process.env.TRANSCRIPT_SERVICE_URL
    if (!base) return null
    try {
      const url = new URL(base)
      url.searchParams.set('id', id)
      url.searchParams.set('url', `https://www.youtube.com/watch?v=${id}`)
      const headers: Record<string, string> = {}
      if (process.env.TRANSCRIPT_SERVICE_TOKEN) headers.authorization = `Bearer ${process.env.TRANSCRIPT_SERVICE_TOKEN}`
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) })
      if (!response.ok) return null
      const text = await response.text()
      if (isCaptionText(text)) return text
      try {
        const body = JSON.parse(text) as { vtt?: string; transcript?: string; segments?: { start: number; end: number; text: string }[] }
        if (isCaptionText(body.vtt)) return body.vtt
        if (body.segments?.length) return segmentsToVtt(body.segments)
        if (body.transcript && body.transcript.trim()) return body.transcript
      } catch {
        return null
      }
      return null
    } catch {
      return null
    }
  },
}

export function segmentsToVtt(segments: { start: number; end: number; text: string }[]) {
  const stamp = (value: number) => {
    const total = Math.max(0, value)
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = (total % 60).toFixed(3).padStart(6, '0')
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${seconds}`
  }
  return ['WEBVTT', '', ...segments.map((row) => `${stamp(row.start)} --> ${stamp(row.end)}\n${row.text.trim()}\n`)].join('\n')
}

export const defaultProviders = [ytDlpProvider, watchPageProvider, serviceProvider]

export async function transcriptFor(id: string, providers: TranscriptProvider[] = defaultProviders) {
  const tried: string[] = []
  const problems: string[] = []
  for (const provider of providers) {
    tried.push(provider.name)
    const text = await provider.fetch(id)
    if (text && text.trim()) return { transcript: text, provider: provider.name, tried, problems }
    if (provider.lastProblem) problems.push(provider.lastProblem)
  }
  return { transcript: null, provider: null, tried, problems }
}

export async function ingestYoutubeUrl(
  input: string,
  options: { providers?: TranscriptProvider[]; meta?: (id: string) => Promise<YoutubeMeta | null | undefined> } = {},
): Promise<YoutubeIngest> {
  const id = youtubeIdFromUrl(input)
  if (!id) {
    return {
      ok: false,
      meta: null,
      id: null,
      error: looksLikeYoutube(input)
        ? 'That YouTube link is missing the film part. Copy the link from the Share button and try again.'
        : 'That does not look like a YouTube link. Paste a watch, share or youtu.be link.',
      needsTranscript: false,
      tried: [],
    }
  }
  const meta = await (options.meta || fetchYoutubeMeta)(id)
  if (meta === null) {
    return { ok: false, meta: null, id, error: 'YouTube says that film does not exist or is private. Check the link and try again.', needsTranscript: false, tried: [] }
  }
  const found = await transcriptFor(id, options.providers)
  if (!found.transcript) {
    return {
      ok: false,
      meta: meta || null,
      id,
      error: `The film is saved, but its captions could not be fetched from this server (tried ${found.tried.join(', ')}).${found.problems.length ? ` ${found.problems.join(' ')}` : ''} Upload a .vtt, .srt or .txt transcript below and the extractor will use that instead.`,
      needsTranscript: true,
      tried: found.tried,
    }
  }
  return { ok: true, meta: meta || null, id, transcript: found.transcript, provider: found.provider!, tried: found.tried }
}
