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
  /** Seconds printed by the provider, when it could read a length without a caption file. Not yet the published clock. */
  lastDuration?: number | null
  /** captions, none (yt-dlp said so), blocked, failed, or missing. */
  lastOutcome?: CaptionOutcome | null
}

export type YoutubeIngest =
  | { ok: true; meta: YoutubeMeta | null; id: string; transcript: string; provider: string; tried: string[]; durationSeconds: number | null; captionOutcome: 'captions' }
  | { ok: false; meta: YoutubeMeta | null; id: string | null; error: string; needsTranscript: boolean; tried: string[]; durationSeconds: number | null; captionOutcome: CaptionOutcome | 'bad-link' }

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

export type BringInLine = { link: string; speaker: string }

/**
 * One film per line, up to twelve. A line may be `link | speaker`.
 * Commas still split a line that has no speaker, so several links can share a line.
 * Repeats are dropped.
 */
export function splitBringInLines(raw: string): BringInLine[] {
  const seen = new Set<string>()
  const lines: BringInLine[] = []
  for (const chunk of raw.split(/\n+/)) {
    const pieces = chunk.includes('|') ? [chunk] : chunk.split(',')
    for (const piece of pieces) {
      let link = piece.trim()
      let speaker = ''
      const bar = link.indexOf('|')
      if (bar >= 0) {
        speaker = link.slice(bar + 1).trim()
        link = link.slice(0, bar).trim()
      }
      if (!link || seen.has(link)) continue
      seen.add(link)
      lines.push({ link, speaker })
      if (lines.length >= 12) return lines
    }
  }
  return lines
}

/** One link per line. Repeats are dropped. Twelve is enough for one sitting. */
export function splitBringInLinks(raw: string) {
  return splitBringInLines(raw).map((line) => line.link)
}

/** The speaker on the line, else the course, else the lesson. Never the YouTube channel. */
export function speakerForLine(lineSpeaker: string | null | undefined, courseSpeaker?: string | null, lessonSpeaker?: string | null) {
  const line = String(lineSpeaker || '').trim()
  if (line) return line
  return chosenSpeaker(courseSpeaker, lessonSpeaker)
}

export type BringInState = 'processing' | 'processed' | 'failed' | 'waiting'

export function bringInNote(status: BringInState, detail: string, lang = 'en') {
  const head = `Bring-in: ${status}`
  return `${head}. [lang:${captionLang(lang)}] ${detail}`.replace(/\s+/g, ' ').trim().slice(0, 500)
}

export function bringInStatus(note: string | null | undefined): BringInState | '' {
  const text = String(note || '')
  if (text.startsWith('Bring-in: processed')) return 'processed'
  if (text.startsWith('Bring-in: failed')) return 'failed'
  if (text.startsWith('Bring-in: waiting')) return 'waiting'
  if (text.startsWith('Bring-in: processing')) return 'processing'
  return ''
}

/** The language stored on the bring-in note, so Try again asks for the same captions. */
export function bringInLang(note: string | null | undefined) {
  const match = String(note || '').match(/\[lang:([a-z]{2})\]/)
  return captionLang(match?.[1])
}

/** Failed, waiting and still-processing rows stay on the desk. Learners do not see an empty part. */
export function hiddenFromLearners(note: string | null | undefined) {
  const status = bringInStatus(note)
  return status === 'failed' || status === 'waiting' || status === 'processing'
}

/**
 * A transcript on a failed or dead-link film stays hidden. Learners see a part only when the film plays.
 * A film that was waiting (the video exists, the captions did not) becomes visible once a transcript is attached.
 */
export function noteAfterTranscriptUpload(existingNote: string | null | undefined, fileName: string) {
  const name = String(fileName || 'the file').slice(0, 80)
  if (bringInStatus(existingNote) === 'failed') {
    return {
      hidden: true,
      transcriptNote: bringInNote('failed', `A transcript from ${name} was saved. The film does not play, so learners do not see this part.`, bringInLang(existingNote)),
      notice: 'The transcript is saved. This film does not play, so learners still do not see it.',
    }
  }
  return { hidden: false, transcriptNote: `Uploaded from ${name}.`, notice: 'Transcript uploaded.' }
}

/** Try again keeps a speaker already named on the film when the line does not name a new one. */
export function speakerForBringIn(input: { lineSpeaker?: string | null; courseSpeaker?: string | null; lessonSpeaker?: string | null; retry?: boolean }) {
  const line = String(input.lineSpeaker || '').trim()
  if (input.retry && !line) return String(input.lessonSpeaker || '').trim()
  return speakerForLine(line, input.courseSpeaker, input.lessonSpeaker)
}

/** The flash after a bring-in. Clips are mentioned only when some were actually set aside. */
export function bringInFlash(input: { saved: number; waiting: number; failed: number; skipped: number; clipsSetAside: number }) {
  const bits = [`Brought in ${input.saved} film${input.saved === 1 ? '' : 's'}.`]
  if (input.waiting) bits.push(`${input.waiting} waiting for a transcript.`)
  if (input.failed) bits.push(`${input.failed} failed and can be tried again.`)
  if (input.skipped) bits.push(`${input.skipped} already in the library, so not added again.`)
  if (input.clipsSetAside > 0) bits.push('The previous film’s clips were set aside.')
  return bits.join(' ')
}

export function isAwaitingTranscript(note: string | null | undefined) {
  return bringInStatus(note) === 'waiting'
}

export function ytDlpArgs(id: string, dir: string, lang = 'en') {
  const code = captionLang(lang)
  return [
    '--skip-download',
    '--ignore-no-formats-error',
    '--no-simulate',
    '--write-subs',
    '--write-auto-subs',
    '--sub-langs', `${code}-orig,${code}.*,${code}`,
    '--sub-format', 'vtt',
    '--print', '%(duration)s',
    '-o', path.join(dir, '%(id)s.%(ext)s'),
    `https://www.youtube.com/watch?v=${id}`,
  ]
}

/** First positive number yt-dlp printed for %(duration)s. `NA` is not a length. The value is not yet the clock. */
export function parseDurationPrint(stdout: string): number | null {
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.toUpperCase() === 'NA') continue
    if (!/^\d+(\.\d+)?$/.test(trimmed)) continue
    const seconds = Number(trimmed)
    return seconds > 0 ? seconds : null
  }
  return null
}

/**
 * YouTube's lengthSeconds and an integer `%(duration)s` drop the last partial second.
 * The clock on the watch page is one second longer (7:08 is 428, not 427).
 * A fractional print is the real length, so it is rounded up and not increased again.
 */
export function publishedClockSeconds(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null
  if (Number.isInteger(raw)) return raw + 1
  return Math.ceil(raw)
}

/** The speaker chosen in the CMS. The YouTube channel name is never written over it. */
export function chosenSpeaker(courseSpeaker?: string | null, lessonSpeaker?: string | null) {
  const course = String(courseSpeaker || '').trim()
  if (course) return course
  return String(lessonSpeaker || '').trim()
}

export type CaptionOutcome = 'captions' | 'none' | 'blocked' | 'failed' | 'missing'

const BOT_WALL = /not a bot|sign in to confirm|429|too many requests|blocked|forbidden|403/i
const NO_SUBS = /no subtitles|there are no subtitles|no captions/i

/** A plain-English reason from yt-dlp's error output. */
export function ytDlpProblem(stderr: string, missing = false, lang = 'en') {
  if (missing) return 'yt-dlp is not installed. Run npm run setup (it puts a pinned copy in bin/) or set YT_DLP_PATH.'
  if (BOT_WALL.test(stderr)) {
    return 'YouTube blocked yt-dlp from this network. Run the bring-in from a home connection, or set TRANSCRIPT_SERVICE_URL to a caption service that YouTube does not block.'
  }
  if (NO_SUBS.test(stderr)) return noCaptionMessage(lang)
  const line = stderr.split('\n').map((row) => row.trim()).filter((row) => /^ERROR/.test(row))[0]
  return line ? `yt-dlp could not fetch the captions: ${line.replace(/^ERROR:\s*/, '').slice(0, 200)}` : 'yt-dlp could not fetch the captions.'
}

/**
 * What a finished yt-dlp run means.
 * "No captions" is said only when yt-dlp itself says there are no subtitles.
 * Exit 0 with no file (what `--print` does unless `--no-simulate` is set) is a failed fetch, not an empty film.
 */
export function interpretYtDlpOutput(input: {
  stdout: string
  stderr: string
  code?: string | number | null
  files: { name: string; text?: string | null }[]
  lang?: string
}): { text: string | null; duration: number | null; outcome: CaptionOutcome; message: string } {
  const lang = captionLang(input.lang)
  const duration = parseDurationPrint(input.stdout)
  const stderr = input.stderr || ''
  const code = input.code
  const vtt = pickCaptionFile(input.files.map((file) => file.name), lang)
  const vttText = vtt ? input.files.find((file) => file.name === vtt)?.text : null
  if (vttText && isCaptionText(vttText)) {
    return { text: vttText, duration, outcome: 'captions', message: 'Captions fetched by yt-dlp.' }
  }
  const json3 = input.files.find((file) => file.name.endsWith('.json3') && file.text)
  if (json3?.text) {
    const converted = json3ToVtt(json3.text)
    if (converted && isCaptionText(converted)) {
      return { text: converted, duration, outcome: 'captions', message: 'Captions fetched by yt-dlp.' }
    }
  }
  if (code === 'ENOENT') return { text: null, duration, outcome: 'missing', message: ytDlpProblem('', true, lang) }
  if (BOT_WALL.test(stderr)) return { text: null, duration, outcome: 'blocked', message: ytDlpProblem(stderr, false, lang) }
  // yt-dlp 2026.08.19 prints this with to_screen, which goes to stdout unless --quiet is set.
  const told = `${input.stdout || ''}\n${stderr}`
  if (NO_SUBS.test(told)) return { text: null, duration, outcome: 'none', message: noCaptionMessage(lang) }
  return {
    text: null,
    duration,
    outcome: 'failed',
    message: code
      ? ytDlpProblem(stderr, false, lang)
      : 'The caption fetch finished without a subtitle file. That is not the same as the film having no captions.',
  }
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
  lastOutcome: null,
  async fetch(id, options) {
    ytDlpProvider.lastProblem = null
    ytDlpProvider.lastDuration = null
    ytDlpProvider.lastOutcome = null
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
      const names = await readdir(dir).catch(() => [] as string[])
      const files = await Promise.all(names.map(async (name) => ({ name, text: await readFile(path.join(dir, name), 'utf8').catch(() => null) })))
      const interpreted = interpretYtDlpOutput({ stdout, stderr, code, files, lang })
      ytDlpProvider.lastDuration = interpreted.duration
      ytDlpProvider.lastOutcome = interpreted.outcome
      ytDlpProvider.lastProblem = interpreted.text ? null : interpreted.message
      return interpreted.text
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

const OUTCOME_RANK: Record<CaptionOutcome, number> = { blocked: 5, missing: 4, failed: 3, none: 2, captions: 1 }

export async function transcriptFor(id: string, providers: TranscriptProvider[] = defaultProviders, options: CaptionFetchOptions = {}) {
  const tried: string[] = []
  const problems: string[] = []
  let duration: number | null = null
  let outcome: CaptionOutcome | null = null
  for (const provider of providers) {
    tried.push(provider.name)
    const text = await provider.fetch(id, options)
    if (!duration && provider.lastDuration && provider.lastDuration > 0) duration = provider.lastDuration
    if (provider.lastOutcome && (outcome === null || OUTCOME_RANK[provider.lastOutcome] > OUTCOME_RANK[outcome])) outcome = provider.lastOutcome
    if (text && text.trim()) return { transcript: text, provider: provider.name, tried, problems, duration, outcome: 'captions' as const }
    if (provider.lastProblem) problems.push(provider.lastProblem)
  }
  return { transcript: null, provider: null, tried, problems, duration, outcome: outcome ?? 'failed' }
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
      captionOutcome: 'bad-link',
    }
  }
  const meta = await (options.meta || fetchYoutubeMeta)(id)
  if (meta === null) {
    return { ok: false, meta: null, id, error: 'YouTube says that film does not exist or is private. Check the link and try again.', needsTranscript: false, tried: [], durationSeconds: null, captionOutcome: 'bad-link' }
  }
  const found = await transcriptFor(id, options.providers, { lang: options.lang })
  let printed = found.duration
  if (!printed && options.duration !== null) {
    const lookup = options.duration || fetchInnertubeDuration
    printed = await lookup(id)
  }
  let durationSeconds = publishedClockSeconds(printed)
  if (!durationSeconds && found.transcript) durationSeconds = durationFromTranscript(found.transcript)
  if (!found.transcript) {
    const outcome = found.outcome
    const lead = outcome === 'none'
      ? noCaptionMessage(options.lang || 'en')
      : outcome === 'blocked'
        ? 'YouTube asked this server to sign in, so the captions are waiting for a transcript.'
        : 'The captions could not be fetched from this server.'
    return {
      ok: false,
      meta: meta || null,
      id,
      error: `${lead}${found.problems.length ? ` ${found.problems.join(' ')}` : ''} (tried ${found.tried.join(', ') || 'none'}). Upload a .vtt, .srt or .txt transcript below and the extractor will use that instead.`,
      needsTranscript: true,
      tried: found.tried,
      durationSeconds,
      captionOutcome: outcome,
    }
  }
  return { ok: true, meta: meta || null, id, transcript: found.transcript, provider: found.provider!, tried: found.tried, durationSeconds, captionOutcome: 'captions' }
}

/** The timed transcript saved on the lesson: rolling captions closed and deduped. The raw text is kept beside it when it differs. */
export function cleanedTimedTranscript(raw: string) {
  const parsed = parseTranscript(raw)
  if (!parsed.cues.length) return { cleaned: raw, raw }
  const cleaned = segmentsToVtt(parsed.cues.map((cue) => ({ start: cue.start, end: cue.end, text: cue.text })))
  return { cleaned, raw }
}
