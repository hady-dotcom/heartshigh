// Turns a creator request into a draft master sheet. The workbook is the same one the importer already previews.
// Each talk is drafted on its own: a caption failure, a timeout, or a bad link is one line, and the rest still build.
import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import type { Payload } from 'payload'
import { buildWorkbook } from '@/lib/master-sheet'
import { parsePastedSources } from '@/lib/sheet-search'
import { draftTalk, transcriptFixture, type DraftSource } from '@/lib/sheet-draft'
import { interpretYtDlpOutput, ytDlpArgs, ytDlpBinary } from '@/lib/youtube'
import type { SheetScope } from './master-sheet'

const execFileAsync = promisify(execFile)

export const NO_CAPTIONS = "No captions on this talk. It'll be added without hors d'oeuvre cuts."
export const TOO_LONG = "This talk took too long to read. It'll be added without hors d'oeuvre cuts."
export const BLOCKED = "YouTube blocked the caption fetch for this talk. It'll be added without hors d'oeuvre cuts."

/** One film's caption read. Long enough for a real yt-dlp fetch, short enough to answer before the request is cut off. */
export const CAPTION_TIMEOUT_MS = 45_000

export type CreatorSource = {
  provider: 'youtube' | 'vimeo' | 'file'
  id?: string
  title?: string
  speaker?: string
  channel?: string
  durationSeconds?: number | null
  mediaId?: number | null
  transcript?: string | null
}

export type TalkDraftResult = {
  included: boolean
  warn: boolean
  detail: string
  title: string
  talk?: Record<string, string | number | null>
  questions?: Record<string, string | number | null>[]
  resources?: Record<string, string | number | null>[]
}

type CaptionRead = { transcript: string | null; detail: string; include: boolean; warn: boolean }

function cell(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

export function normaliseCreatorSource(value: unknown): CreatorSource | null {
  if (!value || typeof value !== 'object') return null
  const row = value as CreatorSource
  if (row.provider !== 'youtube' && row.provider !== 'vimeo' && row.provider !== 'file') return null
  const duration = typeof row.durationSeconds === 'number' && Number.isFinite(row.durationSeconds) ? row.durationSeconds : null
  const mediaId = Number(row.mediaId)
  return {
    provider: row.provider,
    id: row.id == null ? undefined : String(row.id).trim(),
    title: row.title == null ? undefined : String(row.title),
    speaker: row.speaker == null ? undefined : String(row.speaker),
    channel: row.channel == null ? undefined : String(row.channel),
    durationSeconds: duration,
    mediaId: Number.isFinite(mediaId) && mediaId > 0 ? mediaId : null,
    transcript: typeof row.transcript === 'string' ? row.transcript : null,
  }
}

/**
 * Ticked talks plus pasted links. `sources` may be the JSON array, or that array already parsed.
 * A shape the desk cannot read is said out loud; it is not dropped so that only the links box remains.
 */
export function collectCreatorSources(input: { sources?: unknown; pasted?: unknown }): { ok: true; sources: CreatorSource[] } | { ok: false; error: string } {
  let raw = input.sources
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) raw = []
    else {
      try {
        raw = JSON.parse(text) as unknown
      } catch {
        return { ok: false, error: 'The chosen talks were not sent in a shape the desk could read. Tick them again and build once more.' }
      }
    }
  }
  const chosen: CreatorSource[] = []
  if (raw == null) {
    // No ticked list. Pasted links can still build a sheet.
  } else if (!Array.isArray(raw)) {
    return { ok: false, error: 'The chosen talks were not sent in a shape the desk could read. Tick them again and build once more.' }
  } else {
    for (const item of raw) {
      const source = normaliseCreatorSource(item)
      if (!source) return { ok: false, error: 'A source is youtube, vimeo or an uploaded file.' }
      if (source.provider === 'file' && !source.mediaId) return { ok: false, error: 'An uploaded film is missing its media id. Upload it again.' }
      if (source.provider !== 'file' && !source.id) return { ok: false, error: 'A talk is missing its film id.' }
      chosen.push(source)
    }
  }
  const pasted = parsePastedSources(String(input.pasted || ''))
  if (!pasted.ok) return pasted
  const sources = [...chosen, ...pasted.sources].slice(0, 25)
  if (!sources.length) return { ok: false, error: 'Choose at least one talk, or paste a link.' }
  return { ok: true, sources }
}

async function loadSeats(payload: Payload) {
  const seats = await payload.find({ collection: 'seats', overrideAccess: true, depth: 1, limit: 200 })
  return seats.docs.map((seat) => {
    const clause = seat.clause as { number?: number } | number | null
    const number = typeof clause === 'object' && clause ? Number(clause.number || 0) : 0
    return { clause: number, position: Number(seat.position || 0) }
  }).filter((seat) => seat.clause && seat.position)
}

/** yt-dlp only. The watch-page fallback was holding the whole draft open after yt-dlp had already answered. */
async function readYoutubeCaptions(id: string, timeoutMs: number): Promise<CaptionRead> {
  if (process.env.HEARTS_TRANSCRIPT_FIXTURE) {
    const transcript = transcriptFixture(id)
    return transcript ? { transcript, detail: 'Captions read.', include: true, warn: false } : { transcript: null, detail: NO_CAPTIONS, include: true, warn: true }
  }
  const dir = await mkdtemp(path.join(tmpdir(), 'hearts-sheet-'))
  try {
    let stdout = ''
    let stderr = ''
    let code: string | number | undefined
    let timedOut = false
    try {
      const result = await execFileAsync(ytDlpBinary(), ytDlpArgs(id, dir), { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, killSignal: 'SIGKILL' })
      stdout = String(result.stdout || '')
      stderr = String(result.stderr || '')
    } catch (error) {
      const failure = error as { killed?: boolean; signal?: string; code?: string | number; stderr?: string | Buffer; stdout?: string | Buffer }
      stdout = String(failure.stdout || '')
      stderr = String(failure.stderr || '')
      code = failure.code ?? undefined
      timedOut = Boolean(failure.killed || failure.signal === 'SIGKILL' || failure.signal === 'SIGTERM' || failure.code === 'ETIMEDOUT')
    }
    if (timedOut) return { transcript: null, detail: TOO_LONG, include: true, warn: true }
    const names = await readdir(dir).catch(() => [] as string[])
    const files = await Promise.all(names.map(async (name) => ({ name, text: await readFile(path.join(dir, name), 'utf8').catch(() => null) })))
    const interpreted = interpretYtDlpOutput({ stdout, stderr, code, files })
    if (interpreted.text) return { transcript: interpreted.text, detail: 'Captions read.', include: true, warn: false }
    if (interpreted.outcome === 'none') return { transcript: null, detail: NO_CAPTIONS, include: true, warn: true }
    if (interpreted.outcome === 'unavailable') return { transcript: null, detail: interpreted.message, include: false, warn: true }
    if (interpreted.outcome === 'blocked') return { transcript: null, detail: BLOCKED, include: true, warn: true }
    if (interpreted.outcome === 'missing') return { transcript: null, detail: interpreted.message, include: true, warn: true }
    return { transcript: null, detail: interpreted.message || NO_CAPTIONS, include: true, warn: true }
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : NO_CAPTIONS
    return { transcript: null, detail: message, include: true, warn: true }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

async function captionsFor(source: CreatorSource, id: string, timeoutMs: number): Promise<CaptionRead> {
  if (source.transcript) return { transcript: source.transcript, detail: 'Captions read.', include: true, warn: false }
  if (source.provider !== 'youtube') return { transcript: null, detail: NO_CAPTIONS, include: true, warn: true }
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return { transcript: null, detail: 'That link is missing the film id.', include: false, warn: true }
  return readYoutubeCaptions(id, timeoutMs)
}

/** One talk. A caption problem is a sentence on that talk; it does not throw the rest of the sheet away. */
export async function draftOne(
  payload: Payload,
  input: { topic: string; course: string; part: string; order?: number },
  source: CreatorSource,
  options: { captionTimeoutMs?: number; seats?: { clause: number; position: number }[] } = {},
): Promise<TalkDraftResult> {
  const title = source.title || (source.id ? `YouTube ${source.id}` : 'Untitled film')
  const id = String(source.id || source.mediaId || '').trim()
  if (source.provider === 'file' && !source.mediaId) return { included: false, warn: true, detail: 'An uploaded film is missing its media id. Upload it again.', title }
  if (source.provider !== 'file' && !id) return { included: false, warn: true, detail: 'A talk is missing its film id.', title }
  const seats = options.seats || await loadSeats(payload)
  let read: CaptionRead
  try {
    read = await captionsFor(source, id, options.captionTimeoutMs ?? CAPTION_TIMEOUT_MS)
  } catch (error) {
    const detail = error instanceof Error && error.message ? error.message : NO_CAPTIONS
    read = { transcript: null, detail, include: true, warn: true }
  }
  if (!read.include) return { included: false, warn: true, detail: read.detail, title }
  try {
    const drafted = draftTalk({
      provider: source.provider,
      id: id || String(source.mediaId || ''),
      title,
      speaker: source.speaker,
      channel: source.channel,
      durationSeconds: source.durationSeconds,
      mediaId: source.mediaId,
      transcript: read.transcript ? cell(read.transcript) : null,
    } satisfies DraftSource, {
      topic: input.topic,
      course: input.course,
      part: input.part || 'Talks',
      order: input.order,
      seats,
    })
    if (read.warn) drafted.talk.notes = cell(read.detail)
    return {
      included: true,
      warn: read.warn,
      detail: read.detail,
      title: String(drafted.talk.title || title),
      talk: drafted.talk,
      questions: drafted.questions,
      resources: drafted.resources,
    }
  } catch (error) {
    const detail = error instanceof Error && error.message ? error.message : 'This talk could not be drafted.'
    return { included: false, warn: true, detail, title }
  }
}

export async function draftSources(
  payload: Payload,
  input: { topic: string; course: string; part: string; sources: CreatorSource[] },
  options: { captionTimeoutMs?: number } = {},
) {
  const seats = await loadSeats(payload)
  const results: TalkDraftResult[] = []
  let order = 1
  for (const source of input.sources) {
    results.push(await draftOne(payload, { ...input, order: order++ }, source, { ...options, seats }))
  }
  const included = results.filter((result) => result.included && result.talk)
  return {
    results,
    talks: included.map((result) => result.talk!),
    questions: included.flatMap((result) => result.questions || []),
    resources: included.flatMap((result) => result.resources || []),
  }
}

export async function draftWorkbook(payload: Payload, scope: SheetScope, input: { topic: string; course: string; part: string; sources: CreatorSource[] }, options: { captionTimeoutMs?: number } = {}) {
  const drafted = await draftSources(payload, input, options)
  void scope
  const buffer = await buildWorkbook({ talks: drafted.talks, questions: drafted.questions, resources: drafted.resources })
  return { buffer, talks: drafted.talks.length, questions: drafted.questions.length, resources: drafted.resources.length, results: drafted.results }
}
