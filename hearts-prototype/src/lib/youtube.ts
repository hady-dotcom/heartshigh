import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { youtubeIdFromUrl } from './extractor'
import { parseTranscript } from './transcript'

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
  fetch(id: string, options?: CaptionFetchOptions): Promise<string | null>
  /** Why the last fetch came back empty, in plain English, when the provider can tell. */
  lastProblem?: string | null
  /** Seconds printed by the provider, when it could read a length without a caption file. */
  lastDuration?: number | null
}

export type YoutubeIngest =
  | { ok: true; meta: YoutubeMeta | null; id: string; transcript: string; provider: string; tried: string[]; durationSeconds: number | null }
  | { ok: false; meta: YoutubeMeta | null; id: string | null; error: string; needsTranscript: boolean; tried: string[]; durationSeconds: number | null }

export function looksLikeYoutube(input: string) {
  try {
    const host = new URL(input.trim()).hostname.replace(/^www\./, '')
    return host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')
  } catch {
    return false
  }
}

/** A Short is a different film from the landscape watch page, so oEmbed has to ask for `/shorts/<id>`. */
export function youtubeOembedUrl(id: string, shape: 'watch' | 'short' = 'watch') {
  const page = shape === 'short' ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`
  return `https://www.youtube.com/oembed?url=${encodeURIComponent(page)}&format=json`
}

/** null means YouTube said the film does not exist. undefined means we could not ask. */
export async function fetchYoutubeMeta(id: string, shape: 'watch' | 'short' = 'watch'): Promise<YoutubeMeta | null | undefined> {
  const endpoint = youtubeOembedUrl(id, shape)
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

/**
 * Arguments for one caption fetch.
 * `--ignore-no-formats-error` lets captions through when YouTube refuses a video format.
 * No player client is forced: a pinned client was what made every link say the format was unavailable.
 */
export type CaptionFetchOptions = { lang?: string }

/** English, plus the languages an admin is likely to ask YouTube for. */
export const CAPTION_LANGUAGES = [
  ['en', 'English'],
  ['ar', 'Arabic'],
  ['ur', 'Urdu'],
  ['fr', 'French'],
  ['tr', 'Turkish'],
  ['id', 'Indonesian'],
] as const

export function captionLang(raw: string | null | undefined) {
  const code = String(raw || '').trim().toLowerCase()
  return CAPTION_LANGUAGES.some((row) => row[0] === code) ? code : 'en'
}

/** One link per line. Repeats are dropped. Twelve is enough for one sitting. */
export function splitBringInLinks(raw: string) {
  const seen = new Set<string>()
  const links: string[] = []
  for (const part of raw.split(/[\n,]+/)) {
    const link = part.trim()
    if (!link || seen.has(link)) continue
    seen.add(link)
    links.push(link)
    if (links.length >= 12) break
  }
  return links
}

export function bringInNote(status: 'processing' | 'processed' | 'failed', detail: string) {
  const head = status === 'processing' ? 'Bring-in: processing' : status === 'processed' ? 'Bring-in: processed' : 'Bring-in: failed'
  return `${head}. ${detail}`.replace(/\s+/g, ' ').trim().slice(0, 500)
}

export function bringInStatus(note: string | null | undefined): 'processing' | 'processed' | 'failed' | '' {
  const text = String(note || '')
  if (text.startsWith('Bring-in: processed')) return 'processed'
  if (text.startsWith('Bring-in: failed')) return 'failed'
  if (text.startsWith('Bring-in: processing')) return 'processing'
  return ''
}

export function ytDlpArgs(id: string, dir: string, lang = 'en') {
  const code = captionLang(lang)
  return [
    '--skip-download',
    '--ignore-no-formats-error',
    '--write-subs',
    '--write-auto-subs',
    '--sub-langs', `${code}-orig,${code}.*,${code}`,
    '--sub-format', 'vtt',
    '--print', '%(duration)s',
    '-o', path.join(dir, '%(id)s.%(ext)s'),
    `https://www.youtube.com/watch?v=${id}`,
  ]
}

/** First positive number yt-dlp printed for %(duration)s. `NA` is not a length. */
export function parseDurationPrint(stdout: string): number | null {
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.toUpperCase() === 'NA') continue
    if (!/^\d+(\.\d+)?$/.test(trimmed)) continue
    const seconds = Math.round(Number(trimmed))
    return seconds > 0 ? seconds : null
  }
  return null
}

/** The speaker chosen in the CMS. The YouTube channel name is never written over it. */
export function chosenSpeaker(courseSpeaker?: string | null, lessonSpeaker?: string | null) {
  const course = String(courseSpeaker || '').trim()
  if (course) return course
  return String(lessonSpeaker || '').trim()
}

/** A plain-English reason from yt-dlp's error output. */
export function ytDlpProblem(stderr: string, missing = false) {
  if (missing) return 'yt-dlp is not installed. Run npm run setup (it puts a pinned copy in bin/) or set YT_DLP_PATH.'
  if (/not a bot|sign in to confirm|429|too many requests|blocked|forbidden|403/i.test(stderr)) {
    return 'YouTube blocked yt-dlp from this network. Run the bring-in from a home connection, or set TRANSCRIPT_SERVICE_URL to a caption service that YouTube does not block.'
  }
  if (/no subtitles|there are no subtitles|no captions/i.test(stderr)) return 'This film has no English captions on YouTube.'
  const line = stderr.split('\n').map((row) => row.trim()).filter((row) => /^ERROR/.test(row))[0]
  return line ? `yt-dlp could not fetch the captions: ${line.replace(/^ERROR:\s*/, '').slice(0, 200)}` : 'yt-dlp could not fetch the captions.'
}

function pickCaptionFile(files: string[], lang = 'en') {
  const code = captionLang(lang)
  return (
    files.find((file) => new RegExp(`\\.${code}-orig\\.vtt$`, 'i').test(file)) ||
    files.find((file) => new RegExp(`\\.${code}\\.vtt$`, 'i').test(file)) ||
    files.find((file) => file.endsWith('.vtt')) ||
    null
  )
}

function noCaptionMessage(lang: string) {
  return captionLang(lang) === 'en' ? 'This film has no English captions on YouTube.' : `This film has no ${captionLang(lang)} captions on YouTube.`
}

/** json3 events become WebVTT cues. Word offsets stay as `<c>` tags so the timing is not flattened. */
export function json3ToVtt(raw: string): string | null {
  let body: { events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string; tOffsetMs?: number }[] }[] }
  try {
    body = JSON.parse(raw) as typeof body
  } catch {
    return null
  }
  const segments: { start: number; end: number; text: string }[] = []
  for (const event of body.events || []) {
    const segs = event.segs || []
    const plain = segs.map((seg) => seg.utf8 || '').join('').replace(/\n/g, ' ').trim()
    if (!plain) continue
    const start = (event.tStartMs || 0) / 1000
    const end = start + Math.max(0.2, (event.dDurationMs || 2000) / 1000)
    const timed = segs.some((seg) => typeof seg.tOffsetMs === 'number')
    const text = timed
      ? segs
          .map((seg) => {
            const word = (seg.utf8 || '').replace(/\n/g, ' ')
            if (!word.trim()) return ''
            const at = start + (seg.tOffsetMs || 0) / 1000
            return `<c t="${at.toFixed(3)}">${word}</c>`
          })
          .join('')
      : plain
    segments.push({ start, end, text })
  }
  return segments.length ? segmentsToVtt(segments) : null
}

export function durationFromTranscript(text: string): number | null {
  const cues = parseTranscript(text).cues
  if (!cues.length) return null
  const end = cues.reduce((max, cue) => Math.max(max, cue.end), 0)
  return end > 0 ? Math.round(end) : null
}

/** Length from the music player when yt-dlp prints NA. No captions come back from this call. */
export async function fetchInnertubeDuration(id: string): Promise<number | null> {
  try {
    const response = await fetch('https://music.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        videoId: id,
        context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20251001.01.00' } },
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { videoDetails?: { lengthSeconds?: string } }
    const seconds = Number(body.videoDetails?.lengthSeconds)
    return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null
  } catch {
    return null
  }
}

/** 1. yt-dlp, from bin/ (setup fetches a pinned copy) or the PATH. */
export const ytDlpProvider: TranscriptProvider = {
  name: 'yt-dlp',
  lastProblem: null,
  lastDuration: null,
  async fetch(id, options) {
    ytDlpProvider.lastProblem = null
    ytDlpProvider.lastDuration = null
    if (process.env.HEARTS_DISABLE_YTDLP === '1') return null
    const lang = captionLang(options?.lang)
    const dir = await mkdtemp(path.join(tmpdir(), 'hearts-ytdlp-'))
    let stdout = ''
    let stderr = ''
    let code: string | number | undefined
    try {
      try {
        const result = await execFileAsync(ytDlpBinary(), ytDlpArgs(id, dir, lang), { timeout: 90_000, maxBuffer: 8 * 1024 * 1024 })
        stdout = String(result.stdout || '')
        stderr = String(result.stderr || '')
      } catch (error) {
        const failure = error as { code?: string | number; stderr?: string | Buffer; stdout?: string | Buffer }
        stdout = String(failure.stdout || '')
        stderr = String(failure.stderr || '')
        code = failure.code
      }
      ytDlpProvider.lastDuration = parseDurationPrint(stdout)
      const files = await readdir(dir).catch(() => [] as string[])
      const vttName = pickCaptionFile(files, lang)
      let text: string | null = null
      if (vttName) {
        const raw = await readFile(path.join(dir, vttName), 'utf8')
        text = isCaptionText(raw) ? raw : null
      } else {
        const json3 = files.find((file) => file.endsWith('.json3'))
        if (json3) {
          const converted = json3ToVtt(await readFile(path.join(dir, json3), 'utf8'))
          text = converted && isCaptionText(converted) ? converted : null
        }
      }
      if (text) return text
      if (code === 'ENOENT') {
        ytDlpProvider.lastProblem = ytDlpProblem('', true)
        return null
      }
      const blocked = /not a bot|sign in to confirm|429|too many requests|blocked|forbidden|403/i.test(stderr)
      if (blocked) {
        ytDlpProvider.lastProblem = ytDlpProblem(stderr)
        return null
      }
      if (!code) {
        ytDlpProvider.lastProblem = noCaptionMessage(lang)
        return null
      }
      ytDlpProvider.lastProblem = ytDlpProblem(stderr)
      return null
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  },
}

/** 2. The caption track listed on the watch page, the same route the youtube-transcript package takes. */
export const watchPageProvider: TranscriptProvider = {
  name: 'youtube-transcript',
  async fetch(id, options) {
    const lang = captionLang(options?.lang)
    try {
      const page = await fetch(`https://www.youtube.com/watch?v=${id}&hl=${lang}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': `${lang},en;q=0.8` },
        signal: AbortSignal.timeout(12_000),
      })
      const html = await page.text()
      const tracks = html.match(/"captionTracks":(\[.*?\])/)
      if (!tracks) return null
      const list = JSON.parse(tracks[1]) as { baseUrl: string; languageCode?: string }[]
      const track = list.find((row) => row.languageCode?.toLowerCase().startsWith(lang)) || list[0]
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

export async function transcriptFor(id: string, providers: TranscriptProvider[] = defaultProviders, options: CaptionFetchOptions = {}) {
  const tried: string[] = []
  const problems: string[] = []
  let duration: number | null = null
  for (const provider of providers) {
    tried.push(provider.name)
    const text = await provider.fetch(id, options)
    if (!duration && provider.lastDuration && provider.lastDuration > 0) duration = provider.lastDuration
    if (text && text.trim()) return { transcript: text, provider: provider.name, tried, problems, duration }
    if (provider.lastProblem) problems.push(provider.lastProblem)
  }
  return { transcript: null, provider: null, tried, problems, duration }
}

export async function ingestYoutubeUrl(
  input: string,
  options: {
    providers?: TranscriptProvider[]
    meta?: (id: string) => Promise<YoutubeMeta | null | undefined>
    /** Pass null to skip the music-player length lookup. Omit it and the live lookup runs. */
    duration?: ((id: string) => Promise<number | null>) | null
    lang?: string
  } = {},
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
      durationSeconds: null,
    }
  }
  const meta = await (options.meta || fetchYoutubeMeta)(id)
  if (meta === null) {
    return { ok: false, meta: null, id, error: 'YouTube says that film does not exist or is private. Check the link and try again.', needsTranscript: false, tried: [], durationSeconds: null }
  }
  const found = await transcriptFor(id, options.providers, { lang: options.lang })
  let durationSeconds = found.duration
  if (!durationSeconds && options.duration !== null) {
    const lookup = options.duration || fetchInnertubeDuration
    durationSeconds = await lookup(id)
  }
  if (!durationSeconds && found.transcript) durationSeconds = durationFromTranscript(found.transcript)
  if (!found.transcript) {
    return {
      ok: false,
      meta: meta || null,
      id,
      error: `The film is saved, but its captions could not be fetched from this server (tried ${found.tried.join(', ')}).${found.problems.length ? ` ${found.problems.join(' ')}` : ''} Upload a .vtt, .srt or .txt transcript below and the extractor will use that instead.`,
      needsTranscript: true,
      tried: found.tried,
      durationSeconds,
    }
  }
  return { ok: true, meta: meta || null, id, transcript: found.transcript, provider: found.provider!, tried: found.tried, durationSeconds }
}
