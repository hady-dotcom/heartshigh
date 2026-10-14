import type { Payload } from 'payload'
import { transcriptFromFile } from '@/lib/transcript-file'
import { parseTranscript, type Cue } from '@/lib/transcript'
import { transcriptFixture } from '@/lib/sheet-draft'
import {
  coursesForFilm,
  cuesToTranscript,
  describeTalk,
  downloadVtt,
  isApprovedClip,
  lineSwaps,
  pushVersion,
  readEdits,
  redoVersion,
  rewriteSpoken,
  sameCues,
  transcriptSaveNotice,
  undoVersion,
  type TranscriptEdits,
  type TranscriptRow,
} from '@/lib/transcript-desk'
import {
  bringInNote,
  cleanedTimedTranscript,
  defaultProviders,
  ingestYoutubeUrl,
  noteAfterTranscriptUpload,
  type TranscriptProvider,
} from '@/lib/youtube'
import { str } from '@/screens/common'

type Doc = Record<string, unknown> & { id: number }

const fixtureProvider: TranscriptProvider = {
  name: 'saved-captions',
  async fetch(id) {
    return transcriptFixture(id)
  },
}

function cuesOf(raw: string) {
  return parseTranscript(raw || '').cues
}

function timedOf(raw: string) {
  return parseTranscript(raw || '').timed
}

async function lessonOf(payload: Payload, id: number) {
  try {
    return (await payload.findByID({ collection: 'lessons', id, depth: 0, overrideAccess: true })) as unknown as Doc
  } catch {
    return null
  }
}

export async function listTranscriptTalks(payload: Payload): Promise<TranscriptRow[]> {
  const lessons = (await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 400, sort: 'title' })).docs as unknown as Doc[]
  const courseIds = [...new Set(lessons.map((row) => Number(row.course)).filter((id) => Number.isFinite(id) && id > 0))]
  const courses = courseIds.length
    ? ((await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: courseIds.length, where: { id: { in: courseIds } } })).docs as unknown as Doc[])
    : []
  const courseTitle = new Map(courses.map((row) => [row.id, str(row.title)]))
  const filmRows = lessons.map((row) => ({ id: row.id, youtubeId: str(row.youtubeId), course: courseTitle.get(Number(row.course)) || '' }))
  return lessons
    .map((row) =>
      describeTalk({
        id: row.id,
        title: str(row.title),
        speaker: str(row.speaker),
        durationSeconds: Number(row.durationSeconds) || 0,
        youtubeId: str(row.youtubeId),
        transcript: str(row.transcript),
        transcriptSource: str(row.transcriptSource),
        transcriptNote: str(row.transcriptNote),
        publishState: str(row.publishState),
        courses: coursesForFilm(str(row.youtubeId), row.id, filmRows),
      }),
    )
    .sort((a, b) => a.title.localeCompare(b.title, 'en'))
}

export async function loadTranscriptEditor(payload: Payload, id: number) {
  const lesson = await lessonOf(payload, id)
  if (!lesson) return null
  const parsed = parseTranscript(str(lesson.transcript))
  const edits = readEdits(lesson.transcriptEdits)
  const talks = await listTranscriptTalks(payload)
  const row = talks.find((item) => item.id === id)
  return {
    id: lesson.id,
    title: str(lesson.title) || 'Untitled talk',
    speaker: str(lesson.speaker),
    youtubeId: str(lesson.youtubeId),
    timed: parsed.cues.length > 0 && parsed.timed,
    lines: parsed.cues.map((cue) => ({ start: cue.start, end: cue.end, text: cue.text })),
    canUndo: edits.history.length > 0,
    canRedo: edits.redo.length > 0,
    versions: edits.history.length,
    row,
  }
}

async function writeLesson(
  payload: Payload,
  id: number,
  data: { transcript: string; transcriptSource?: string; transcriptNote?: string; transcriptEdits: TranscriptEdits; durationSeconds?: number },
) {
  await payload.update({ collection: 'lessons', id, overrideAccess: true, data: data as never })
}

function stringsOf(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function rewriteHorsLines(before: Cue[], after: Cue[], value: unknown) {
  if (!Array.isArray(value)) return { value, changed: false }
  let changed = false
  const next = value.map((row) => {
    if (!row || typeof row !== 'object') return row
    const item = row as { text?: unknown; raw?: unknown }
    const text = rewriteSpoken(before, after, stringsOf(item.text))
    const raw = rewriteSpoken(before, after, stringsOf(item.raw))
    if (text.changed || raw.changed) changed = true
    return { ...item, ...(typeof item.text === 'string' ? { text: text.text } : {}), ...(typeof item.raw === 'string' ? { raw: raw.text } : {}) }
  })
  return { value: next, changed }
}

function rewriteTidy(before: Cue[], after: Cue[], value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { value, changed: false }
  const tidy = value as Record<string, unknown>
  let changed = false
  const next: Record<string, unknown> = { ...tidy }
  for (const key of ['quote', 'hook', 'turn', 'land']) {
    if (typeof tidy[key] !== 'string') continue
    const rewritten = rewriteSpoken(before, after, tidy[key])
    next[key] = rewritten.text
    if (rewritten.changed) changed = true
  }
  const lines = rewriteHorsLines(before, after, tidy.horsLines)
  if (lines.changed) {
    next.horsLines = lines.value
    changed = true
  }
  return { value: next, changed }
}

/** Copy edited lines into hook, turn, land and the other caption text that quotes them. */
async function flowEdits(payload: Payload, lessonId: number, before: Cue[], after: Cue[]) {
  const swaps = lineSwaps(before, after)
  if (!swaps.length) return { flowed: 0, approved: 0, skipped: 0 }
  let flowed = 0
  let approved = 0
  let skipped = 0
  const note = async (status: string, changed: boolean, run: () => Promise<unknown>) => {
    if (!changed) return
    try {
      await run()
      flowed++
      if (isApprovedClip(status)) approved++
    } catch {
      skipped++
    }
  }
  const cuts = (await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 200, where: { lesson: { equals: lessonId } } })).docs as unknown as Doc[]
  for (const cut of cuts) {
    const hook = rewriteSpoken(before, after, stringsOf(cut.hook))
    const turn = rewriteSpoken(before, after, stringsOf(cut.turn))
    const land = rewriteSpoken(before, after, stringsOf(cut.land))
    const fullContext = rewriteSpoken(before, after, stringsOf(cut.fullContext))
    const changed = hook.changed || turn.changed || land.changed || fullContext.changed
    await note(stringsOf(cut.status), changed, () =>
      payload.update({
        collection: 'cuts',
        id: cut.id,
        overrideAccess: true,
        data: { hook: hook.text, turn: turn.text, land: land.text, ...(fullContext.changed ? { fullContext: fullContext.text } : {}) } as never,
      }),
    )
  }
  const ladder = (await payload.find({ collection: 'ladder-items', overrideAccess: true, depth: 0, limit: 200, where: { lesson: { equals: lessonId } } })).docs as unknown as Doc[]
  for (const item of ladder) {
    const quote = rewriteSpoken(before, after, stringsOf(item.quote))
    await note(stringsOf(item.status), quote.changed, () =>
      payload.update({ collection: 'ladder-items', id: item.id, overrideAccess: true, data: { quote: quote.text } as never }),
    )
  }
  const tiers = (await payload.find({ collection: 'talk-tiers', overrideAccess: true, depth: 0, limit: 5, where: { lesson: { equals: lessonId } } })).docs as unknown as Doc[]
  for (const tier of tiers) {
    const hook = rewriteSpoken(before, after, stringsOf(tier.hook))
    const turn = rewriteSpoken(before, after, stringsOf(tier.turn))
    const land = rewriteSpoken(before, after, stringsOf(tier.land))
    const horsQuote = rewriteSpoken(before, after, stringsOf(tier.horsQuote))
    const horsLines = rewriteHorsLines(before, after, tier.horsLines)
    const lineTidy = rewriteTidy(before, after, tier.lineTidy)
    const changed = hook.changed || turn.changed || land.changed || horsQuote.changed || horsLines.changed || lineTidy.changed
    await note(stringsOf(tier.status), changed, () =>
      payload.update({
        collection: 'talk-tiers',
        id: tier.id,
        overrideAccess: true,
        data: {
          ...(hook.changed ? { hook: hook.text } : {}),
          ...(turn.changed ? { turn: turn.text } : {}),
          ...(land.changed ? { land: land.text } : {}),
          ...(horsQuote.changed ? { horsQuote: horsQuote.text } : {}),
          ...(horsLines.changed ? { horsLines: horsLines.value } : {}),
          ...(lineTidy.changed ? { lineTidy: lineTidy.value } : {}),
        } as never,
      }),
    )
  }
  return { flowed, approved, skipped }
}

async function storeTranscript(
  payload: Payload,
  lesson: Doc,
  nextText: string,
  source: 'youtube' | 'upload',
  label: string,
  extra: { transcriptNote?: string; durationSeconds?: number },
) {
  const current = str(lesson.transcript)
  const before = cuesOf(current)
  const after = cuesOf(nextText)
  const edits = pushVersion(readEdits(lesson.transcriptEdits), current, label, new Date().toISOString())
  await writeLesson(payload, lesson.id, {
    transcript: nextText,
    transcriptSource: source,
    transcriptEdits: edits,
    ...(extra.transcriptNote ? { transcriptNote: extra.transcriptNote } : {}),
    ...(extra.durationSeconds && extra.durationSeconds > 0 ? { durationSeconds: extra.durationSeconds } : {}),
  })
  const flow = await flowEdits(payload, lesson.id, before, after)
  return flow
}

export async function fetchTalkCaptions(youtubeId: string) {
  const canned = transcriptFixture(youtubeId)
  const result = await ingestYoutubeUrl(`https://www.youtube.com/watch?v=${youtubeId}`, {
    providers: [fixtureProvider, ...defaultProviders],
    ...(canned
      ? {
          duration: null,
          meta: async (id: string) => ({ id, title: 'YouTube', author: 'YouTube', thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }),
        }
      : {}),
  })
  if (!result.ok || !result.transcript.trim()) {
    return { ok: false as const, error: 'YouTube did not give captions for this film. Upload a file onto the talk.' }
  }
  const stored = cleanedTimedTranscript(result.transcript)
  return { ok: true as const, transcript: stored.cleaned, duration: result.durationSeconds }
}

export async function runTranscriptAction(payload: Payload, action: string, form: FormData): Promise<{ error?: string; notice?: string; next?: string }> {
  const lessonId = Number(String(form.get('lesson') || ''))
  const back = `/master/transcripts/${lessonId || ''}`
  const lesson = await lessonOf(payload, lessonId)
  if (!lesson) return { error: 'Pick a talk by its title.', next: '/master/transcripts' }

  if (action === 'fetch-talk-captions') {
    const youtubeId = str(lesson.youtubeId)
    if (!/^[\w-]{11}$/.test(youtubeId)) return { error: 'This talk has no YouTube film. Upload a file onto it from the list.', next: back }
    const fetched = await fetchTalkCaptions(youtubeId)
    if (!fetched.ok) return { error: fetched.error, next: back }
    const flow = await storeTranscript(payload, lesson, fetched.transcript, 'youtube', 'YouTube captions', {
      transcriptNote: bringInNote('processed', 'Captions fetched from YouTube on the Transcripts desk.', 'en'),
      durationSeconds: fetched.duration || undefined,
    })
    const changed = lineSwaps(cuesOf(str(lesson.transcript)), cuesOf(fetched.transcript)).length
    return {
      notice: `Captions are in from YouTube. ${transcriptSaveNotice({ changedLines: changed, ...flow })}`.replace('Saved. ', ''),
      next: back,
    }
  }

  if (action === 'upload-transcript-file') {
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) return { error: 'Choose a .vtt, .srt or .txt file.', next: '/master/transcripts' }
    const name = file.name.toLowerCase()
    if (!name.endsWith('.vtt') && !name.endsWith('.srt') && !name.endsWith('.txt') && !name.endsWith('.md')) {
      return { error: 'Use a .vtt, .srt or .txt file.', next: '/master/transcripts' }
    }
    if (file.size > 5 * 1024 * 1024) return { error: 'A transcript should be under 5 MB.', next: '/master/transcripts' }
    const body = Buffer.from(await file.arrayBuffer())
    const parsed = transcriptFromFile(body)
    if (!parsed.ok) return { error: parsed.message, next: '/master/transcripts' }
    const timed = timedOf(parsed.text)
    const stored = timed ? cleanedTimedTranscript(parsed.text).cleaned : parsed.text.trim()
    const attached = noteAfterTranscriptUpload(str(lesson.transcriptNote), file.name, str(lesson.publishState) || null)
    await storeTranscript(payload, lesson, stored, 'upload', `Uploaded ${file.name}`, { transcriptNote: attached.transcriptNote })
    return { notice: `${attached.notice} The words are on “${str(lesson.title)}”.`, next: `/master/transcripts/${lesson.id}` }
  }

  if (action === 'save-transcript') {
    const starts = form.getAll('start').map(String)
    const ends = form.getAll('end').map(String)
    const texts = form.getAll('text').map(String)
    const cues: Cue[] = []
    for (let index = 0; index < texts.length; index++) {
      const text = texts[index].replace(/\s+/g, ' ').trim()
      if (!text) continue
      const start = Number(starts[index])
      const end = Number(ends[index])
      cues.push({ start: Number.isFinite(start) ? start : 0, end: Number.isFinite(end) && end > start ? end : start + 2, text })
    }
    if (!cues.length) return { error: 'A transcript needs at least one line.', next: back }
    const current = str(lesson.transcript)
    const before = cuesOf(current)
    if (sameCues(before, cues)) return { notice: 'Nothing changed.', next: back }
    const timed = String(form.get('timed') || '') === 'yes' || timedOf(current)
    const nextText = cuesToTranscript(cues, timed)
    const flow = await storeTranscript(payload, lesson, nextText, str(lesson.transcriptSource) === 'youtube' ? 'youtube' : 'upload', 'Saved', {})
    return { notice: transcriptSaveNotice({ changedLines: lineSwaps(before, cues).length, ...flow }), next: back }
  }

  if (action === 'undo-transcript' || action === 'redo-transcript') {
    const current = str(lesson.transcript)
    const moved = action === 'undo-transcript' ? undoVersion(readEdits(lesson.transcriptEdits), current, new Date().toISOString()) : redoVersion(readEdits(lesson.transcriptEdits), current, new Date().toISOString())
    if (!moved) return { error: action === 'undo-transcript' ? 'There is no earlier save to bring back.' : 'There is no newer save to put back.', next: back }
    const before = cuesOf(current)
    const after = cuesOf(moved.text)
    await writeLesson(payload, lesson.id, {
      transcript: moved.text,
      transcriptEdits: moved.edits,
    })
    const flow = await flowEdits(payload, lesson.id, before, after)
    const lead = action === 'undo-transcript' ? 'Brought back the previous words.' : 'Put the newer words back.'
    const extra = flow.flowed ? ` ${transcriptSaveNotice({ changedLines: lineSwaps(before, after).length, ...flow })}`.replace('Saved. ', '') : ''
    return { notice: `${lead}${extra}`, next: back }
  }

  return { error: 'That action is not known.', next: '/master/transcripts' }
}

export function vttDownload(transcript: string, title: string) {
  return downloadVtt(transcript, title)
}
