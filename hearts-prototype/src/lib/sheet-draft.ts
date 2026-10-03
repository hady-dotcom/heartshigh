// Drafts a master-sheet talk from a chosen film. There is no AI-steps registry in this tree, so the steps live
// here: cuts from the caption lines, Jibril and Ghunya tags, resources, and question drafts. A test can pass its
// own resources step. Nothing is published; every row stays a draft for the normal preview and apply.
import { doorCode, doorNumberOfClause } from './doors'
import { readFileSync } from 'node:fs'
import { dualExtract } from './extractor'
import { mulberry32, seedFrom, shuffleChoices } from './choices'
import { killListHits } from './opening-data'
import { parseTranscript } from './transcript'
import { draftTiers } from './tiers'

export type DraftSource = {
  provider: 'youtube' | 'vimeo' | 'file'
  id: string
  title: string
  speaker?: string
  channel?: string
  durationSeconds?: number | null
  thumbnail?: string | null
  captions?: 'yes' | 'no' | 'unknown'
  mediaId?: number | null
  transcript?: string | null
}

export type DraftRequest = {
  topic: string
  course: string
  part: string
  order?: number
  seats?: { clause: number; position: number }[]
}

export type DraftBundle = {
  talk: Record<string, string | number | null>
  questions: Record<string, string | number | null>[]
  resources: Record<string, string | number | null>[]
  needsTranscript: boolean
}

export type ResourceStep = (input: { topic: string; title: string; transcript: string; lines: { at: number; text: string }[] }) => { label: string; kind: string; body: string; url?: string }[]

const NEEDS = 'Needs transcript. Captions were not available, so the cuts are still open.'

function clock(total: number) {
  const value = Math.max(0, Math.round(total))
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function transcriptFixture(id: string): string | null {
  const raw = process.env.HEARTS_TRANSCRIPT_FIXTURE
  if (!raw) return null
  try {
    const text = raw.trim().startsWith('{') ? raw : readFileSync(raw, 'utf8')
    const parsed = JSON.parse(text) as Record<string, string>
    return parsed[id] || null
  } catch {
    return null
  }
}

function linesOf(transcript: string) {
  const cues = parseTranscript(transcript).cues
  return cues
    .map((cue) => ({ at: cue.start, text: cue.text.replace(/\s+/g, ' ').trim() }))
    .filter((line) => line.text.split(/\s+/).length >= 3)
}

function safe(text: string, fallback: string) {
  return text.trim() && !killListHits(text).length ? text.trim() : fallback
}

/** Summary, timestamped quotes, a reading marked to verify, and a discussion guide. */
export function draftResources(input: { topic: string; title: string; transcript: string; lines: { at: number; text: string }[] }): ReturnType<ResourceStep> {
  const topic = input.topic.trim() || input.title.trim() || 'this talk'
  if (!input.transcript.trim()) {
    return [
      { label: 'Summary', kind: 'summary', body: 'Captions were not available, so this summary is still open.' },
      { label: 'Further reading', kind: 'reading', body: `Verify before sharing. On ${topic}, look for a commentary the speaker's circle already trusts.` },
      { label: 'Discussion guide', kind: 'guide', body: safe(`What line from ${topic} would you want to hear again?\nWho could you sit with and retell one part of this talk?\nWhat will you do with one line from this talk before the week is out?`, 'What line would you want to hear again?\nWho could you sit with and retell one part of this talk?') },
    ]
  }
  const spoken = input.lines.slice(0, 2).map((line) => line.text).join(' ')
  const summary = safe(`From the captions: ${spoken}`.slice(0, 500), 'From the captions. A person still writes the summary.')
  const quotes = input.lines.slice(0, 3).map((line, index) => ({
    label: `Key quote ${index + 1}`,
    kind: 'quote',
    body: `${clock(line.at)} — ${line.text}`.slice(0, 500),
  }))
  return [
    { label: 'Summary', kind: 'summary', body: summary },
    ...quotes,
    { label: 'Further reading', kind: 'reading', body: `Verify before sharing. On ${topic}, look for a commentary the speaker's circle already trusts.` },
    { label: 'Discussion guide', kind: 'guide', body: 'What line would you want to hear again?\nWho could you sit with and retell one part of this talk?\nWhat will you do with one line from this talk before the week is out?' },
  ]
}

function talkKey(source: DraftSource) {
  if (source.provider === 'vimeo') return `vimeo-${source.id}`
  if (source.provider === 'file') return `file-${source.mediaId || source.id}`
  return `yt-${source.id}`
}

/** Hook, turn and land are the speaker's words. The kill list does not cut them. */
function keepLine(line: string) {
  return line.trim() || null
}

/** An AI multiple-choice draft. The right answer starts in slot 2 and is then shuffled, so a batch is not stuck there. */
export function draftMultipleChoice(seedText: string) {
  const prompt = 'Which line from this talk would you want to hear again?'
  const shuffled = shuffleChoices(
    ['A line I would rather leave', 'The line I want to hear again', 'A line from another sitting', 'A line I did not catch'],
    1,
    mulberry32(seedFrom(`${seedText}:${prompt}`)),
  )
  return { prompt, choices: shuffled.choices, correct: String(shuffled.correctIndex + 1) }
}

/** One talk, its draft questions and its draft resources. Questions stay status draft. */
export function draftTalk(source: DraftSource, request: DraftRequest, steps?: { resources?: ResourceStep }): DraftBundle {
  const transcript = (source.transcript || '').trim()
  const sheetTranscript = transcript.length > 0 && transcript.length <= 30_000 ? transcript : ''
  const lines = transcript ? linesOf(transcript) : []
  const tiers = transcript ? draftTiers(transcript, source.durationSeconds) : null
  const needsTranscript = !transcript
  const extracted = transcript ? dualExtract(transcript) : null
  const clause = extracted?.cuts.find((cut) => cut.bestClause)?.bestClause ?? null
  const seat = clause ? request.seats?.find((item) => item.clause === clause) : undefined
  const duration = source.durationSeconds ?? tiers?.duration ?? null
  const hook = tiers ? keepLine(tiers.hook) : null
  const turn = tiers ? keepLine(tiers.turn) : null
  const land = tiers ? keepLine(tiers.land) : null
  const fits = !duration || !tiers || (tiers.hors.end <= duration + 0.05 && tiers.appetiser.end <= duration + 0.05)
  const timed = Boolean(tiers && hook && turn && land && fits)
  const talk: Record<string, string | number | null> = {
    talk_key: talkKey(source),
    youtube_id: source.provider === 'youtube' ? source.id : null,
    title: source.title,
    speaker: source.speaker || null,
    channel: source.channel || null,
    course: request.course,
    part: request.part,
    order: request.order ?? null,
    provider: source.provider === 'youtube' ? null : source.provider,
    vimeo_id: source.provider === 'vimeo' ? source.id : null,
    media_id: source.provider === 'file' ? source.mediaId || null : null,
    duration: duration ?? null,
    transcript: sheetTranscript || null,
    status: 'draft',
    notes: needsTranscript ? NEEDS : 'Draft from the captions. A person still checks the cuts.',
    jibril_door: clause ? doorCode(doorNumberOfClause(clause) || 0) : null,
    jibril_clause: clause,
    ghunya_seat: seat ? `${seat.clause}.${seat.position}` : null,
    hors_in: timed ? tiers!.hors.start : null,
    hors_out: timed ? tiers!.hors.end : null,
    app_in: timed ? tiers!.appetiser.start : null,
    app_out: timed ? tiers!.appetiser.end : null,
    hook_text: timed ? hook : null,
    turn_text: timed ? turn : null,
    land_text: timed ? land : null,
  }
  const clamp = (value: number) => {
    const next = Math.max(0, Math.round(value))
    return duration && next > duration ? Math.max(0, Math.floor(duration) - 1) : next
  }
  const popupAt = clamp(tiers ? tiers.hookAt : duration && duration > 20 ? 15 : 0)
  const reflectAt = clamp(tiers ? tiers.turnAt : popupAt)
  const taskAt = clamp(tiers ? tiers.landAt : duration && duration > 5 ? Math.min(duration - 1, 30) : 0)
  const choice = draftMultipleChoice(String(talk.talk_key))
  const questions: Record<string, string | number | null>[] = [
    { talk_key: talk.talk_key, type: 'free text', time: popupAt, text: 'What stayed with you in this part of the talk?', source: 'ai', status: 'draft', place: 'popup' },
    {
      talk_key: talk.talk_key, type: 'multiple choice', time: popupAt, text: choice.prompt, source: 'ai', status: 'draft', place: 'popup',
      choice_1: choice.choices[0], choice_2: choice.choices[1], choice_3: choice.choices[2], choice_4: choice.choices[3], correct_choice: choice.correct,
    },
    { talk_key: talk.talk_key, type: 'reflection', time: reflectAt, text: 'Which line would you want to sit with again?', source: 'ai', status: 'draft', place: 'popup' },
    { talk_key: talk.talk_key, type: 'reflection', time: 0, text: 'Write a few lines on what you will carry from this talk into the coming days.', source: 'ai', status: 'draft', place: 'workbook' },
    {
      talk_key: talk.talk_key, type: 'task', time: taskAt,
      text: 'This week, call a parent or an elder and ask how they are.',
      source: 'ai', status: 'draft', due_days: 7, evidence: 'note', show_imam: 'yes',
    },
  ]
  const resources = (steps?.resources || draftResources)({ topic: request.topic, title: source.title, transcript, lines }).map((row) => ({
    talk_key: talk.talk_key, label: row.label, kind: row.kind, body: row.body, url: row.url || null, status: null,
  }))
  return { talk, questions, resources, needsTranscript }
}

export const DRAFT_STEPS = ['cuts', 'tags', 'resources', 'questions'] as const
