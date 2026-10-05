// The HEARTS master sheet: talks, pop-up questions, resources, circle answers and speakers in bulk.
// Pure module. The desk and the tests share it, and nothing here touches the database.
import ExcelJS from 'exceljs'
import { youtubeIdFromUrl } from './extractor'
import {
  extractsFromTier,
  extractKindFromSheet,
  extractStatusFromSheet,
  sameExtractWindow,
  sameTypeOverlapProblem,
  timeInTalkProblem,
  verbatimProblem,
  type ExtractKind,
  type ExtractStatus,
  type TalkExtract,
} from './extracts'
import { DRAFT_NOTE, horsCapOf, horsVerdict, normaliseSpans, saidInTalk, tierProblem, timingProblems, type AppetiserSpan } from './tiers'
import { authorTextProblems, markupProblems } from './opening-data'
import { citationUrl, resolveSpeaker, speakerSlug, imageUrl, type SpeakerIdentity, type SpeakerLink } from './speakers'
import { hasMarkup, httpsHref } from './text-safety'
import { DOORS, clauseForDoor, doorCode, doorLabel, doorNumberOfClause, doorOfClause, parseDoor, type Door } from './doors'
import { CIRCLE_COLUMNS, CIRCLE_NOTE, CIRCLE_TAB, circleSheetValues, readCircleRow, type CircleColumn } from './circle-sheet'

export const TALK_COLUMNS = [
  'talk_key', 'youtube_id', 'title', 'speaker', 'channel', 'course', 'part', 'order', 'lane', 'jibril_door', 'jibril_clause', 'ghunya_seat',
  'hors_in', 'hors_out', 'app_in', 'app_out', 'hook_in', 'hook_out', 'turn_in', 'turn_out', 'land_in', 'land_out',
  'hook_text', 'turn_text', 'land_text', 'status', 'notes',
  'provider', 'vimeo_id', 'media_id', 'duration', 'transcript', 'pack',
] as const

export const QUESTION_COLUMNS = [
  'talk_key', 'youtube_id', 'question_id', 'type', 'time', 'text',
  'choice_1', 'choice_2', 'choice_3', 'choice_4', 'choice_5', 'choice_6',
  'correct_choice', 'source', 'status', 'notes',
  'due_days', 'evidence', 'show_imam', 'place',
] as const

export const RESOURCE_COLUMNS = ['talk_key', 'label', 'url', 'kind', 'status', 'body', 'media_id'] as const

export const EXTRACT_TAB = 'Extracts' as const
export const EXTRACT_COLUMNS = [
  'talk_key', 'youtube_id', 'extract_id', 'extract_type', 'start', 'end', 'text', 'score', 'status',
  'order', 'door', 'seat', 'arc', 'parent_start', 'words', 'hook_text', 'turn_text', 'land_text', 'notes',
] as const

export const EXTRACT_NOTE =
  "HEARTS extracts. One row is one hors d'oeuvre or one appetiser on a talk. Name the talk with talk_key or youtube_id (a full YouTube URL is fine). extract_type is hors or appetiser. start and end are seconds, m:ss or h:mm:ss and must sit inside the talk. Two extracts of the same type must not overlap. text is the speaker's words. status is draft, suggested, approved or rejected: suggested is an AI pick waiting on the admin timeline, and only approved extracts reach learners. An appetiser is a hook, turn and land; most hold none or one hors d'oeuvre, usually the turn running into the land. Hors that fall inside an appetiser are attached by time. arc is hook, turn or land when you already know which part of the appetiser the hors comes from. The old Talks columns hors_in, hors_out, app_in and app_out still work: they write the first pair and this tab can add more."

export const SPEAKER_TAB = 'Speakers' as const
export const SPEAKER_COLUMNS = ['slug', 'name', 'honorific', 'display_name', 'aliases', 'bio', 'photo_url', 'links', 'sources', 'status'] as const

export const TALK_NOTE =
  "HEARTS talks. One row is one talk. talk_key is how a later import finds the same talk, so keep it stable. Leave a cell blank to leave that field as it is. Times can be seconds (90), minutes and seconds (1:30) or hours (1:02:03). status is draft, checked or live. rejected keeps a talk hidden from learners. delete removes the talk. youtube_id is the 11-character YouTube id. provider is youtube, vimeo or file. A Vimeo talk puts the number in vimeo_id. An uploaded film puts the media id in media_id. duration is the length in seconds. transcript is the speaker's words and is only for captions that fit in the cell (under 30,000 characters); a longer transcript is a Resources row with kind transcript and a media_id. hook_text, turn_text, land_text and transcript are the speaker's words: the kill list is not applied to them. notes is our own writing and may contain plain text such as conf=high. A hors d'oeuvre is usually 15 to 30 seconds and sits inside the appetiser (inside one of its hook, turn or land cuts when it has them). Up to the cap on the master desk (45 seconds unless that cap is changed) is allowed and only warned about. Shorter than 15, or longer than the cap, is refused. app_in and app_out are one continuous appetiser. hook_in and hook_out, turn_in and turn_out, land_in and land_out are up to three separate cuts. The player plays them in that order, and their lengths together stay within about 3 minutes (195 seconds). pack is optional: the name or number of a course pack that already exists, and the talk's course joins it, so people who join with that pack's codes get the course. A portal admin can only name their own portal's packs. A blank pack leaves packs as they are, and the export leaves it blank. jibril_door is the door learners see, W1 to W20 (a bare 1 to 20 also works); jibril_clause is the clause underneath, 1 to 41. The export fills both. Fill either one: a door alone keeps the talk's clause when it already sits in that door, and otherwise takes the door's first clause. W3 in the jibril_clause column is read as a door too. If both are filled, the clause must sit in that door."

export const QUESTION_NOTE =
  'HEARTS questions. Name the talk with talk_key or youtube_id. The export writes question_id, and an import with that id updates the same question. A row with no question_id is matched to a question on the same talk with the same time and the same text, so importing the same file again does not add a copy. Leave question_id blank only when the question is new. type is free text, multiple choice, reflection or task. status is draft, approved or rejected (approved is what learners meet; rejected stays hidden). source is ai or human. A blank cell leaves that field as it is. The desk can approve new questions whose status is blank; a status written here still wins. delete removes the question. Times use the same forms as the Talks tab and must fall inside the talk. type task is an activation task: due_days is how many days the learner has (1 to 366), evidence is none, note or photo, and show_imam is yes when the imam should see it. place is popup or workbook. A workbook row is a reflection kept in the workbook rather than a pop-up in the film. Questions, choices and notes are our own writing. Notes may contain plain text such as conf=high.'

export const RESOURCE_NOTE =
  "HEARTS resources, one row per item. talk_key names the talk. The same talk_key and label updates that row next time. kind is link, file, summary, quote, reading, guide or transcript. url must start with https:// for a link, and for a file that is not an upload. A file row may instead put an uploaded file's number in media_id. kind transcript points at an uploaded text file (media_id) so a transcript longer than 30,000 characters can come in as a file rather than a cell; that file is copied onto the talk. summary, reading and guide are our own writing. quote and transcript are the speaker's words, so the kill list is not applied to them. A reading row is a suggestion to verify, not a link that has been checked. Leave status blank to keep the row, or put delete to remove it."

export const SPEAKER_NOTE =
  "HEARTS speakers. One row is one person. slug is the page address and is how a later import finds the same speaker, so keep it stable. Leave slug blank on a new row and it is taken from the name. aliases are other names for the same person, separated with a semicolon or a new line, and a talk that uses one of those names is linked here. links are http or https addresses, one per line, as the address itself or as label | https://…. photo_url is an https address of an image. status is draft or published. A blank cell leaves that field as it is. Names, the short bio and sources are our own writing."

const TABS = ['Talks', 'Questions', 'Resources', EXTRACT_TAB, CIRCLE_TAB, SPEAKER_TAB] as const
export type SheetTab = (typeof TABS)[number]

const HEADER_ALIASES: Record<string, string> = {
  talk_key: 'talk_key', key: 'talk_key', video_id: 'youtube_id', youtube: 'youtube_id', youtube_id: 'youtube_id',
  question_id: 'question_id', questionid: 'question_id', type: 'type', time: 'time', timestamp: 'time', text: 'text', question: 'text', question_text: 'text',
  correct: 'correct_choice', correct_choice: 'correct_choice', source: 'source', status: 'status', notes: 'notes', note: 'notes',
  title: 'title', speaker: 'speaker', channel: 'channel', course: 'course', part: 'part', order: 'order', lane: 'lane',
  jibril_clause: 'jibril_clause', clause: 'jibril_clause', jibril_door: 'jibril_door', door: 'jibril_door', working_door: 'jibril_door', ghunya_seat: 'ghunya_seat', seat: 'ghunya_seat',
  hors_in: 'hors_in', hors_out: 'hors_out', app_in: 'app_in', app_out: 'app_out',
  extract_id: 'extract_id', extractid: 'extract_id', extract_type: 'extract_type', extracttype: 'extract_type',
  extract_in: 'start', extract_out: 'end', extract_start: 'start', extract_end: 'end',
  extract_text: 'text', verbatim: 'text', score: 'score',
  extract_order: 'order', parent_start: 'parent_start', arc: 'arc', words: 'words',
  hook_in: 'hook_in', hook_out: 'hook_out', turn_in: 'turn_in', turn_out: 'turn_out', land_in: 'land_in', land_out: 'land_out',
  hook: 'hook_text', hook_text: 'hook_text', turn: 'turn_text', turn_text: 'turn_text', land: 'land_text', land_text: 'land_text',
  label: 'label', name: 'label', url: 'url', kind: 'kind', body: 'body', summary: 'body',
  provider: 'provider', vimeo_id: 'vimeo_id', vimeo: 'vimeo_id', media_id: 'media_id', media: 'media_id', duration: 'duration', length: 'duration', transcript: 'transcript',
  pack: 'pack', course_pack: 'pack', packs: 'pack',
  due_days: 'due_days', due: 'due_days', evidence: 'evidence', show_imam: 'show_imam', showimam: 'show_imam', place: 'place', family: 'place',
  choice1: 'choice_1', choice_1: 'choice_1', choices_1: 'choice_1', ac_1: 'choice_1', ac1: 'choice_1',
  choice2: 'choice_2', choice_2: 'choice_2', choices_2: 'choice_2', ac_2: 'choice_2', ac2: 'choice_2',
  choice3: 'choice_3', choice_3: 'choice_3', choices_3: 'choice_3', ac_3: 'choice_3', ac3: 'choice_3',
  choice4: 'choice_4', choice_4: 'choice_4', choices_4: 'choice_4', ac_4: 'choice_4', ac4: 'choice_4',
  choice5: 'choice_5', choice_5: 'choice_5', choices_5: 'choice_5', ac_5: 'choice_5', ac5: 'choice_5',
  choice6: 'choice_6', choice_6: 'choice_6', choices_6: 'choice_6', ac_6: 'choice_6', ac6: 'choice_6',
}

const QUESTION_KINDS: Record<string, string> = {
  'free text': 'question', freetype: 'question', 'free-text': 'question', question: 'question',
  'multiple choice': 'multiple_choice', 'multiple-choice': 'multiple_choice', multiple_choice: 'multiple_choice',
  reflection: 'reflection', task: 'task',
}
const KIND_LABEL: Record<string, string> = { question: 'free text', multiple_choice: 'multiple choice', reflection: 'reflection', task: 'task' }
const HUMAN_NOTE = /written (on the master desk|by a person)/i
const MACHINE_NOTE = /machine|captions/i
const HUMAN_SENTENCE = 'Written by a person on the master sheet.'
const NOTE_MARKERS = new Set([DRAFT_NOTE, HUMAN_SENTENCE, 'Written by a person on the master desk.', 'Written on the master desk.'])
const markerNote = (note: string) => !note.trim() || NOTE_MARKERS.has(note.trim())

export type SheetIssue = { tab: SheetTab; row: number; column: string; message: string }
export type SheetChange = { tab: SheetTab; row: number; action: 'create' | 'update' | 'delete'; label: string; detail: string }
export type Ref = { id: number } | { temp: string }

export type SheetOp =
  | { op: 'speaker.create'; temp: string; data: Record<string, unknown> }
  | { op: 'speaker.update'; id: number; patch: Record<string, unknown> }
  | { op: 'course.create'; temp: string; title: string; speaker?: string; speakerProfile?: Ref; origin: 'master' | 'local'; portal: number | null }
  | { op: 'course.update'; id: number; patch: Record<string, unknown> }
  | { op: 'unit.create'; temp: string; course: Ref; title: string; order: number }
  | { op: 'unit.update'; id: number; patch: { order: number } }
  | { op: 'lesson.create'; temp: string; course: Ref; unit: Ref; title: string; speaker?: string; speakerProfile?: Ref; youtubeId?: string; order?: number; lane?: string; portal: number | null; master: boolean; provider?: string; vimeoId?: string; mediaId?: number; durationSeconds?: number | null; transcript?: string; transcriptSource?: string; transcriptNote?: string }
  | { op: 'lesson.update'; id: number; patch: Record<string, unknown> }
  | { op: 'lesson.delete'; id: number }
  | { op: 'tier.create'; lesson: Ref; data: Record<string, unknown> }
  | { op: 'tier.update'; id: number; patch: Record<string, unknown> }
  | { op: 'tier.delete'; id: number }
  | { op: 'extract.create'; lesson: Ref; data: Record<string, unknown> }
  | { op: 'extract.update'; id: number; patch: Record<string, unknown> }
  | { op: 'extract.delete'; id: number }
  | { op: 'point.create'; lesson: Ref; data: Record<string, unknown> }
  | { op: 'point.update'; id: number; patch: Record<string, unknown> }
  | { op: 'point.delete'; id: number }
  | { op: 'resource.create'; lesson: Ref; data: Record<string, unknown> }
  | { op: 'resource.update'; id: number; patch: Record<string, unknown> }
  | { op: 'resource.delete'; id: number }
  | { op: 'key.upsert'; id?: number; lesson: Ref; talkKey: string; channel?: string | null; sheetStatus?: string | null }
  | { op: 'key.delete'; id: number }
  | { op: 'cut.create'; lesson: Ref; course: Ref; data: Record<string, unknown> }
  | { op: 'cut.update'; id: number; patch: Record<string, unknown> }
  | { op: 'circle.create'; point: number; lesson: number; data: Record<string, unknown> }
  | { op: 'circle.update'; id: number; patch: Record<string, unknown> }
  | { op: 'circle.delete'; id: number }
  | { op: 'pack.add'; pack: number; course: Ref }
  | { op: 'child.delete'; collection: 'engagement-points' | 'resources' | 'talk-tiers' | 'talk-extracts' | 'cuts' | 'ladder-items' | 'sheet-keys'; id: number }

export type SheetPlan = { errors: SheetIssue[]; warnings: SheetIssue[]; changes: SheetChange[]; unchanged: number; skipped: number; ops: SheetOp[] }

export type CourseRow = { id: number; title: string; origin: string; portal: number | null; speaker: string; speakerId?: number | null; inScope: boolean }
export type SpeakerRow = { id: number; name: string; honorific: string; displayName: string; slug: string; aliases: string[]; bio: string; photoUrl: string; links: SpeakerLink[]; sources: string; status: string }
export type UnitRow = { id: number; course: number; title: string; order: number }
export type LessonRow = {
  id: number; title: string; course: number; unit: number | null; order: number; speaker: string; speakerId?: number | null
  youtubeId: string; durationSeconds: number | null; starterLane: string; transcript: string; transcriptNote: string
  provider: string; vimeoId: string; mediaId: number | null; inScope: boolean
}
export type TierRow = { id: number; lesson: number; horsStart: number; horsEnd: number; appetiserStart: number; appetiserEnd: number; appetiserSpans?: AppetiserSpan[] | null; hook: string; turn: string; land: string; note: string; status: string }
export type ExtractRow = { id: number; lesson: number; kind: ExtractKind; start: number; end: number; quote: string; score: number | null; status: ExtractStatus; door: number | null; seat: number | null; order: number; parent: number | null; arc: TalkExtract['arc']; hook: string; turn: string; land: string }
export type PointRow = { id: number; lesson: number; second: number; kind: string; prompt: string; options: string[]; correctOption: string; status: string; draftNote: string; dueDays: number | null; evidence: string; showImam: boolean; family: string }
export type ResourceRow = { id: number; lesson: number; name: string; url: string; kind: string; body: string; mediaId?: number | null }
export type KeyRow = { id: number; talkKey: string; lesson: number; channel: string; sheetStatus: string }
export type CutRow = { id: number; lesson: number; bestClause: number | null; seatId: number | null; seatClause: number | null; seatPosition: number | null; placeholder: boolean; status: string; start: number; course: number | null }
export type SeatRow = { id: number; clause: number; position: number }
export type CircleRow = { id: number; point: number; lesson: number; portal: number | null; name: string; body: string; tone: string; length: string; origin: string; enabled: boolean }
export type PackRow = { id: number; title: string; owner: string; portal: number | null; courses: number[] }
/** packPortal is set on a portal desk, which may only add courses to that portal's own packs. */
export type SheetCatalogue = { scopeKind: 'library' | 'portal' | 'course'; portalId: number | null; courseId: number | null; courses: CourseRow[]; units: UnitRow[]; lessons: LessonRow[]; tiers: TierRow[]; extracts?: ExtractRow[]; points: PointRow[]; resources: ResourceRow[]; keys: KeyRow[]; cuts: CutRow[]; seats: SeatRow[]; doors?: Door[]; horsMaxSeconds?: number; circle?: CircleRow[]; circlePortal?: number | null; speakers?: SpeakerRow[]; packs?: PackRow[]; packPortal?: number | null }

type Cell = { text: string; raw: unknown; numFmt?: string }
type InputRow = { row: number; cells: Record<string, Cell> }

const round2 = (value: number) => Math.round(value * 100) / 100
const foldName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
const normHeader = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, '_')

export function derivedTalkKey(lesson: { id: number; youtubeId?: string | null }) {
  const id = (lesson.youtubeId || '').trim()
  return id ? `yt-${id}` : `lesson-${lesson.id}`
}

const REF_FIELDS: Record<string, string> = { course: 'courses', unit: 'units', lesson: 'lessons', point: 'engagement-points', contingent: 'engagement-points', parent: 'talk-extracts' }

/** A restored row's links, with any row restored before it swapped for its new id. */
export function remapRefs(data: Record<string, unknown>, moved: Map<string, Map<number, number>>) {
  const out = { ...data }
  for (const [field, collection] of Object.entries(REF_FIELDS)) {
    const ids = moved.get(collection)
    const value = out[field]
    if (ids && typeof value === 'number' && ids.has(value)) out[field] = ids.get(value)
  }
  return out
}

export function planCounts(plan: SheetPlan) {
  const count = (action: SheetChange['action']) => plan.changes.filter((change) => change.action === action).length
  return { create: count('create'), update: count('update'), delete: count('delete'), unchanged: plan.unchanged, skipped: plan.skipped, errors: plan.errors.length }
}

export function emptyCatalogue(scope: Partial<SheetCatalogue> = {}): SheetCatalogue {
  return { scopeKind: 'library', portalId: null, courseId: null, courses: [], units: [], lessons: [], tiers: [], extracts: [], points: [], resources: [], keys: [], cuts: [], seats: [], circle: [], speakers: [], packs: [], ...scope }
}

/** Seconds from a cell: a number of seconds, m:ss, h:mm:ss, or an Excel/Google time. */
export function parseSheetTime(raw: unknown, numFmt?: string): { ok: true; seconds: number } | { ok: false; message: string } {
  if (raw instanceof Date) {
    const serial = (raw.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000
    const seconds = serial >= 0 && serial < 8 ? round2(serial * 86400) : round2(raw.getUTCHours() * 3600 + raw.getUTCMinutes() * 60 + raw.getUTCSeconds() + raw.getUTCMilliseconds() / 1000)
    return seconds >= 0 ? { ok: true, seconds } : { ok: false, message: 'Times start at 0.' }
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return { ok: false, message: 'Times start at 0. Use seconds (90), m:ss (1:30) or h:mm:ss (1:02:03).' }
    const timeFormat = Boolean(numFmt && /[hs]/i.test(numFmt) && numFmt.includes(':'))
    return { ok: true, seconds: round2(timeFormat ? raw * 86400 : raw) }
  }
  const text = String(raw ?? '').trim()
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(text)) return { ok: false, message: `“${text}” is not a time. Use seconds (90), m:ss (1:30) or h:mm:ss (1:02:03).` }
  const parts = text.split(':')
  if (parts.slice(1).some((part) => Number(part) >= 60)) return { ok: false, message: `“${text}” is not a time. Minutes and seconds stay under 60.` }
  return { ok: true, seconds: round2(parts.reduce((total, part) => total * 60 + Number(part), 0)) }
}

/** A Vimeo id, or a vimeo.com / player.vimeo.com link. */
export function parseVimeoId(raw: string): { ok: true; id: string } | { ok: false; message: string } {
  const text = raw.trim()
  if (/^\d{6,12}$/.test(text)) return { ok: true, id: text }
  try {
    const url = new URL(text)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = url.pathname.split('/').filter(Boolean).reverse().find((part) => /^\d{6,12}$/.test(part))
      if (id) return { ok: true, id }
    }
  } catch {
    /* not a url */
  }
  return { ok: false, message: `“${text}” is not a Vimeo id. Use the number from the film’s link, such as 76979871.` }
}

export function parseYoutubeId(raw: string): { ok: true; id: string } | { ok: false; message: string } {
  const text = raw.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return { ok: true, id: text }
  const fromUrl = youtubeIdFromUrl(text)
  if (fromUrl) return { ok: true, id: fromUrl }
  if (/^https?:/i.test(text) || text.includes('/')) return { ok: false, message: 'Use the 11-character YouTube id. Links to other sites are not accepted here.' }
  return { ok: false, message: `“${text}” is not a YouTube id. An id is 11 letters, numbers, dashes or underscores.` }
}

function clock(total: number) {
  const value = Math.max(0, Math.round(total))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

function plainProblems(pairs: [string, string][]) {
  return markupProblems(pairs)
}

/** Speaker lines: markup is refused, and a transcript must contain the words. The kill list is for our own writing, not for quotes. */
function tierLineProblems(label: string, text: string, transcript: string) {
  const problems = plainProblems([[label, text]])
  if (!text.trim() || problems.length) return problems
  if (transcript.trim() && !saidInTalk(text, transcript)) problems.push(`${label} has to be the speaker's words, word for word from the transcript.`)
  return problems
}

function resourceBodyProblems(kind: string, body: string) {
  if (kind === 'summary' || kind === 'reading' || kind === 'guide') return authorTextProblems([['Body', body]])
  return plainProblems([['Body', body]])
}

function spanCell(tier: TierRow | undefined, role: AppetiserSpan['role'], edge: 'start' | 'end') {
  const span = tier?.appetiserSpans?.find((item) => item.role === role)
  return span ? numOrNull(span[edge]) : null
}

function questionTextProblems(prompt: string, choices: string[], correct: string) {
  return authorTextProblems([['The question', prompt], ...choices.map((choice, index): [string, string] => [`Choice ${index + 1}`, choice]), ['The right answer', correct]])
}

function canonical(header: string) {
  const key = normHeader(header).replace(/_(\d)$/, '$1')
  return HEADER_ALIASES[key] || HEADER_ALIASES[normHeader(header)] || null
}

function readCell(cell: ExcelJS.Cell): Cell | null {
  let value = cell.value
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if ('richText' in value && Array.isArray(value.richText)) value = value.richText.map((part) => part.text).join('')
    else if ('result' in value && value.result !== undefined) value = value.result as ExcelJS.CellValue
    else if ('text' in value) value = String(value.text || '')
    else if ('hyperlink' in value && 'text' in value) value = String((value as { text?: string }).text || '')
  }
  if (value == null || value === '') return null
  const text = value instanceof Date ? '' : String(value)
  if (!(value instanceof Date) && typeof value !== 'number' && !text.trim()) return null
  return { text: text.trim(), raw: value, numFmt: cell.numFmt }
}

// The CircleAnswers tab has its own names (name, body, length), so the Talks and Resources aliases do not apply to it.
function circleCanonical(header: string) {
  const key = normHeader(header)
  if ((CIRCLE_COLUMNS as readonly string[]).includes(key)) return key
  return ({ key: 'talk_key', video_id: 'youtube_id', youtube: 'youtube_id', answer: 'body', text: 'body', id: 'circle_id' } as Record<string, string>)[key] || null
}

// The Speakers tab has its own names. `name` on Resources means the label, so that alias must not apply here.
function speakerCanonical(header: string) {
  const key = normHeader(header)
  return ({
    slug: 'slug', name: 'name', honorific: 'honorific', display_name: 'display_name', displayname: 'display_name',
    aliases: 'aliases', alias: 'aliases', bio: 'bio', short_bio: 'bio', photo_url: 'photo_url', photourl: 'photo_url',
    links: 'links', sources: 'sources', status: 'status',
  } as Record<string, string>)[key] || null
}

function extractCanonical(header: string) {
  const key = normHeader(header)
  if ((EXTRACT_COLUMNS as readonly string[]).includes(key)) return key
  return ({
    key: 'talk_key', video_id: 'youtube_id', youtube: 'youtube_id', youtube_url: 'youtube_id', url: 'youtube_id',
    extractid: 'extract_id', id: 'extract_id',
    type: 'extract_type', kind: 'extract_type', extract: 'extract_type',
    in: 'start', out: 'end', extract_in: 'start', extract_out: 'end', hors_in: 'start', hors_out: 'end', app_in: 'start', app_out: 'end',
    quote: 'text', verbatim: 'text', extract_text: 'text',
    parent: 'parent_start', parent_in: 'parent_start',
    note: 'notes',
  } as Record<string, string>)[key] || null
}

function canonFor(tab: SheetTab) {
  if (tab === CIRCLE_TAB) return circleCanonical
  if (tab === SPEAKER_TAB) return speakerCanonical
  if (tab === EXTRACT_TAB) return extractCanonical
  return canonical
}

function headerOf(sheet: ExcelJS.Worksheet, columns: readonly string[], canon: (header: string) => string | null = canonical) {
  let found: { row: number; map: Map<number, string> } | null = null
  const known = new Set(columns)
  sheet.eachRow({ includeEmpty: false }, (row) => {
    if (found || row.number > 8) return
    const map = new Map<number, string>()
    for (let index = 1; index <= row.cellCount; index += 1) {
      const cell = readCell(row.getCell(index))
      const name = cell ? canon(cell.text) : null
      if (name && known.has(name)) map.set(index, name)
    }
    if (map.size >= 2) found = { row: row.number, map }
  })
  return found as { row: number; map: Map<number, string> } | null
}

async function workbookOf(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)
  return workbook
}

function sheetNamed(workbook: ExcelJS.Workbook, name: SheetTab) {
  return workbook.worksheets.find((sheet) => sheet.name.trim().toLowerCase() === name.toLowerCase()) || null
}

/** Read an .xlsx, including one that Google Sheets has exported. */
export async function readWorkbook(buffer: Buffer): Promise<{ talks: InputRow[]; questions: InputRow[]; resources: InputRow[]; circle: InputRow[]; speakers: InputRow[]; extracts: InputRow[]; errors: SheetIssue[] }> {
  const errors: SheetIssue[] = []
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    return { talks: [], questions: [], resources: [], circle: [], speakers: [], extracts: [], errors: [{ tab: 'Talks', row: 1, column: 'file', message: 'This file is not an Excel workbook. Download the template and save it as .xlsx. In Google Sheets use File, Download, Microsoft Excel.' }] }
  }
  let workbook: ExcelJS.Workbook
  try {
    workbook = await workbookOf(buffer)
  } catch {
    return { talks: [], questions: [], resources: [], circle: [], speakers: [], extracts: [], errors: [{ tab: 'Talks', row: 1, column: 'file', message: 'That workbook could not be opened. Save it again as .xlsx and upload that file.' }] }
  }
  const read = (tab: SheetTab, columns: readonly string[]) => {
    const sheet = sheetNamed(workbook, tab)
    if (!sheet) return []
    const header = headerOf(sheet, columns, canonFor(tab))
    if (!header) {
      errors.push({ tab, row: 1, column: columns[0], message: `The ${tab} tab needs its header row. Download a fresh template and keep that row.` })
      return []
    }
    const rows: InputRow[] = []
    sheet.eachRow({ includeEmpty: false }, (row) => {
      if (row.number <= header.row) return
      const cells: Record<string, Cell> = {}
      for (const [index, name] of header.map) {
        const cell = readCell(row.getCell(index))
        if (cell) cells[name] = cell
      }
      if (Object.keys(cells).length) rows.push({ row: row.number, cells })
    })
    return rows
  }
  const talks = read('Talks', TALK_COLUMNS)
  const questions = read('Questions', QUESTION_COLUMNS)
  const resources = read('Resources', RESOURCE_COLUMNS)
  const extracts = read(EXTRACT_TAB, EXTRACT_COLUMNS)
  const circle = read(CIRCLE_TAB, CIRCLE_COLUMNS)
  const speakers = read(SPEAKER_TAB, SPEAKER_COLUMNS)
  if (!TABS.some((tab) => sheetNamed(workbook, tab))) {
    errors.push({ tab: 'Talks', row: 1, column: 'file', message: `The workbook needs a Talks, Questions, Resources, Extracts, ${CIRCLE_TAB} or ${SPEAKER_TAB} tab. Download the template to start from.` })
  }
  return { talks, questions, resources, extracts, circle, speakers, errors }
}

function addSheet(workbook: ExcelJS.Workbook, name: SheetTab, note: string, columns: readonly string[], rows: Record<string, string | number | null>[]) {
  const sheet = workbook.addWorksheet(name)
  const noteRow = sheet.addRow([note])
  sheet.mergeCells(1, 1, 1, columns.length)
  noteRow.height = 48
  noteRow.font = { italic: true, color: { argb: 'FF5C5648' }, size: 11 }
  noteRow.alignment = { wrapText: true, vertical: 'middle' }
  const header = sheet.addRow([...columns])
  header.font = { bold: true }
  header.alignment = { vertical: 'middle' }
  sheet.views = [{ state: 'frozen', ySplit: 2 }]
  sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: columns.length } }
  columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = Math.min(36, Math.max(14, column.length + 2))
  })
  for (const data of rows) {
    const row = sheet.addRow(columns.map((column) => (data[column] == null || data[column] === '' ? null : data[column])))
    columns.forEach((column, index) => {
      if (typeof data[column] === 'string') row.getCell(index + 1).numFmt = '@'
    })
  }
  return sheet
}

export async function buildWorkbook(sheets: { talks?: Record<string, string | number | null>[]; questions?: Record<string, string | number | null>[]; resources?: Record<string, string | number | null>[]; extracts?: Record<string, string | number | null>[]; circle?: Record<string, string | number | null>[]; speakers?: Record<string, string | number | null>[] }) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'HEARTS'
  addSheet(workbook, 'Talks', TALK_NOTE, TALK_COLUMNS, sheets.talks || [])
  addSheet(workbook, 'Questions', QUESTION_NOTE, QUESTION_COLUMNS, sheets.questions || [])
  addSheet(workbook, 'Resources', RESOURCE_NOTE, RESOURCE_COLUMNS, sheets.resources || [])
  addSheet(workbook, EXTRACT_TAB, EXTRACT_NOTE, EXTRACT_COLUMNS, sheets.extracts || [])
  addSheet(workbook, CIRCLE_TAB, CIRCLE_NOTE, CIRCLE_COLUMNS, sheets.circle || [])
  addSheet(workbook, SPEAKER_TAB, SPEAKER_NOTE, SPEAKER_COLUMNS, sheets.speakers || [])
  const out = await workbook.xlsx.writeBuffer()
  return Buffer.from(out)
}

export function templateWorkbook() {
  return buildWorkbook({})
}

function numOrNull(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null
  const rounded = round2(value)
  return Number.isInteger(rounded) ? rounded : rounded
}

function carrier(cuts: CutRow[], lessonId: number) {
  const own = cuts.filter((cut) => cut.lesson === lessonId)
  return own.find((cut) => cut.placeholder) || own.filter((cut) => cut.status === 'approved').sort((a, b) => a.start - b.start || a.id - b.id)[0] || own.sort((a, b) => a.start - b.start || a.id - b.id)[0] || null
}

function talkStatusOf(lesson: LessonRow, catalogue: SheetCatalogue) {
  const key = catalogue.keys.find((row) => row.lesson === lesson.id)
  const tier = catalogue.tiers.find((row) => row.lesson === lesson.id)
  if (!tier) return null
  if (key?.sheetStatus === 'live' && tier.status === 'checked') return 'live'
  if (tier.status === 'draft' || tier.status === 'checked' || tier.status === 'rejected') return tier.status
  return null
}

function doorCodeOf(clause: number, doors: Door[] = DOORS) {
  const door = doorNumberOfClause(clause, doors)
  return door ? doorCode(door) : null
}

function seatLabel(cut: CutRow | null) {
  if (!cut?.seatClause || !cut.seatPosition) return null
  return `${cut.seatClause}.${cut.seatPosition}`
}

/** The cells an export writes for one talk. The planner diffs against the same shape. */
export function talkSheetValues(lesson: LessonRow, catalogue: SheetCatalogue): Record<string, string | number | null> {
  const course = catalogue.courses.find((row) => row.id === lesson.course)
  const unit = catalogue.units.find((row) => row.id === lesson.unit)
  const tier = catalogue.tiers.find((row) => row.lesson === lesson.id)
  const key = catalogue.keys.find((row) => row.lesson === lesson.id)
  const cut = carrier(catalogue.cuts, lesson.id)
  return {
    talk_key: key?.talkKey || derivedTalkKey(lesson),
    youtube_id: lesson.youtubeId || null,
    title: lesson.title || null,
    speaker: lesson.speaker || null,
    channel: key?.channel || null,
    course: course?.title || null,
    part: unit?.title || null,
    order: numOrNull(lesson.order),
    lane: lesson.starterLane || null,
    jibril_door: cut?.bestClause ? doorCodeOf(cut.bestClause, catalogue.doors) : null,
    jibril_clause: cut?.bestClause ? cut.bestClause : null,
    ghunya_seat: seatLabel(cut),
    hors_in: tier ? numOrNull(tier.horsStart) : null,
    hors_out: tier ? numOrNull(tier.horsEnd) : null,
    app_in: tier ? numOrNull(tier.appetiserStart) : null,
    app_out: tier ? numOrNull(tier.appetiserEnd) : null,
    hook_in: spanCell(tier, 'hook', 'start'),
    hook_out: spanCell(tier, 'hook', 'end'),
    turn_in: spanCell(tier, 'turn', 'start'),
    turn_out: spanCell(tier, 'turn', 'end'),
    land_in: spanCell(tier, 'land', 'start'),
    land_out: spanCell(tier, 'land', 'end'),
    hook_text: tier?.hook || null,
    turn_text: tier?.turn || null,
    land_text: tier?.land || null,
    status: talkStatusOf(lesson, catalogue),
    notes: tier?.note || lesson.transcriptNote || null,
    provider: lesson.provider === 'vimeo' || lesson.provider === 'file' ? lesson.provider : null,
    vimeo_id: lesson.vimeoId || null,
    media_id: lesson.mediaId || null,
    duration: numOrNull(lesson.durationSeconds),
  }
}

function splitList(value: string) {
  return value.split(/[;\n]/).map((part) => part.trim()).filter(Boolean)
}

function sameStrings(left: string[], right: string[]) {
  const a = [...left].map((item) => item.trim()).filter(Boolean).sort()
  const b = [...right].map((item) => item.trim()).filter(Boolean).sort()
  return a.length === b.length && a.every((item, index) => item === b[index])
}

function linkKey(link: SpeakerLink) {
  return `${link.label.trim()}|${citationUrl(link.url) || link.url.trim()}`
}

function sameLinks(left: SpeakerLink[], right: SpeakerLink[]) {
  const a = left.map(linkKey).sort()
  const b = right.map(linkKey).sort()
  return a.length === b.length && a.every((item, index) => item === b[index])
}

export function speakerSheetValues(speaker: SpeakerRow): Record<string, string | number | null> {
  return {
    slug: speaker.slug,
    name: speaker.name,
    honorific: speaker.honorific || null,
    display_name: speaker.displayName || null,
    aliases: speaker.aliases.length ? speaker.aliases.join('; ') : null,
    bio: speaker.bio || null,
    photo_url: speaker.photoUrl || null,
    links: speaker.links.length ? speaker.links.map((link) => `${link.label} | ${link.url}`).join('\n') : null,
    sources: speaker.sources || null,
    status: speaker.status || 'draft',
  }
}

export function questionSource(point: PointRow) {
  const note = point.draftNote || ''
  if (HUMAN_NOTE.test(note)) return 'human'
  if (point.status === 'draft') return !note || MACHINE_NOTE.test(note) ? 'ai' : 'human'
  if (MACHINE_NOTE.test(note)) return 'ai'
  return 'human'
}

export function questionStatus(point: PointRow) {
  if (point.status === 'draft') return 'draft'
  if (point.status === 'rejected') return 'rejected'
  return 'approved'
}

export function questionSheetValues(point: PointRow, catalogue: SheetCatalogue): Record<string, string | number | null> {
  const lesson = catalogue.lessons.find((row) => row.id === point.lesson)
  const key = lesson ? catalogue.keys.find((row) => row.lesson === lesson.id) : null
  const choices = point.options || []
  const correctIndex = point.correctOption ? choices.findIndex((choice) => choice === point.correctOption) : -1
  const values: Record<string, string | number | null> = {
    talk_key: lesson ? key?.talkKey || derivedTalkKey(lesson) : null,
    youtube_id: lesson?.youtubeId || null,
    question_id: point.id,
    type: KIND_LABEL[point.kind] || point.kind || null,
    time: numOrNull(point.second),
    text: point.prompt || null,
    correct_choice: correctIndex >= 0 ? String(correctIndex + 1) : point.correctOption || null,
    source: questionSource(point),
    status: questionStatus(point),
    notes: point.draftNote || null,
    due_days: point.dueDays ?? null,
    evidence: point.evidence || null,
    show_imam: point.showImam ? 'yes' : null,
    place: point.family === 'workbook' ? 'workbook' : null,
  }
  for (let index = 0; index < 6; index += 1) values[`choice_${index + 1}`] = choices[index] || null
  return values
}

export function resourceSheetValues(resource: ResourceRow, catalogue: SheetCatalogue): Record<string, string | number | null> {
  const lesson = catalogue.lessons.find((row) => row.id === resource.lesson)
  const key = lesson ? catalogue.keys.find((row) => row.lesson === lesson.id) : null
  return { talk_key: lesson ? key?.talkKey || derivedTalkKey(lesson) : null, label: resource.name, url: resource.url || null, kind: resource.kind || 'link', status: null, body: resource.body || null, media_id: resource.mediaId || null }
}

export function rowsFromCatalogue(catalogue: SheetCatalogue) {
  const lessons = catalogue.lessons.filter((lesson) => lesson.inScope)
  const ids = new Set(lessons.map((lesson) => lesson.id))
  return {
    talks: lessons.map((lesson) => talkSheetValues(lesson, catalogue)),
    questions: catalogue.points.filter((point) => ids.has(point.lesson)).map((point) => questionSheetValues(point, catalogue)),
    resources: catalogue.resources.filter((resource) => ids.has(resource.lesson)).map((resource) => resourceSheetValues(resource, catalogue)),
    extracts: (catalogue.extracts || []).filter((row) => ids.has(row.lesson)).map((row) => extractSheetValues(row, catalogue)),
    circle: (catalogue.circle || []).filter((answer) => ids.has(answer.lesson)).map((answer) => circleRowValues(answer, catalogue)),
    speakers: (catalogue.speakers || []).map((speaker) => speakerSheetValues(speaker)),
  }
}

export function extractSheetValues(extract: ExtractRow, catalogue: SheetCatalogue): Record<string, string | number | null> {
  const named = talkOf(extract.lesson, catalogue)
  const parent = extract.parent ? (catalogue.extracts || []).find((row) => row.id === extract.parent) : null
  return {
    talk_key: named.talkKey,
    youtube_id: named.youtubeId,
    extract_id: extract.id,
    extract_type: extract.kind,
    start: numOrNull(extract.start),
    end: numOrNull(extract.end),
    text: extract.quote || null,
    score: extract.score,
    status: extract.status,
    order: numOrNull(extract.order),
    door: extract.door,
    seat: extract.seat,
    arc: extract.arc,
    parent_start: parent ? numOrNull(parent.start) : null,
    words: null,
    hook_text: extract.hook || null,
    turn_text: extract.turn || null,
    land_text: extract.land || null,
    notes: null,
  }
}

function talkOf(lessonId: number, catalogue: SheetCatalogue) {
  const lesson = catalogue.lessons.find((row) => row.id === lessonId)
  const key = lesson ? catalogue.keys.find((row) => row.lesson === lesson.id) : null
  return { talkKey: lesson ? key?.talkKey || derivedTalkKey(lesson) : null, youtubeId: lesson?.youtubeId || null }
}

export function circleRowValues(answer: CircleRow, catalogue: SheetCatalogue): Record<string, string | number | null> {
  return circleSheetValues(answer, talkOf(answer.lesson, catalogue))
}

function textOf(row: InputRow, column: string) {
  return row.cells[column]?.text ?? ''
}

function present(row: InputRow, column: string) {
  return column in row.cells
}

type Found = { lesson: LessonRow | null; pending: string | null; error: string | null }

function sameScalar(current: string | number | null, next: string | number | null) {
  if ((current == null || current === '') && (next == null || next === '')) return true
  if (current == null || current === '' || next == null || next === '') return false
  if (typeof current === 'number' || typeof next === 'number') return round2(Number(current)) === round2(Number(next))
  return String(current).trim() === String(next).trim()
}

type Working = {
  catalogue: SheetCatalogue
  errors: SheetIssue[]
  changes: SheetChange[]
  ops: SheetOp[]
  warnings: SheetIssue[]
  unchanged: number
  skipped: number
  pendingQuestions: Map<string, string>
  handledQuestions: Set<number>
  courses: Map<string, { temp: string; title: string; speaker?: string }>
  units: Map<string, { temp: string; title: string }>
  speakers: Map<string, { temp: string; name: string; slug: string; displayName: string; aliases: string[] }>
  /** Unit tokens in the order their part first appears in this course. */
  partSequence: Map<string, string[]>
  handledUnits: Set<number>
  approveQuestions: boolean
  lessons: Map<string, { temp: string; title: string; youtubeId: string; duration: number | null; transcript: string; course: Ref; unit: Ref }>
  byKey: Map<string, LessonRow>
  byYoutube: Map<string, LessonRow[]>
  outsideKey: Map<string, LessonRow>
  outsideYoutube: Map<string, LessonRow>
  questionIds: Map<number, number>
  packLinks: Set<string>
}

function indexCatalogue(catalogue: SheetCatalogue): Working {
  const working: Working = {
    catalogue, errors: [], warnings: [], changes: [], ops: [], unchanged: 0, skipped: 0, pendingQuestions: new Map(), handledQuestions: new Set(),
    courses: new Map(), units: new Map(), lessons: new Map(), speakers: new Map(), partSequence: new Map(), handledUnits: new Set(), approveQuestions: false,
    byKey: new Map(), byYoutube: new Map(), outsideKey: new Map(), outsideYoutube: new Map(), questionIds: new Map(), packLinks: new Set(),
  }
  const addKey = (map: Map<string, LessonRow>, key: string, lesson: LessonRow) => {
    if (!map.has(key)) map.set(key, lesson)
  }
  for (const lesson of catalogue.lessons) {
    const key = catalogue.keys.find((row) => row.lesson === lesson.id)
    const map = lesson.inScope ? working.byKey : working.outsideKey
    if (key?.talkKey) addKey(map, key.talkKey, lesson)
    addKey(map, derivedTalkKey(lesson), lesson)
    if (lesson.youtubeId) {
      const list = lesson.inScope ? working.byYoutube : null
      if (list) {
        const rows = list.get(lesson.youtubeId) || []
        rows.push(lesson)
        list.set(lesson.youtubeId, rows)
      } else working.outsideYoutube.set(lesson.youtubeId, lesson)
    }
  }
  return working
}

function locate(working: Working, talkKey: string, youtubeId: string): Found {
  if (talkKey && working.lessons.has(talkKey)) return { lesson: null, pending: talkKey, error: null }
  if (youtubeId) {
    for (const [key, pending] of working.lessons) if (pending.youtubeId === youtubeId && (!talkKey || talkKey === key)) return { lesson: null, pending: key, error: null }
  }
  if (talkKey && working.byKey.has(talkKey)) return { lesson: working.byKey.get(talkKey)!, pending: null, error: null }
  if (talkKey && working.outsideKey.has(talkKey)) return { lesson: null, pending: null, error: 'That talk is outside this import. A portal admin can only change courses made in their own portal.' }
  if (youtubeId) {
    const matches = working.byYoutube.get(youtubeId) || []
    if (matches.length > 1) return { lesson: null, pending: null, error: 'More than one talk in this import uses that YouTube id. Name the talk_key as well.' }
    if (matches.length === 1) {
      const current = working.catalogue.keys.find((row) => row.lesson === matches[0].id)?.talkKey || derivedTalkKey(matches[0])
      if (!talkKey || talkKey === current) return { lesson: matches[0], pending: null, error: null }
      return { lesson: null, pending: null, error: `That YouTube id already belongs to ${current}. Use that talk_key to update it.` }
    }
    if (working.outsideYoutube.has(youtubeId)) return { lesson: null, pending: null, error: 'That film belongs to a course outside this import.' }
  }
  return { lesson: null, pending: null, error: null }
}

function skip(working: Working, tab: SheetTab, row: number, column: string, message: string) {
  working.errors.push({ tab, row, column, message })
}

function courseRef(working: Working, title: string, speaker: string | undefined, speakerProfile: Ref | undefined, row: number): { ref: Ref; created: boolean } | { error: string } {
  const name = foldName(title)
  const pending = working.courses.get(name)
  if (pending) return { ref: { temp: pending.temp }, created: false }
  const inScope = working.catalogue.courses.filter((course) => course.inScope && foldName(course.title) === name)
  if (inScope.length > 1) return { error: `More than one course here is called “${title.trim()}”. Rename one in the editor first.` }
  if (inScope.length === 1) return { ref: { id: inScope[0].id }, created: false }
  const outside = working.catalogue.courses.find((course) => !course.inScope && foldName(course.title) === name)
  if (outside) {
    const where = outside.origin === 'master' ? 'the master library' : 'another portal'
    return { error: `“${title.trim()}” belongs to ${where}, not to this import. Portal admins add talks to courses made in their own portal.` }
  }
  if (working.catalogue.scopeKind === 'course') return { error: 'This import is for one course. The course column has to name that course, or be left blank.' }
  const temp = `course:${name}:${row}`
  const origin = working.catalogue.scopeKind === 'portal' ? 'local' : 'master'
  working.ops.push({ op: 'course.create', temp, title: title.trim(), speaker, speakerProfile, origin, portal: origin === 'local' ? working.catalogue.portalId : null })
  working.courses.set(name, { temp, title: title.trim(), speaker })
  return { ref: { temp }, created: true }
}

/** A course pack that already exists, by number or name. A portal desk only gets its own portal's packs. */
export function resolvePack(catalogue: SheetCatalogue, raw: string): { pack: PackRow } | { error: string } {
  const text = raw.trim()
  const all = catalogue.packs || []
  const allowed = (pack: PackRow) => catalogue.packPortal == null || (pack.owner === 'portal' && pack.portal === catalogue.packPortal)
  const matches = /^\d+$/.test(text) ? all.filter((pack) => pack.id === Number(text)) : all.filter((pack) => foldName(pack.title) === foldName(text))
  if (!matches.length) return { error: `No course pack is called “${text}”. Name a pack that already exists, or its number.` }
  const usable = matches.filter(allowed)
  if (!usable.length) return { error: `“${text}” is not one of this portal’s own packs. A portal admin can only add courses to packs made in their portal.` }
  if (usable.length > 1) return { error: `More than one pack is called “${text}”. Use the pack’s number instead.` }
  return { pack: usable[0] }
}

function addToPack(working: Working, pack: PackRow, course: Ref, courseTitle: string, row: number) {
  const token = `${pack.id}|${'id' in course ? `id:${course.id}` : course.temp}`
  if (working.packLinks.has(token)) return false
  working.packLinks.add(token)
  if ('id' in course && pack.courses.includes(course.id)) return false
  working.ops.push({ op: 'pack.add', pack: pack.id, course })
  working.changes.push({ tab: 'Talks', row, action: 'update', label: pack.title, detail: `“${courseTitle}” joins the pack. People who join with its codes from now on get the course.` })
  return true
}

/** The preview's "add new courses to pack" choice: every course this import creates joins that pack. */
export function addNewCoursesToPack(plan: SheetPlan, catalogue: SheetCatalogue, packId: number): { added: number } | { error: string } {
  const found = resolvePack(catalogue, String(packId))
  if ('error' in found) return found
  const already = new Set(plan.ops.flatMap((op) => (op.op === 'pack.add' && op.pack === packId && 'temp' in op.course ? [op.course.temp] : [])))
  let added = 0
  for (const op of [...plan.ops]) {
    if (op.op !== 'course.create' || already.has(op.temp)) continue
    plan.ops.push({ op: 'pack.add', pack: packId, course: { temp: op.temp } })
    plan.changes.push({ tab: 'Talks', row: 0, action: 'update', label: found.pack.title, detail: `New course “${op.title}” joins the pack.` })
    added += 1
  }
  return { added }
}

function courseTokenOf(course: Ref) {
  return 'id' in course ? `id:${course.id}` : course.temp
}

/** Parts take their order from the first time that part name appears in the course, starting at 1. */
function partOrder(working: Working, courseToken: string, token: string) {
  let list = working.partSequence.get(courseToken)
  if (!list) {
    list = []
    working.partSequence.set(courseToken, list)
  }
  if (!list.includes(token)) list.push(token)
  return list.indexOf(token) + 1
}

function unitRef(working: Working, course: Ref, title: string): Ref {
  const courseToken = courseTokenOf(course)
  const token = `${courseToken}:${foldName(title)}`
  const order = partOrder(working, courseToken, token)
  const pending = working.units.get(token)
  if (pending) return { temp: pending.temp }
  if ('id' in course) {
    const found = working.catalogue.units.find((unit) => unit.course === course.id && foldName(unit.title) === foldName(title))
    if (found) {
      if (!working.handledUnits.has(found.id)) {
        if (found.order !== order) working.ops.push({ op: 'unit.update', id: found.id, patch: { order } })
        working.handledUnits.add(found.id)
      }
      return { id: found.id }
    }
  }
  const temp = `unit:${token}`
  working.ops.push({ op: 'unit.create', temp, course, title: title.trim(), order })
  working.units.set(token, { temp, title: title.trim() })
  return { temp }
}

function parseOrder(raw: string) {
  if (!/^\d+(\.\d+)?$/.test(raw.trim())) return null
  return Math.round(Number(raw))
}

function parseClause(raw: string) {
  if (!/^\d+$/.test(raw.trim())) return null
  const number = Number(raw)
  return number >= 1 && number <= 41 ? number : null
}

function doorLabelFor(clause: number) {
  const door = doorOfClause(clause)
  return door ? doorLabel(door) : ''
}

function timeCell(row: InputRow, column: string): { ok: true; seconds: number } | { ok: false; message: string } | null {
  if (!present(row, column)) return null
  const cell = row.cells[column]
  return parseSheetTime(cell.raw instanceof Date || typeof cell.raw === 'number' ? cell.raw : cell.text, cell.numFmt)
}

function speakerIdentities(working: Working): SpeakerIdentity[] {
  const pending = [...working.speakers.values()].map((speaker) => ({ name: speaker.name, slug: speaker.slug, displayName: speaker.displayName, aliases: speaker.aliases }))
  return [...(working.catalogue.speakers || []), ...pending]
}

/** The speaker a talk cell names. The stored words change only when the public address would otherwise split. */
function speakerLink(working: Working, raw: string): { name: string; slug: string; ref: Ref | null; rewrite: boolean } | null {
  const resolved = resolveSpeaker(raw, speakerIdentities(working))
  if (!resolved) return null
  const stored = (working.catalogue.speakers || []).find((speaker) => speaker.slug === resolved.slug)
  const pending = working.speakers.get(resolved.slug)
  const ref: Ref | null = stored ? { id: stored.id } : pending ? { temp: pending.temp } : resolved.id ? { id: resolved.id } : null
  return { name: resolved.name, slug: resolved.slug, ref, rewrite: speakerSlug(raw) !== resolved.slug }
}

function sameSpeakerRef(current: number | null | undefined, ref: Ref | null) {
  if (!ref || 'temp' in ref) return false
  return (current || null) === ref.id
}

function linkCourseSpeaker(working: Working, course: Ref, link: { name: string; ref: Ref | null; rewrite: boolean } | null) {
  if (!link?.ref || 'temp' in course || 'temp' in link.ref) return
  const stored = working.catalogue.courses.find((row) => row.id === course.id)
  if (!stored || stored.speakerId) return
  if (working.ops.some((op) => op.op === 'course.update' && op.id === stored.id)) return
  const patch: Record<string, unknown> = { speakerProfile: link.ref.id }
  if (link.rewrite && stored.speaker && speakerSlug(stored.speaker) !== speakerSlug(link.name)) patch.speaker = link.name
  else if (!stored.speaker) patch.speaker = link.name
  working.ops.push({ op: 'course.update', id: stored.id, patch })
}

function parseLinks(text: string): { ok: true; links: SpeakerLink[] } | { ok: false; message: string } {
  const links: SpeakerLink[] = []
  for (const part of splitList(text)) {
    const pieces = part.split('|')
    const urlText = (pieces.length >= 2 ? pieces.pop() : part)!.trim()
    const label = pieces.length ? pieces.join('|').trim() || 'Link' : 'Link'
    const href = citationUrl(urlText)
    if (!href) return { ok: false, message: pieces.length ? `“${urlText}” has to be an http:// or https:// link.` : `“${part}” has to be an http:// or https:// link, or “label | https://…”.` }
    links.push({ label, url: href })
  }
  return { ok: true, links }
}

function planSpeakers(working: Working, rows: InputRow[]) {
  const seen = new Map<string, number>()
  for (const row of rows) {
    const name = textOf(row, 'name')
    const slugText = textOf(row, 'slug')
    const list = working.catalogue.speakers || []
    const resolved = !slugText && name ? resolveSpeaker(name, list) : null
    const slug = slugText || resolved?.slug || (name ? speakerSlug(name) : '')
    if (slug) seen.set(slug, (seen.get(slug) || 0) + 1)
  }
  for (const row of rows) {
    const problems: SheetIssue[] = []
    const fail = (column: string, message: string) => problems.push({ tab: SPEAKER_TAB, row: row.row, column, message })
    const name = textOf(row, 'name')
    const slugText = textOf(row, 'slug')
    const status = textOf(row, 'status').toLowerCase()
    if (present(row, 'status') && status !== 'draft' && status !== 'published') fail('status', 'Status is draft or published.')
    for (const [column, label] of [['name', 'Name'], ['honorific', 'Honorific'], ['display_name', 'Display name'], ['bio', 'Bio'], ['sources', 'Sources']] as const) {
      if (present(row, column)) problems.push(...plainProblems([[label, textOf(row, column)]]).map((message) => ({ tab: SPEAKER_TAB, row: row.row, column, message })))
    }
    let aliases: string[] | null = null
    if (present(row, 'aliases')) aliases = splitList(textOf(row, 'aliases'))
    let links: SpeakerLink[] | null = null
    if (present(row, 'links') && textOf(row, 'links')) {
      const parsed = parseLinks(textOf(row, 'links'))
      if (!parsed.ok) fail('links', parsed.message)
      else links = parsed.links
    }
    let photoUrl: string | null = null
    if (present(row, 'photo_url') && textOf(row, 'photo_url')) {
      photoUrl = imageUrl(textOf(row, 'photo_url'))
      if (!photoUrl) fail('photo_url', 'photo_url is an https address of an image, such as a .jpg. Put a page address in links.')
    }
    const existing = (() => {
      const list = working.catalogue.speakers || []
      if (slugText) {
        const bySlug = list.find((speaker) => speaker.slug === slugText)
        if (bySlug) return bySlug
      }
      if (!name) return null
      const resolved = resolveSpeaker(name, list)
      return resolved?.id ? list.find((speaker) => speaker.id === resolved.id) || null : null
    })()
    const slug = slugText || existing?.slug || (name ? speakerSlug(name) : '')
    if (slug && (seen.get(slug) || 0) > 1) fail('slug', `The slug “${slug}” is used on more than one row. Each speaker needs one row.`)
    if (problems.length) {
      working.errors.push(...problems)
      working.skipped += 1
      continue
    }
    if (!existing) {
      if (!name) {
        fail('name', 'A new speaker needs a name.')
        working.errors.push(...problems)
        working.skipped += 1
        continue
      }
      if (!slug) {
        fail('slug', 'A speaker needs a slug, or a name that can make one.')
        working.errors.push(...problems)
        working.skipped += 1
        continue
      }
      const taken = (working.catalogue.speakers || []).some((speaker) => speaker.slug === slug) || working.speakers.has(slug)
      if (taken) {
        fail('slug', `A speaker already uses the slug “${slug}”.`)
        working.errors.push(...problems)
        working.skipped += 1
        continue
      }
      const temp = `speaker:${slug}`
      const data: Record<string, unknown> = {
        name, slug, status: status || 'draft',
        honorific: textOf(row, 'honorific') || undefined,
        displayName: textOf(row, 'display_name') || undefined,
        aliases: aliases || [],
        bio: textOf(row, 'bio') || undefined,
        photoUrl: photoUrl || undefined,
        links: links || [],
        sources: textOf(row, 'sources') || undefined,
      }
      working.ops.push({ op: 'speaker.create', temp, data })
      working.speakers.set(slug, { temp, name, slug, displayName: textOf(row, 'display_name') || name, aliases: aliases || [] })
      working.changes.push({ tab: SPEAKER_TAB, row: row.row, action: 'create', label: name, detail: status === 'published' ? 'New speaker, published.' : 'New speaker, kept as a draft.' })
      continue
    }
    const patch: Record<string, unknown> = {}
    if (present(row, 'name') && name !== existing.name) patch.name = name
    if (slugText && slugText !== existing.slug) patch.slug = slugText
    if (present(row, 'honorific') && textOf(row, 'honorific') !== (existing.honorific || '')) patch.honorific = textOf(row, 'honorific')
    if (present(row, 'display_name') && textOf(row, 'display_name') !== (existing.displayName || '')) patch.displayName = textOf(row, 'display_name')
    if (aliases && !sameStrings(aliases, existing.aliases)) patch.aliases = aliases
    if (present(row, 'bio') && textOf(row, 'bio') !== (existing.bio || '')) patch.bio = textOf(row, 'bio')
    if (photoUrl && photoUrl !== (existing.photoUrl || '')) patch.photoUrl = photoUrl
    if (links && !sameLinks(links, existing.links)) patch.links = links
    if (present(row, 'sources') && textOf(row, 'sources') !== (existing.sources || '')) patch.sources = textOf(row, 'sources')
    if (status && status !== (existing.status || 'draft')) patch.status = status
    if (!Object.keys(patch).length) {
      working.unchanged += 1
      continue
    }
    working.ops.push({ op: 'speaker.update', id: existing.id, patch })
    working.changes.push({ tab: SPEAKER_TAB, row: row.row, action: 'update', label: existing.name, detail: 'The speaker will be updated.' })
  }
}

function planTalks(working: Working, rows: InputRow[]) {
  const seen = new Map<string, number>()
  for (const row of rows) {
    const key = textOf(row, 'talk_key')
    if (key) seen.set(key, (seen.get(key) || 0) + 1)
  }
  for (const row of rows) {
    const problems: SheetIssue[] = []
    const fail = (column: string, message: string) => problems.push({ tab: 'Talks', row: row.row, column, message })
    const talkKey = textOf(row, 'talk_key')
    if (!talkKey) fail('talk_key', 'Every talk needs a talk_key, so a later import can update this row instead of copying it.')
    else if ((seen.get(talkKey) || 0) > 1) fail('talk_key', `The talk_key “${talkKey}” is used on more than one row. Each talk needs its own key.`)
    else if (hasMarkup(talkKey) || talkKey.length > 80) fail('talk_key', 'A talk_key is plain text, up to 80 characters.')
    let youtubeId = ''
    if (present(row, 'youtube_id')) {
      const parsed = parseYoutubeId(textOf(row, 'youtube_id'))
      if (!parsed.ok) fail('youtube_id', parsed.message)
      else youtubeId = parsed.id
    }
    let provider = ''
    if (present(row, 'provider')) {
      const raw = textOf(row, 'provider').toLowerCase()
      if (raw !== 'youtube' && raw !== 'vimeo' && raw !== 'file') fail('provider', 'Provider is youtube, vimeo or file.')
      else provider = raw
    }
    let vimeoId = ''
    if (present(row, 'vimeo_id')) {
      const parsed = parseVimeoId(textOf(row, 'vimeo_id'))
      if (!parsed.ok) fail('vimeo_id', parsed.message)
      else vimeoId = parsed.id
    }
    let mediaId: number | null = null
    if (present(row, 'media_id')) {
      const raw = textOf(row, 'media_id')
      if (!/^\d+$/.test(raw) || Number(raw) < 1) fail('media_id', 'media_id is the number of an uploaded film.')
      else mediaId = Number(raw)
    }
    if (provider === 'vimeo' && !vimeoId) fail('vimeo_id', 'A Vimeo talk needs its vimeo_id.')
    if (provider === 'file' && !mediaId) fail('media_id', 'An uploaded talk needs its media_id.')
    let durationSeconds: number | null = null
    const parsedDuration = timeCell(row, 'duration')
    if (parsedDuration) {
      if (!parsedDuration.ok) fail('duration', parsedDuration.message)
      else durationSeconds = parsedDuration.seconds
    }
    let transcriptText = ''
    if (present(row, 'transcript')) {
      transcriptText = textOf(row, 'transcript')
      if (transcriptText.length > 30_000) fail('transcript', 'The transcript cell is too long for a sheet. Keep it under 30,000 characters, or add a Resources row with kind transcript and the media_id of the uploaded file.')
    }
    for (const [column, label] of [['title', 'Title'], ['speaker', 'Speaker'], ['channel', 'Channel'], ['course', 'Course'], ['part', 'Part'], ['lane', 'Lane'], ['notes', 'Notes']] as const) {
      if (present(row, column)) problems.push(...plainProblems([[label, textOf(row, column)]]).map((message) => ({ tab: 'Talks' as const, row: row.row, column, message })))
    }
    let pack: PackRow | null = null
    if (present(row, 'pack')) {
      const found = resolvePack(working.catalogue, textOf(row, 'pack'))
      if ('error' in found) fail('pack', found.error)
      else pack = found.pack
    }
    const status = textOf(row, 'status').toLowerCase()
    if (present(row, 'status') && !['draft', 'checked', 'live', 'rejected', 'delete'].includes(status)) fail('status', 'Status is draft, checked, live, rejected or delete.')
    let order: number | null = null
    if (present(row, 'order')) {
      order = parseOrder(textOf(row, 'order'))
      if (order == null || order < 0) fail('order', 'Order is a whole number, starting at 1 for the first talk in the part.')
    }
    const doors = working.catalogue.doors || DOORS
    let clause: number | null = null
    let door: number | null = null
    if (present(row, 'jibril_clause')) {
      const raw = textOf(row, 'jibril_clause')
      if (/^\s*w/i.test(raw)) {
        door = parseDoor(raw, doors)
        if (door == null) fail('jibril_clause', 'A door in the clause column is W1 to W20.')
      } else {
        clause = parseClause(raw)
        if (clause == null) fail('jibril_clause', 'A Jibril clause is a number from 1 to 41, or write a door as W1 to W20.')
      }
    }
    if (present(row, 'jibril_door')) {
      const named = parseDoor(textOf(row, 'jibril_door'), doors)
      if (named == null) fail('jibril_door', 'A Jibril door is W1 to W20, or a number from 1 to 20.')
      else if (door != null && door !== named) fail('jibril_door', `The clause column names door ${doorCode(door)} and this column names ${doorCode(named)}. Keep one.`)
      else door = named
    }
    if (clause != null && door != null) {
      const holds = doorNumberOfClause(clause, doors)
      if (holds !== door) fail('jibril_door', `Clause ${clause} is in door ${holds ? doorCode(holds) : 'none'}, not ${doorCode(door)}. Change one of them, or clear jibril_clause to place the talk by its door.`)
    }
    const times: Record<string, number> = {}
    const rowWarnings: SheetIssue[] = []
    for (const column of ['hors_in', 'hors_out', 'app_in', 'app_out', 'hook_in', 'hook_out', 'turn_in', 'turn_out', 'land_in', 'land_out'] as const) {
      const parsed = timeCell(row, column)
      if (!parsed) continue
      if (!parsed.ok) fail(column, parsed.message)
      else times[column] = parsed.seconds
    }
    const duplicateOnly = problems.length > 0 && problems.every((issue) => issue.column === 'talk_key' && issue.message.includes('more than one row'))
    if (problems.length && !duplicateOnly) {
      working.errors.push(...problems)
      working.skipped += 1
      continue
    }
    const found = locate(working, talkKey, youtubeId)
    if (found.error) {
      fail(talkKey ? 'talk_key' : 'youtube_id', found.error)
      working.errors.push(...problems)
      working.skipped += 1
      continue
    }
    if (duplicateOnly && !found.lesson && !found.pending) {
      working.errors.push(...problems)
      working.skipped += 1
      continue
    }
    if (status === 'delete') {
      if (problems.length || !found.lesson) {
        if (!found.lesson) fail('talk_key', 'There is no talk with that key to delete.')
        working.errors.push(...problems)
        working.skipped += 1
        continue
      }
      working.ops.push({ op: 'lesson.delete', id: found.lesson.id })
      working.changes.push({ tab: 'Talks', row: row.row, action: 'delete', label: found.lesson.title, detail: 'The talk, its pop-ups and its resources will be removed.' })
      continue
    }
    if (!found.lesson && !found.pending) {
      const title = textOf(row, 'title')
      const courseTitle = textOf(row, 'course') || (working.catalogue.scopeKind === 'course' ? working.catalogue.courses.find((course) => course.id === working.catalogue.courseId)?.title || '' : '')
      if (!title) {
        fail('title', 'A new talk needs a title.')
        working.errors.push(...problems)
        working.skipped += 1
        continue
      }
      if (!courseTitle) {
        fail('course', 'A new talk needs a course. Name the course, or import into one course so the column can be left blank.')
        working.errors.push(...problems)
        working.skipped += 1
        continue
      }
      const mark = checkpoint(working)
      const rawSpeaker = textOf(row, 'speaker')
      const linked = rawSpeaker ? speakerLink(working, rawSpeaker) : null
      const speakerText = linked ? (linked.rewrite ? linked.name : rawSpeaker) : rawSpeaker
      const course = courseRef(working, courseTitle, speakerText || undefined, linked?.ref || undefined, row.row)
      if ('error' in course) {
        rollback(working, mark)
        fail('course', course.error)
        working.errors.push(...problems)
        working.skipped += 1
        continue
      }
      const part = textOf(row, 'part') || 'Talks'
      const unit = unitRef(working, course.ref, part)
      const temp = `lesson:${talkKey}`
      const portal = working.catalogue.scopeKind === 'portal' || (working.catalogue.scopeKind === 'course' && working.catalogue.portalId) ? working.catalogue.portalId : null
      const master = !portal
      const source = transcriptText ? (provider === 'file' || provider === 'vimeo' ? 'upload' : 'youtube') : undefined
      working.ops.push({
        op: 'lesson.create', temp, course: course.ref, unit, title, speaker: speakerText || undefined, speakerProfile: linked?.ref || undefined, youtubeId: youtubeId || undefined, order: order ?? undefined, lane: textOf(row, 'lane') || undefined, portal, master,
        provider: provider || undefined, vimeoId: vimeoId || undefined, mediaId: mediaId || undefined, durationSeconds, transcript: transcriptText || undefined, transcriptSource: source,
      })
      linkCourseSpeaker(working, course.ref, linked)
      const tier = tierPatch(null, times, row, transcriptText, null, problems, rowWarnings, horsCapOf(working.catalogue.horsMaxSeconds))
      if (tier) working.ops.push({ op: 'tier.create', lesson: { temp }, data: tier })
      else if (status === 'checked' || status === 'live') fail('status', 'A checked or live talk needs the hors d\'oeuvre and appetiser times.')
      else if (present(row, 'notes') && textOf(row, 'notes')) {
        const created = working.ops.find((op) => op.op === 'lesson.create' && op.temp === temp)
        if (created && created.op === 'lesson.create') created.transcriptNote = textOf(row, 'notes')
      }
      const derived = youtubeId ? `yt-${youtubeId}` : ''
      if (textOf(row, 'channel') || status === 'live' || !derived || talkKey !== derived) {
        working.ops.push({ op: 'key.upsert', lesson: { temp }, talkKey, channel: textOf(row, 'channel') || null, sheetStatus: status === 'live' ? 'live' : null })
      }
      placeCut(working, null, { temp }, course.ref, clause, door, textOf(row, 'ghunya_seat'), title, row, problems)
      if (problems.length) {
        rollback(working, mark)
        working.errors.push(...problems)
        working.skipped += 1
        continue
      }
      working.lessons.set(talkKey, { temp, title, youtubeId, duration: durationSeconds, transcript: transcriptText, course: course.ref, unit })
      working.warnings.push(...rowWarnings)
      working.changes.push({ tab: 'Talks', row: row.row, action: 'create', label: title, detail: course.created ? `New talk in a new course, “${courseTitle.trim()}”.` : `New talk in “${courseTitle.trim()}”.` })
      if (pack) addToPack(working, pack, course.ref, courseTitle.trim(), row.row)
      continue
    }
    if (found.pending) {
      skip(working, 'Talks', row.row, 'talk_key', 'That talk_key is already added earlier in this sheet.')
      working.skipped += 1
      continue
    }
    const lesson = found.lesson!
    const mark = checkpoint(working)
    const current = talkSheetValues(lesson, working.catalogue)
    const lessonPatch: Record<string, unknown> = {}
    if (present(row, 'title') && !sameScalar(current.title, textOf(row, 'title'))) lessonPatch.title = textOf(row, 'title')
    let linkedSpeaker: ReturnType<typeof speakerLink> = null
    if (present(row, 'speaker')) {
      const raw = textOf(row, 'speaker')
      linkedSpeaker = speakerLink(working, raw)
      const nextText = linkedSpeaker?.rewrite ? linkedSpeaker.name : raw
      if (!sameScalar(current.speaker, nextText)) lessonPatch.speaker = nextText
      if (linkedSpeaker?.ref && !sameSpeakerRef(lesson.speakerId, linkedSpeaker.ref)) lessonPatch.speakerProfile = linkedSpeaker.ref
    }
    if (youtubeId && !sameScalar(current.youtube_id, youtubeId)) lessonPatch.youtubeId = youtubeId
    if (provider && provider !== (lesson.provider || '')) lessonPatch.videoProvider = provider
    if (vimeoId && vimeoId !== (lesson.vimeoId || '')) lessonPatch.vimeoId = vimeoId
    if (mediaId && mediaId !== (lesson.mediaId || 0)) lessonPatch.film = mediaId
    if (durationSeconds != null && !sameScalar(numOrNull(lesson.durationSeconds), durationSeconds)) lessonPatch.durationSeconds = durationSeconds
    if (present(row, 'transcript') && transcriptText !== (lesson.transcript || '')) lessonPatch.transcript = transcriptText
    if (order != null && !sameScalar(current.order, order)) lessonPatch.order = order
    if (present(row, 'lane') && !sameScalar(current.lane, textOf(row, 'lane'))) lessonPatch.starterLane = textOf(row, 'lane')
    let courseMove: Ref | null = null
    if (present(row, 'course') && !sameScalar(current.course, textOf(row, 'course'))) {
      const course = courseRef(working, textOf(row, 'course'), undefined, undefined, row.row)
      if ('error' in course) fail('course', course.error)
      else if ('temp' in course.ref || course.ref.id !== lesson.course) {
        courseMove = course.ref
        if ('id' in course.ref) lessonPatch.course = course.ref.id
      }
    }
    if (present(row, 'part') && textOf(row, 'part')) {
      const course = courseMove || { id: lesson.course }
      const unit = unitRef(working, course, textOf(row, 'part'))
      if ('id' in unit && unit.id !== lesson.unit) lessonPatch.unit = unit.id
    }
    const tier = working.catalogue.tiers.find((item) => item.lesson === lesson.id) || null
    const tierData = tierPatch(tier, times, row, present(row, 'transcript') ? transcriptText : lesson.transcript, String(current.status || ''), problems, rowWarnings, horsCapOf(working.catalogue.horsMaxSeconds))
    if (!tier && present(row, 'notes') && textOf(row, 'notes') !== (lesson.transcriptNote || '')) lessonPatch.transcriptNote = textOf(row, 'notes')
    const duration = lesson.durationSeconds
    const timesChanged = Boolean(tierData && ['horsStart', 'horsEnd', 'appetiserStart', 'appetiserEnd'].some((key) => key in tierData))
    if (duration && timesChanged && tierData) {
      const merged = {
        horsStart: Number(tierData.horsStart ?? tier?.horsStart), horsEnd: Number(tierData.horsEnd ?? tier?.horsEnd),
        appetiserStart: Number(tierData.appetiserStart ?? tier?.appetiserStart), appetiserEnd: Number(tierData.appetiserEnd ?? tier?.appetiserEnd),
      }
      for (const message of timingProblems(duration, [
        { label: "The hors d'oeuvre", start: merged.horsStart, end: merged.horsEnd },
        { label: 'The appetiser', start: merged.appetiserStart, end: merged.appetiserEnd },
      ])) fail(message.includes('appetiser') ? (message.includes('ends') ? 'app_out' : 'app_in') : message.includes('ends') ? 'hors_out' : 'hors_in', message)
    }
    const beforeCuts = working.ops.length
    placeCut(working, lesson, null, courseMove || { id: lesson.course }, clause, door, present(row, 'ghunya_seat') ? textOf(row, 'ghunya_seat') : '', String(lessonPatch.title || lesson.title), row, problems)
    const cutWritten = working.ops.length > beforeCuts
    const keyOp = keyPatch(working, lesson, talkKey, present(row, 'channel') ? textOf(row, 'channel') : null, status)
    linkCourseSpeaker(working, courseMove || { id: lesson.course }, linkedSpeaker)
    if (problems.length) {
      rollback(working, mark)
      working.errors.push(...problems)
      working.skipped += 1
      continue
    }
    const detail: string[] = []
    const partOrders = working.ops.slice(mark.ops).filter((op): op is Extract<SheetOp, { op: 'unit.update' }> => op.op === 'unit.update')
    if (partOrders.length) detail.push(`part order ${partOrders.map((op) => op.patch.order).join(' and ')}`)
    if (Object.keys(lessonPatch).length) {
      working.ops.push({ op: 'lesson.update', id: lesson.id, patch: lessonPatch })
      detail.push('the talk')
    }
    if (tierData && Object.keys(tierData).length) {
      if (tier) working.ops.push({ op: 'tier.update', id: tier.id, patch: tierData })
      else working.ops.push({ op: 'tier.create', lesson: { id: lesson.id }, data: tierData })
      detail.push('the tiers')
    }
    if (keyOp) {
      working.ops.push(keyOp)
      detail.push('the sheet key')
    }
    if (cutWritten) detail.push('the door and clause')
    working.warnings.push(...rowWarnings)
    const packCourse = courseMove || { id: lesson.course }
    const packTitle = present(row, 'course') ? textOf(row, 'course').trim() : working.catalogue.courses.find((item) => item.id === lesson.course)?.title || lesson.title
    const packed = pack ? addToPack(working, pack, packCourse, packTitle, row.row) : false
    if (!detail.length && !packed) working.unchanged += 1
    else if (!detail.length) continue
    else working.changes.push({ tab: 'Talks', row: row.row, action: 'update', label: lesson.title, detail: `Updates ${detail.join(', ')}.` })
  }
}

function checkpoint(working: Working) {
  return {
    ops: working.ops.length,
    courses: new Map(working.courses),
    units: new Map(working.units),
    partSequence: new Map([...working.partSequence].map(([key, list]) => [key, [...list]])),
    handledUnits: new Set(working.handledUnits),
  }
}

function rollback(working: Working, mark: ReturnType<typeof checkpoint>) {
  working.ops.length = mark.ops
  working.courses = mark.courses
  working.units = mark.units
  working.partSequence = mark.partSequence
  working.handledUnits = mark.handledUnits
}

function readSpans(tier: TierRow | null, times: Record<string, number>, row: InputRow, fail: (column: string, message: string) => void): AppetiserSpan[] | null {
  const roles = ['hook', 'turn', 'land'] as const
  const touched = roles.some((role) => `${role}_in` in times || `${role}_out` in times)
  if (!touched) return null
  const spans = (tier?.appetiserSpans || []).filter((span) => !roles.some((role) => role === span.role && (`${role}_in` in times || `${role}_out` in times)))
  let broken = false
  for (const role of roles) {
    const inn = `${role}_in`
    const out = `${role}_out`
    if (!(inn in times) && !(out in times)) continue
    if (!(inn in times) || !(out in times)) {
      fail(inn in times ? out : inn, `The ${role} cut needs both an in point and an out point.`)
      broken = true
      continue
    }
    spans.push({ role, start: times[inn], end: times[out] })
  }
  if (broken) return null
  return normaliseSpans(spans)
}

function tierPatch(tier: TierRow | null, times: Record<string, number>, row: InputRow, transcript: string, currentStatus: string | null, problems: SheetIssue[], warnings: SheetIssue[], cap: number) {
  const fail = (column: string, message: string) => problems.push({ tab: 'Talks', row: row.row, column, message })
  const data: Record<string, unknown> = {}
  const take = (column: string, key: string, current: number | string | null | undefined) => {
    if (!(column in times) && !(column in row.cells)) return
    const next = column in times ? times[column] : textOf(row, column)
    if (!sameScalar(current == null ? null : (typeof current === 'number' ? numOrNull(current) : current), next as string | number)) data[key] = next
  }
  take('hors_in', 'horsStart', tier?.horsStart)
  take('hors_out', 'horsEnd', tier?.horsEnd)
  take('app_in', 'appetiserStart', tier?.appetiserStart)
  take('app_out', 'appetiserEnd', tier?.appetiserEnd)
  const spans = readSpans(tier, times, row, fail)
  if (spans) {
    const previous = normaliseSpans(tier?.appetiserSpans || [])
    if (JSON.stringify(spans) !== JSON.stringify(previous)) {
      data.appetiserSpans = spans
      const hook = spans.find((span) => span.role === 'hook')
      const turn = spans.find((span) => span.role === 'turn')
      const land = spans.find((span) => span.role === 'land')
      if (hook) data.hookAt = hook.start
      if (turn) data.turnAt = turn.start
      if (land) data.landAt = land.start
      if (!('app_in' in times)) data.appetiserStart = spans[0].start
      if (!('app_out' in times)) data.appetiserEnd = spans[spans.length - 1].end
    }
  }
  const status = textOf(row, 'status').toLowerCase()
  const promoting = (status === 'checked' || status === 'live') && status !== (currentStatus || '')
  for (const [column, key, label] of [['hook_text', 'hook', 'The hook'], ['turn_text', 'turn', 'The turn'], ['land_text', 'land', 'The land'], ['notes', 'note', 'Notes']] as const) {
    if (!present(row, column) && !(promoting && tier && column !== 'notes')) continue
    const next = present(row, column) ? textOf(row, column) : String(tier?.[key as 'hook'] || '')
    const current = tier ? (tier[key as 'hook'] || '') : ''
    const changing = !sameScalar(current || null, next)
    if (column !== 'notes' && (changing || promoting) && next.trim()) for (const message of tierLineProblems(label, next, transcript)) fail(column, message)
    if (present(row, column) && changing) data[key] = next
  }
  if (status && status !== 'delete' && status !== (currentStatus || '')) {
    data.status = status === 'live' || status === 'checked' ? 'checked' : status === 'rejected' ? 'rejected' : 'draft'
  }
  if (!tier && !Object.keys(data).length && !spans) return null
  if (!tier) {
    const ready = ['horsStart', 'horsEnd'].every((key) => key in data) && (Boolean(spans?.length) || ['appetiserStart', 'appetiserEnd'].every((key) => key in data))
    if (!ready) {
      const extra = Object.keys(data).filter((key) => key !== 'note' && key !== 'status')
      if (extra.length || spans) fail('hors_in', spans ? "A new talk's tiers need hors_in and hors_out, plus either app_in and app_out or the hook, turn and land cuts." : "A new talk's tiers need hors_in, hors_out, app_in and app_out together.")
      return null
    }
    data.status = data.status || 'draft'
  }
  const merged = {
    horsStart: Number(data.horsStart ?? tier?.horsStart ?? 0),
    horsEnd: Number(data.horsEnd ?? tier?.horsEnd ?? 0),
    appetiserStart: Number(data.appetiserStart ?? tier?.appetiserStart ?? 0),
    appetiserEnd: Number(data.appetiserEnd ?? tier?.appetiserEnd ?? 0),
    appetiserSpans: (data.appetiserSpans as AppetiserSpan[] | undefined) || tier?.appetiserSpans || undefined,
  }
  const timesChanged = ['horsStart', 'horsEnd', 'appetiserStart', 'appetiserEnd', 'appetiserSpans'].some((key) => key in data)
  if (timesChanged || !tier) {
    const problem = tierProblem(merged, cap)
    if (problem) fail(/hors d'oeuvre/i.test(problem) ? 'hors_out' : 'hook_out' in times ? 'hook_out' : 'app_out', problem)
    else if ('hors_in' in times || 'hors_out' in times || !tier) {
      const warning = horsVerdict(merged.horsEnd - merged.horsStart, cap).warning
      if (warning) warnings.push({ tab: 'Talks', row: row.row, column: 'hors_out', message: warning })
    }
  }
  return Object.keys(data).length ? data : null
}

function keyPatch(working: Working, lesson: LessonRow, talkKey: string, channel: string | null, status: string): SheetOp | null {
  const stored = working.catalogue.keys.find((row) => row.lesson === lesson.id)
  const currentKey = stored?.talkKey || derivedTalkKey(lesson)
  const nextChannel = channel
  const wantLive = status === 'live'
  const liveNow = stored?.sheetStatus === 'live'
  const keyChanges = talkKey !== currentKey
  const channelChanges = nextChannel != null && nextChannel !== (stored?.channel || '')
  const liveChanges = status && wantLive !== liveNow && (wantLive || liveNow)
  if (!keyChanges && !channelChanges && !liveChanges) return null
  if (!stored && !keyChanges && !channelChanges && !wantLive) return null
  if (stored && !keyChanges && !channelChanges && !wantLive && liveNow && status && status !== 'live') {
    if (!(stored.channel || '') && stored.talkKey === derivedTalkKey(lesson)) return { op: 'key.delete', id: stored.id }
  }
  return {
    op: 'key.upsert',
    id: stored?.id,
    lesson: { id: lesson.id },
    talkKey: keyChanges ? talkKey : currentKey,
    channel: nextChannel != null ? nextChannel : stored?.channel || null,
    sheetStatus: wantLive ? 'live' : status && status !== 'live' ? null : stored?.sheetStatus || null,
  }
}

function placeCut(working: Working, lesson: LessonRow | null, temp: { temp: string } | null, course: Ref, clause: number | null, door: number | null, seatText: string, title: string, row: InputRow, problems: SheetIssue[]) {
  if (clause == null && door == null && !seatText) return
  const fail = (column: string, message: string) => problems.push({ tab: 'Talks', row: row.row, column, message })
  const cut = lesson ? carrier(working.catalogue.cuts, lesson.id) : null
  if (clause == null && door != null) {
    // A door alone keeps the clause already held when it sits in that door, or the clause a seat names.
    const doors = working.catalogue.doors || DOORS
    const seatClause = Number(seatText.trim().match(/^(\d+)\./)?.[1] || 0)
    clause = seatClause && doorNumberOfClause(seatClause, doors) === door ? seatClause : clauseForDoor(door, cut?.bestClause ?? null, doors)
  }
  let seatId: number | null = null
  let seatClause: number | null = null
  if (seatText) {
    const match = seatText.trim().match(/^(?:(\d+)\.)?([1-3])$/)
    if (!match) fail('ghunya_seat', 'A Ghunya seat is the clause and the seat, for example 12.2, or just the seat number 1, 2 or 3 when the clause is filled in.')
    else {
      seatClause = match[1] ? Number(match[1]) : clause
      const position = Number(match[2])
      if (!seatClause) fail('ghunya_seat', 'Name the Jibril clause as well, or write the seat as 12.2.')
      else if (clause && seatClause !== clause) fail('ghunya_seat', `That seat is on clause ${seatClause}, not clause ${clause}.`)
      else {
        const seat = working.catalogue.seats.find((item) => item.clause === seatClause && item.position === position)
        if (!seat) fail('ghunya_seat', `No Ghunya seat ${seatClause}.${position} is on the shelf.`)
        else seatId = seat.id
      }
    }
  }
  if (problems.some((issue) => issue.row === row.row && (issue.column === 'ghunya_seat' || issue.column === 'jibril_clause' || issue.column === 'jibril_door'))) return
  if (!cut) {
    if (!temp && !lesson) return
    const lessonRef: Ref = temp || { id: lesson!.id }
    working.ops.push({
      op: 'cut.create', lesson: lessonRef, course,
      data: { status: 'suggested', placeholder: true, presentation: 'video', start: 0, end: 20, timestamp: '0:00', hook: title, turn: title, land: title, kind: 'hors', engine: 'master sheet', ...(clause ? { bestClause: clause, clauseFragment: doorLabelFor(clause) } : {}), ...(seatId ? { seat: seatId } : {}) },
    })
    return
  }
  const patch: Record<string, unknown> = {}
  if (clause && clause !== cut.bestClause) {
    patch.bestClause = clause
    patch.clauseFragment = doorLabelFor(clause)
  }
  if (seatId && seatId !== cut.seatId) patch.seat = seatId
  if (Object.keys(patch).length) working.ops.push({ op: 'cut.update', id: cut.id, patch })
}

function planQuestions(working: Working, rows: InputRow[]) {
  const seen = new Map<string, number>()
  for (const row of rows) {
    const id = textOf(row, 'question_id')
    if (id) seen.set(id, (seen.get(id) || 0) + 1)
  }
  for (const row of rows) {
    const problems: SheetIssue[] = []
    const fail = (column: string, message: string) => problems.push({ tab: 'Questions', row: row.row, column, message })
    const idText = textOf(row, 'question_id')
    if (idText && !/^\d+$/.test(idText)) fail('question_id', 'question_id is the number from an export. Leave it blank to add a new question.')
    if (idText && (seen.get(idText) || 0) > 1) fail('question_id', `question_id ${idText} is used on more than one row. Each question keeps its own id.`)
    const status = textOf(row, 'status').toLowerCase()
    if (present(row, 'status') && status && !['draft', 'approved', 'published', 'rejected', 'delete'].includes(status)) fail('status', 'Status is draft, approved, rejected or delete.')
    const source = textOf(row, 'source').toLowerCase()
    if (present(row, 'source') && !['ai', 'human'].includes(source)) fail('source', 'Source is ai or human.')
    let kind = ''
    if (present(row, 'type')) {
      kind = QUESTION_KINDS[textOf(row, 'type').toLowerCase()] || ''
      if (!kind) fail('type', 'Type is free text, multiple choice, reflection or task.')
    }
    let seconds: number | null = null
    const parsedTime = timeCell(row, 'time')
    if (parsedTime) {
      if (!parsedTime.ok) fail('time', parsedTime.message)
      else seconds = parsedTime.seconds
    }
    const talkKey = textOf(row, 'talk_key')
    let youtubeId = ''
    if (present(row, 'youtube_id')) {
      const parsed = parseYoutubeId(textOf(row, 'youtube_id'))
      if (!parsed.ok) fail('youtube_id', parsed.message)
      else youtubeId = parsed.id
    }
    if (!talkKey && !youtubeId && !idText) fail('talk_key', 'Name the talk with talk_key or youtube_id.')
    const questionId = idText ? Number(idText) : null
    let point = questionId ? working.catalogue.points.find((item) => item.id === questionId) || null : null
    const giveUp = (column: string, message: string) => {
      fail(column, message)
      working.errors.push(...problems)
      working.skipped += 1
    }
    if (questionId && !point) {
      giveUp('question_id', `No question has id ${questionId}. Leave question_id blank to add a new one.`)
      continue
    }
    const found = locate(working, talkKey, youtubeId)
    if (found.error) {
      giveUp(talkKey ? 'talk_key' : 'youtube_id', found.error)
      continue
    }
    const pointLesson = point ? point.lesson : null
    const lesson = found.lesson || (pointLesson ? working.catalogue.lessons.find((item) => item.id === pointLesson) || null : null)
    if (point && lesson && point.lesson !== lesson.id) {
      giveUp('question_id', 'That question belongs to another talk.')
      continue
    }
    if (point && lesson && !lesson.inScope) {
      giveUp('question_id', 'That question is outside this import.')
      continue
    }
    if (!lesson && !found.pending && !point) {
      giveUp(talkKey ? 'talk_key' : 'youtube_id', 'No talk in this import has that key or YouTube id. Add the talk on the Talks tab first.')
      continue
    }
    if (status === 'delete') {
      if (!point) giveUp('question_id', 'Put the question_id of the question to delete.')
      else if (problems.length) {
        working.errors.push(...problems)
        working.skipped += 1
      } else {
        working.ops.push({ op: 'point.delete', id: point.id })
        working.changes.push({ tab: 'Questions', row: row.row, action: 'delete', label: `Question ${point.id}`, detail: 'The pop-up will be removed.' })
      }
      continue
    }
    const pending = found.pending ? working.lessons.get(found.pending)! : null
    const duration = lesson?.durationSeconds ?? pending?.duration ?? null
    const transcript = lesson?.transcript || ''
    if (seconds != null && duration && seconds > duration) fail('time', `That time is ${clock(seconds)}, after the end of the talk (${clock(duration)}).`)
    const prompt = present(row, 'text') ? textOf(row, 'text') : point?.prompt || ''
    if (!point && lesson && seconds != null && prompt.trim()) {
      point = working.catalogue.points
        .filter((item) => item.lesson === lesson.id && round2(item.second) === round2(seconds) && item.prompt.trim() === prompt.trim())
        .sort((a, b) => a.id - b.id)[0] || null
    }
    const choices: string[] = []
    const existingChoices = point?.options || []
    let choicesTouched = false
    for (let index = 0; index < 6; index += 1) {
      const column = `choice_${index + 1}`
      if (present(row, column)) {
        choicesTouched = true
        choices[index] = textOf(row, column)
      } else if (existingChoices[index]) choices[index] = existingChoices[index]
    }
    while (choices.length && !choices[choices.length - 1]) choices.pop()
    let correct = point?.correctOption || ''
    if (present(row, 'correct_choice')) {
      const raw = textOf(row, 'correct_choice')
      if (/^[1-6]$/.test(raw)) {
        const choice = choices[Number(raw) - 1]
        if (!choice) fail('correct_choice', `There is no choice ${raw} on this row.`)
        else correct = choice
      } else if (choices.length && !choices.includes(raw)) fail('correct_choice', 'The correct choice has to be one of the choices, or its number from 1 to 6.')
      else correct = raw
    }
    const creating = !point
    if (creating && !prompt) fail('text', 'A new question needs its text.')
    if (creating && seconds == null) fail('time', 'A new question needs a time.')
    if (creating && !kind) fail('type', 'A new question needs a type: free text, multiple choice, reflection or task.')
    if ((creating || (present(row, 'text') && prompt !== (point?.prompt || ''))) && prompt && prompt.trim().length < 10) fail('text', 'Write the question in at least 10 characters.')
    const storedChoices = [...(point?.options || [])]
    while (storedChoices.length && !storedChoices[storedChoices.length - 1]) storedChoices.pop()
    const promptChanged = creating || (present(row, 'text') && prompt !== (point?.prompt || ''))
    const choicesChanged = Boolean(point) && choicesTouched && JSON.stringify(choices) !== JSON.stringify(storedChoices)
    const correctChanged = Boolean(point) && present(row, 'correct_choice') && correct !== (point?.correctOption || '')
    const publishing = (status === 'approved' || status === 'published') && point?.status !== 'published' && point?.status !== ''
    const textChanged = promptChanged || choicesChanged || correctChanged || creating
    if (textChanged || publishing) {
      for (const message of questionTextProblems(prompt, choices.filter(Boolean), correct)) {
        const choice = message.match(/^Choice (\d+)/)
        const column = choice ? `choice_${choice[1]}` : message.startsWith('The right') ? 'correct_choice' : 'text'
        fail(column, message)
      }
    }
    if (present(row, 'notes')) for (const message of plainProblems([['Notes', textOf(row, 'notes')]])) fail('notes', message)
    let dueDays: number | null = null
    if (present(row, 'due_days')) {
      const raw = textOf(row, 'due_days')
      const days = Number(raw)
      if (!/^\d+$/.test(raw) || !Number.isInteger(days) || days < 1 || days > 366) fail('due_days', 'Due days is a whole number from 1 to 366.')
      else dueDays = days
    }
    let evidence = ''
    if (present(row, 'evidence')) {
      const raw = textOf(row, 'evidence').toLowerCase()
      if (raw !== 'none' && raw !== 'note' && raw !== 'photo') fail('evidence', 'Evidence is none, note or photo.')
      else evidence = raw
    }
    let showImam: boolean | null = null
    if (present(row, 'show_imam')) {
      const raw = textOf(row, 'show_imam').toLowerCase()
      if (!['yes', 'no', 'true', 'false'].includes(raw)) fail('show_imam', 'show_imam is yes or no.')
      else showImam = raw === 'yes' || raw === 'true'
    }
    let place = ''
    if (present(row, 'place')) {
      const raw = textOf(row, 'place').toLowerCase()
      if (raw !== 'popup' && raw !== 'workbook') fail('place', 'Place is popup or workbook.')
      else place = raw
    }
    void transcript
    if (problems.length) {
      working.errors.push(...problems)
      working.skipped += 1
      continue
    }
    const namedStatus = status === 'approved' || status === 'published' ? 'published' : status === 'rejected' ? 'rejected' : status === 'draft' ? 'draft' : null
    const nextStatus = namedStatus || (creating && working.approveQuestions ? 'published' : null)
    const data: Record<string, unknown> = {}
    if (seconds != null && !sameScalar(point ? numOrNull(point.second) : null, seconds)) data.second = seconds
    if (kind && kind !== (point?.kind || '')) data.kind = kind
    if (present(row, 'text') && prompt !== (point?.prompt || '')) data.prompt = prompt
    if (choicesChanged) data.options = choices
    if (present(row, 'correct_choice') && correct !== (point?.correctOption || '')) data.correctOption = correct
    if (dueDays != null && dueDays !== (point?.dueDays ?? null)) data.dueDays = dueDays
    if (evidence && !(evidence === (point?.evidence || '') || (evidence === 'none' && !(point?.evidence || '')))) data.evidence = evidence
    if (showImam != null && showImam !== Boolean(point?.showImam)) data.showImam = showImam
    const storedKind = point?.kind || ''
    const kindNow = kind || storedKind
    const storedFamily = point?.family || ''
    let nextFamily = ''
    if (present(row, 'place') || (kind && kind !== storedKind)) nextFamily = kindNow === 'task' ? 'task' : place === 'workbook' ? 'workbook' : 'popup'
    const familySame = !nextFamily || nextFamily === storedFamily || (nextFamily === 'popup' && storedFamily === '' && kindNow !== 'task') || (nextFamily === 'task' && storedFamily === '' && kindNow === 'task')
    if (nextFamily && !familySame) data.family = nextFamily
    if (nextStatus && nextStatus !== (point ? (point.status || 'published') : '')) data.status = nextStatus
    const storedNote = point?.draftNote || ''
    let note = storedNote
    const notesText = present(row, 'notes') ? textOf(row, 'notes') : null
    const currentSource = point ? questionSource(point) : ''
    const nextSource = source || currentSource || 'human'
    // A standard marker in the notes cell is the source column's label, not a new sentence. Two markers do not fight.
    const realNoteEdit = notesText != null && notesText !== storedNote && !(markerNote(notesText) && markerNote(storedNote))
    if (realNoteEdit && notesText != null) note = notesText
    else if (source && source !== currentSource && markerNote(storedNote)) note = source === 'human' ? HUMAN_SENTENCE : DRAFT_NOTE
    if (nextSource === 'ai' && creating && !present(row, 'notes')) note = DRAFT_NOTE
    if (note !== storedNote && (realNoteEdit || (source && source !== currentSource) || creating)) data.draftNote = note
    const lessonToken = lesson ? `id:${lesson.id}` : `pending:${found.pending || talkKey}`
    const matchKey = seconds == null ? '' : `${lessonToken}|${round2(seconds)}|${prompt.trim()}`
    const signature = JSON.stringify({ second: seconds, kind: kind || point?.kind || '', prompt: prompt.trim(), choices, correct, dueDays, evidence, showImam, place, status: nextStatus, note, source: nextSource })
    if (creating && matchKey && working.pendingQuestions.has(matchKey)) {
      if (working.pendingQuestions.get(matchKey) === signature) {
        working.unchanged += 1
        continue
      }
      fail('text', 'Another row in this sheet already adds this question, with the same talk, time and text, but different details. Keep one row.')
      working.errors.push(...problems)
      working.skipped += 1
      continue
    }
    if (point && working.handledQuestions.has(point.id)) {
      if (!Object.keys(data).length) {
        working.unchanged += 1
        continue
      }
      fail('text', 'This question is already on an earlier row of this sheet. A second row would change it again.')
      working.errors.push(...problems)
      working.skipped += 1
      continue
    }
    if (creating) {
      if (matchKey) working.pendingQuestions.set(matchKey, signature)
      const lessonRef: Ref = found.pending ? { temp: working.lessons.get(found.pending)!.temp } : { id: lesson!.id }
      const family = kind === 'task' ? 'task' : place === 'workbook' ? 'workbook' : 'popup'
      working.ops.push({
        op: 'point.create', lesson: lessonRef,
        data: {
          second: seconds, kind: kind || 'reflection', prompt, options: choices.length ? choices : undefined, correctOption: correct || undefined,
          triggerType: 'timestamp', timing: 'immediate', delayAmount: 0, audience: 'everyone', family,
          status: nextStatus || (nextSource === 'ai' ? 'draft' : 'draft'), draftNote: note || (nextSource === 'ai' ? DRAFT_NOTE : 'Written by a person on the master sheet.'),
          ...(dueDays != null ? { dueDays } : {}),
          ...(evidence || kind === 'task' ? { evidence: evidence || 'none' } : {}),
          ...(showImam != null || kind === 'task' ? { showImam: showImam ?? true } : {}),
        },
      })
      working.changes.push({ tab: 'Questions', row: row.row, action: 'create', label: prompt.slice(0, 80), detail: nextStatus === 'published' ? 'New question, approved for learners.' : 'New question, kept as a draft until it is approved.' })
      continue
    }
    if (point) working.handledQuestions.add(point.id)
    if (!Object.keys(data).length) {
      working.unchanged += 1
      continue
    }
    working.ops.push({ op: 'point.update', id: point!.id, patch: data })
    const published = data.status === 'published'
    working.changes.push({ tab: 'Questions', row: row.row, action: 'update', label: `Question ${point!.id}`, detail: published ? 'Approved. Learners will meet it in the main.' : 'The question will be updated.' })
  }
}

function planResources(working: Working, rows: InputRow[]) {
  for (const row of rows) {
    const problems: SheetIssue[] = []
    const fail = (column: string, message: string) => problems.push({ tab: 'Resources', row: row.row, column, message })
    const talkKey = textOf(row, 'talk_key')
    if (!talkKey) fail('talk_key', 'Name the talk with its talk_key.')
    const status = textOf(row, 'status').toLowerCase()
    if (present(row, 'status') && status !== 'delete') fail('status', 'Leave status blank to keep the resource, or put delete to remove it.')
    if (present(row, 'label')) for (const message of plainProblems([['Label', textOf(row, 'label')]])) fail('label', message)
    const WORD_KINDS = new Set(['summary', 'quote', 'reading', 'guide'])
    let url = ''
    if (present(row, 'url')) {
      url = textOf(row, 'url')
      if (url && !httpsHref(url)) fail('url', 'Resource links have to be full https:// addresses.')
    }
    let mediaId: number | null = null
    if (present(row, 'media_id')) {
      const raw = textOf(row, 'media_id')
      if (!/^\d+$/.test(raw) || Number(raw) < 1) fail('media_id', 'media_id is the number of an uploaded file.')
      else mediaId = Number(raw)
    }
    let kind = ''
    if (present(row, 'kind')) {
      const raw = textOf(row, 'kind').toLowerCase()
      kind = raw === 'file' || raw === 'document' || raw === 'pdf' ? 'file' : raw === 'link' || raw === 'url' ? 'link' : raw === 'transcript' || raw === 'captions' ? 'transcript' : WORD_KINDS.has(raw) ? raw : ''
      if (!kind) fail('kind', 'Kind is link, file, summary, quote, reading, guide or transcript.')
    }
    const body = present(row, 'body') ? textOf(row, 'body') : ''
    if (present(row, 'body') && kind) for (const message of resourceBodyProblems(kind, body)) fail('body', message)
    const content = WORD_KINDS.has(kind)
    if (problems.length) {
      working.errors.push(...problems)
      working.skipped += 1
      continue
    }
    const found = locate(working, talkKey, '')
    if (found.error || (!found.lesson && !found.pending)) {
      skip(working, 'Resources', row.row, 'talk_key', found.error || 'No talk in this import has that key.')
      working.skipped += 1
      continue
    }
    const lesson = found.lesson
    const label = textOf(row, 'label')
    const own = lesson ? working.catalogue.resources.filter((resource) => resource.lesson === lesson.id && resource.name.trim() === label) : []
    if (status === 'delete') {
      if (!label || !own.length) {
        skip(working, 'Resources', row.row, 'label', 'Name the resource to delete with its label.')
        working.skipped += 1
        continue
      }
      if (own.length > 1) {
        skip(working, 'Resources', row.row, 'label', 'Two resources on this talk share that name. Rename one in the editor first.')
        working.skipped += 1
        continue
      }
      working.ops.push({ op: 'resource.delete', id: own[0].id })
      working.changes.push({ tab: 'Resources', row: row.row, action: 'delete', label, detail: 'The resource will be removed.' })
      continue
    }
    const needsWords = content
    const resourceData = { name: label, url: url || undefined, kind: kind || 'link', ...(body ? { body } : {}), ...(mediaId ? { file: mediaId } : {}) }
    const missing = !label
      ? { column: 'label', message: 'Name the resource with its label.' }
      : kind === 'transcript' && !mediaId
        ? { column: 'media_id', message: 'A transcript resource needs the media_id of an uploaded text file, so a long transcript does not have to fit in a cell.' }
        : needsWords && !body
          ? { column: 'body', message: 'A summary, quote, reading or guide needs its words in the body column.' }
          : !needsWords && kind !== 'transcript' && !url && !mediaId
            ? { column: 'url', message: 'A new resource needs an https link, or a media_id when the file is already uploaded.' }
            : null
    if (!lesson && found.pending) {
      if (missing) {
        skip(working, 'Resources', row.row, missing.column, missing.message)
        working.skipped += 1
        continue
      }
      working.ops.push({ op: 'resource.create', lesson: { temp: working.lessons.get(found.pending)!.temp }, data: resourceData })
      working.changes.push({ tab: 'Resources', row: row.row, action: 'create', label, detail: 'New resource on the new talk.' })
      continue
    }
    if (!own.length) {
      if (missing) {
        skip(working, 'Resources', row.row, missing.column, missing.message)
        working.skipped += 1
        continue
      }
      working.ops.push({ op: 'resource.create', lesson: { id: lesson!.id }, data: resourceData })
      working.changes.push({ tab: 'Resources', row: row.row, action: 'create', label, detail: 'New resource.' })
      continue
    }
    const resource = own.length === 1 ? own[0] : own.find((item) => item.url === url) || null
    if (!resource) {
      skip(working, 'Resources', row.row, 'label', 'Two resources on this talk share that name. Rename one in the editor first.')
      working.skipped += 1
      continue
    }
    if (present(row, 'body') && !kind) for (const message of resourceBodyProblems(resource.kind || 'link', body)) fail('body', message)
    if (problems.length) {
      working.errors.push(...problems)
      working.skipped += 1
      continue
    }
    const patch: Record<string, unknown> = {}
    if (url && url !== (resource.url || '')) patch.url = url
    if (kind && kind !== (resource.kind || 'link')) patch.kind = kind
    if (present(row, 'body') && body !== (resource.body || '')) patch.body = body
    if (mediaId && mediaId !== (resource.mediaId || 0)) patch.file = mediaId
    if (!Object.keys(patch).length) working.unchanged += 1
    else {
      working.ops.push({ op: 'resource.update', id: resource.id, patch })
      working.changes.push({ tab: 'Resources', row: row.row, action: 'update', label, detail: 'The resource will be updated.' })
    }
  }
}

const foldBody = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()

// Circle answers sit under a question as examples and are never counted: no answer, completion or task is made here.
function planCircle(working: Working, rows: InputRow[]) {
  const catalogue = working.catalogue
  const answers = catalogue.circle || []
  const goingPoints = new Set(working.ops.flatMap((op) => (op.op === 'point.delete' ? [op.id] : [])))
  const goingLessons = new Set(working.ops.flatMap((op) => (op.op === 'lesson.delete' ? [op.id] : [])))
  const seenIds = new Set<number>()
  const seenNew = new Set<string>()
  for (const row of rows) {
    const cells: Partial<Record<CircleColumn, string>> = {}
    for (const column of CIRCLE_COLUMNS) if (present(row, column)) cells[column] = textOf(row, column)
    const read = readCircleRow(cells)
    const problems: SheetIssue[] = read.ok ? [] : read.issues.map((issue) => ({ tab: CIRCLE_TAB, row: row.row, column: issue.column, message: issue.message }))
    const fail = (column: string, message: string) => problems.push({ tab: CIRCLE_TAB, row: row.row, column, message })
    const giveUp = () => {
      working.errors.push(...problems)
      working.skipped += 1
    }
    if (!read.ok) {
      giveUp()
      continue
    }
    const value = read.value
    const point = catalogue.points.find((item) => item.id === value.questionId) || null
    const lesson = point ? catalogue.lessons.find((item) => item.id === point.lesson) || null : null
    if (!point || !lesson || !lesson.inScope) {
      fail('question_id', `No question in this import has id ${value.questionId}. Import new questions first, then add their circle answers with the question_id from a fresh export.`)
      giveUp()
      continue
    }
    const talkKey = textOf(row, 'talk_key')
    const youtubeText = textOf(row, 'youtube_id')
    const talk = talkOf(lesson.id, catalogue)
    const knownKey = talkKey && (talkKey === talk.talkKey || talkKey === derivedTalkKey(lesson))
    if ((talkKey && !knownKey) || (youtubeText && youtubeText !== lesson.youtubeId && youtubeIdFromUrl(youtubeText) !== lesson.youtubeId)) {
      fail(talkKey && !knownKey ? 'talk_key' : 'youtube_id', `Question ${point.id} belongs to ${talk.talkKey}, not to this talk.`)
    }
    if (goingPoints.has(point.id) || goingLessons.has(lesson.id)) fail('question_id', 'This sheet also deletes that question, so it can have no circle answers.')
    else if (point.family === 'workbook') fail('question_id', `Question ${point.id} is a workbook reflection. Nobody sees “What others said” in the workbook, so a circle answer there would never be shown.`)
    else if (point.status === 'rejected') fail('question_id', `Question ${point.id} is rejected, so learners never meet it.`)
    const existing = value.circleId ? answers.find((answer) => answer.id === value.circleId) || null : null
    if (value.circleId && !existing) fail('circle_id', `No circle answer here has id ${value.circleId}. Leave circle_id blank to add an answer.`)
    if (existing && existing.point !== point.id) fail('question_id', `Circle answer ${existing.id} is under question ${existing.point}. Move it in the circle desk instead.`)
    if (value.circleId && seenIds.has(value.circleId)) fail('circle_id', 'This circle answer is already on an earlier row of this sheet.')
    if (problems.length) {
      giveUp()
      continue
    }
    const label = `${value.name}: ${value.body}`.slice(0, 80)
    if (value.remove) {
      seenIds.add(existing!.id)
      working.ops.push({ op: 'circle.delete', id: existing!.id })
      working.changes.push({ tab: CIRCLE_TAB, row: row.row, action: 'delete', label, detail: `The circle answer under question ${point.id} will be removed.` })
      continue
    }
    if (!existing) {
      const signature = `${point.id}:${foldBody(value.body)}`
      if (seenNew.has(signature) || answers.some((answer) => answer.point === point.id && foldBody(answer.body) === foldBody(value.body))) {
        working.unchanged += 1
        continue
      }
      seenNew.add(signature)
      working.ops.push({
        op: 'circle.create', point: point.id, lesson: lesson.id,
        data: { name: value.name, body: value.body, tone: value.tone || undefined, length: value.length || undefined, origin: value.origin, enabled: value.enabled, portal: catalogue.circlePortal || undefined },
      })
      working.changes.push({ tab: CIRCLE_TAB, row: row.row, action: 'create', label, detail: `New circle answer under question ${point.id}${value.enabled ? '' : ', switched off'}. It is never counted as an answer.` })
      continue
    }
    seenIds.add(existing.id)
    const patch: Record<string, unknown> = {}
    if (present(row, 'name') && value.name !== existing.name) patch.name = value.name
    if (value.body !== existing.body) patch.body = value.body
    if (present(row, 'tone') && (value.tone || '') !== (existing.tone || '')) patch.tone = value.tone
    if (present(row, 'length') && (value.length || '') !== (existing.length || '')) patch.length = value.length
    if (present(row, 'origin') && value.origin !== (existing.origin === 'ai' ? 'ai' : 'staff')) patch.origin = value.origin
    if (present(row, 'enabled') && value.enabled !== existing.enabled) patch.enabled = value.enabled
    if (!Object.keys(patch).length) {
      working.unchanged += 1
      continue
    }
    working.ops.push({ op: 'circle.update', id: existing.id, patch })
    const switched = 'enabled' in patch ? (patch.enabled ? ' Switched on.' : ' Switched off.') : ''
    working.changes.push({ tab: CIRCLE_TAB, row: row.row, action: 'update', label: `Circle answer ${existing.id}`, detail: `The circle answer will be updated.${switched}` })
  }
}

function parseWordsCell(raw: string): { at: number; text: string }[] | null {
  if (!raw.trim()) return null
  try {
    const value = JSON.parse(raw)
    if (!Array.isArray(value)) return null
    return value.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const at = Number((row as { at?: unknown }).at)
      const text = String((row as { text?: unknown }).text || '').trim()
      return Number.isFinite(at) && text ? [{ at, text }] : []
    })
  } catch {
    return null
  }
}

function planExtracts(working: Working, rows: InputRow[]) {
  const planned: TalkExtract[] = (working.catalogue.extracts || []).map((row) => ({ ...row }))
  const byLesson = new Map<number | string, TalkExtract[]>()
  const addPlanned = (key: number | string, row: TalkExtract) => {
    const list = byLesson.get(key) || []
    list.push(row)
    byLesson.set(key, list)
  }
  for (const row of planned) addPlanned(row.lesson, row)
  for (const tier of working.catalogue.tiers || []) {
    for (const copy of extractsFromTier(tier, tier.lesson)) addPlanned(tier.lesson, copy)
  }
  const tempKey = new Map<string, string>()
  for (const [talkKey, pending] of working.lessons) tempKey.set(pending.temp, talkKey)
  for (const op of working.ops) {
    if (op.op !== 'tier.create') continue
    const key = 'id' in op.lesson ? op.lesson.id : tempKey.get(op.lesson.temp) || op.lesson.temp
    for (const copy of extractsFromTier(op.data as Parameters<typeof extractsFromTier>[0], typeof key === 'number' ? key : 0)) addPlanned(key, copy)
  }

  for (const row of rows) {
    const problems: SheetIssue[] = []
    const fail = (column: string, message: string) => problems.push({ tab: EXTRACT_TAB, row: row.row, column, message })
    const talkKey = textOf(row, 'talk_key')
    let youtubeId = ''
    if (present(row, 'youtube_id')) {
      const parsed = parseYoutubeId(textOf(row, 'youtube_id'))
      if (!parsed.ok) fail('youtube_id', parsed.message)
      else youtubeId = parsed.id
    }
    if (!talkKey && !youtubeId) fail('talk_key', 'Name the talk with talk_key or youtube_id.')
    const kind = extractKindFromSheet(textOf(row, 'extract_type'))
    if (!kind) fail('extract_type', "extract_type is hors or appetiser.")
    const startCell = timeCell(row, 'start')
    const endCell = timeCell(row, 'end')
    if (!startCell) fail('start', 'Every extract needs a start time.')
    else if (!startCell.ok) fail('start', startCell.message)
    if (!endCell) fail('end', 'Every extract needs an end time.')
    else if (!endCell.ok) fail('end', endCell.message)
    const start = startCell?.ok ? startCell.seconds : NaN
    const end = endCell?.ok ? endCell.seconds : NaN
    const statusRaw = textOf(row, 'status').toLowerCase()
    if (statusRaw === 'delete') {
      const found = locate(working, talkKey, youtubeId)
      if (found.error) fail('talk_key', found.error)
      const lesson = found.lesson
      const extractId = Number(textOf(row, 'extract_id'))
      const existing = lesson
        ? (working.catalogue.extracts || []).find((item) => item.lesson === lesson.id && (extractId ? item.id === extractId : kind && item.kind === kind && Math.abs(item.start - start) < 0.6))
        : null
      if (problems.length) {
        working.errors.push(...problems)
        working.skipped += 1
        continue
      }
      if (!existing) {
        working.skipped += 1
        continue
      }
      working.ops.push({ op: 'extract.delete', id: existing.id })
      working.changes.push({ tab: EXTRACT_TAB, row: row.row, action: 'delete', label: `${kind} ${existing.id}`, detail: 'This extract will be removed.' })
      continue
    }
    const found = locate(working, talkKey, youtubeId)
    if (found.error) fail('talk_key', found.error)
    const lesson = found.lesson
    const pending = found.pending
    const duration = lesson?.durationSeconds ?? (pending ? working.lessons.get(pending)?.duration ?? null : null)
    const transcript = lesson?.transcript || (pending ? working.lessons.get(pending)?.transcript || '' : '')
    if (Number.isFinite(start) && Number.isFinite(end)) {
      const late = timeInTalkProblem({ start, end }, duration)
      if (late) fail(end > (duration || Infinity) ? 'end' : 'start', late)
    }
    const quote = textOf(row, 'text')
    const status = extractStatusFromSheet(statusRaw) || 'suggested'
    if (quote && transcript) {
      const verbatim = verbatimProblem(quote, transcript)
      if (verbatim) {
        if (status === 'approved') fail('text', verbatim)
        else working.warnings.push({ tab: EXTRACT_TAB, row: row.row, column: 'text', message: verbatim })
      }
    }
    const scoreRaw = textOf(row, 'score')
    const score = scoreRaw && Number.isFinite(Number(scoreRaw)) ? Number(scoreRaw) : null
    const orderRaw = textOf(row, 'order')
    const order = orderRaw && Number.isFinite(Number(orderRaw)) ? Number(orderRaw) : planned.filter((item) => item.lesson === (lesson?.id || pending)).length + 1
    const doorRaw = textOf(row, 'door')
    const door = doorRaw ? Number(doorRaw.replace(/^w/i, '')) : null
    if (doorRaw && (!Number.isFinite(door) || (door as number) < 1 || (door as number) > 20)) fail('door', 'door is 1 to 20, or W1 to W20.')
    const arcRaw = textOf(row, 'arc').toLowerCase()
    const arc = arcRaw === 'hook' || arcRaw === 'turn' || arcRaw === 'land' ? arcRaw : null
    const words = present(row, 'words') ? parseWordsCell(textOf(row, 'words')) : null
    if (present(row, 'words') && words == null) fail('words', 'words is a JSON list of { at, text }.')
    const extractId = Number(textOf(row, 'extract_id'))
    const existing = lesson
      ? (working.catalogue.extracts || []).find((item) => (extractId ? item.id === extractId : kind ? item.lesson === lesson.id && item.kind === kind && Math.abs(item.start - start) < 0.6 : false))
      : null
    const implied = !existing && Number.isFinite(start) && kind
      ? (byLesson.get(lesson?.id || pending || talkKey) || []).find((item) => sameExtractWindow(item, { kind, start, end }))
      : null
    const parentStart = timeCell(row, 'parent_start')
    const namedParent = parentStart?.ok
      ? (byLesson.get(lesson?.id || pending || '') || []).find((item) => item.kind === 'appetiser' && Math.abs(item.start - parentStart.seconds) < 0.6)
      : null
    const draft: TalkExtract = {
      id: existing?.id,
      lesson: lesson?.id || 0,
      kind: kind || 'hors',
      start,
      end,
      quote,
      words,
      score,
      status,
      door: Number.isFinite(door as number) ? door : null,
      seat: null,
      order,
      parent: namedParent?.id ?? existing?.parent ?? null,
      arc,
      hook: textOf(row, 'hook_text') || existing?.hook || '',
      turn: textOf(row, 'turn_text') || existing?.turn || '',
      land: textOf(row, 'land_text') || existing?.land || '',
    }
    const siblings = [
      ...(byLesson.get(lesson?.id || pending || '') || []).filter((item) => item.id == null || draft.id == null || item.id !== draft.id),
      draft,
    ]
    const overlap = sameTypeOverlapProblem(siblings)
    if (overlap) working.warnings.push({ tab: EXTRACT_TAB, row: row.row, column: 'start', message: overlap })
    if (problems.length) {
      working.errors.push(...problems)
      working.skipped += 1
      continue
    }
    addPlanned(lesson?.id || pending || talkKey, draft)
    const data: Record<string, unknown> = {
      kind: draft.kind,
      start: draft.start,
      end: draft.end,
      quote: draft.quote,
      status: draft.status,
      order: draft.order,
    }
    if (draft.score != null) data.score = draft.score
    if (draft.door != null) data.door = draft.door
    if (draft.arc) data.arc = draft.arc
    if (draft.words) data.words = draft.words
    if (draft.hook) data.hook = draft.hook
    if (draft.turn) data.turn = draft.turn
    if (draft.land) data.land = draft.land
    if (draft.parent) data.parent = draft.parent
    data.source = 'master sheet'
    const lessonRef: Ref = lesson ? { id: lesson.id } : { temp: pending || talkKey }
    if (implied && !existing) {
      working.unchanged += 1
      continue
    }
    if (!existing) {
      working.ops.push({ op: 'extract.create', lesson: lessonRef, data })
      working.changes.push({ tab: EXTRACT_TAB, row: row.row, action: 'create', label: `${draft.kind} ${clockish(start)}`, detail: `A new ${draft.kind === 'hors' ? "hors d'oeuvre" : 'appetiser'} will be added.` })
    } else {
      const patch: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(data)) {
        const current = existing[key as keyof ExtractRow]
        if (JSON.stringify(current ?? null) !== JSON.stringify(value ?? null)) patch[key] = value
      }
      if (!Object.keys(patch).length) {
        working.unchanged += 1
        continue
      }
      working.ops.push({ op: 'extract.update', id: existing.id, patch })
      working.changes.push({ tab: EXTRACT_TAB, row: row.row, action: 'update', label: `${draft.kind} ${existing.id}`, detail: 'This extract will be updated.' })
    }
  }
}

function clockish(total: number) {
  const seconds = Math.max(0, Math.round(total))
  const minutes = Math.floor(seconds / 3600) ? Math.floor(seconds / 60) : Math.floor(seconds / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return `${minutes}:${rest}`
}

/** Dry-run. Nothing is written. Rows with errors are skipped and listed; the rest are creates, updates, deletes or unchanged. */
export function planSheet(parsed: { talks: InputRow[]; questions: InputRow[]; resources: InputRow[]; extracts?: InputRow[]; circle?: InputRow[]; speakers?: InputRow[]; errors?: SheetIssue[] }, catalogue: SheetCatalogue, options?: { approveQuestions?: boolean }): SheetPlan {
  const working = indexCatalogue(catalogue)
  working.approveQuestions = Boolean(options?.approveQuestions)
  working.errors.push(...(parsed.errors || []))
  planSpeakers(working, parsed.speakers || [])
  planTalks(working, parsed.talks)
  planExtracts(working, parsed.extracts || [])
  planQuestions(working, parsed.questions)
  planResources(working, parsed.resources)
  planCircle(working, parsed.circle || [])
  return { errors: working.errors, warnings: working.warnings, changes: working.changes, unchanged: working.unchanged, skipped: working.skipped, ops: working.ops }
}

export type { InputRow }
