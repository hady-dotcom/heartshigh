import { CIRCLE_LENGTHS, CIRCLE_TONES, circleProblems, type CircleLength, type CircleTone } from './circle'

// The CircleAnswers tab of the master sheet, kept as a pure module so it can be registered beside the Talks,
// Questions and Resources tabs without either side reshaping the other.

export const CIRCLE_TAB = 'CircleAnswers'

export const CIRCLE_COLUMNS = ['talk_key', 'youtube_id', 'question_id', 'circle_id', 'name', 'body', 'tone', 'length', 'origin', 'enabled', 'status'] as const
export type CircleColumn = (typeof CIRCLE_COLUMNS)[number]

export const CIRCLE_NOTE =
  'HEARTS circle answers. One row is one answer shown under a question in “What others said” until real answers arrive. question_id is the number from the Questions tab. Leave circle_id blank to add an answer, or fill it in to change that answer. tone is warm, honest, practical, searching or quiet. length is short, medium or long. origin is ai or staff. enabled is yes or no. Put delete in status to remove the answer. Circle answers are never counted as answers.'

export type CircleSheetRow = {
  circleId: number | null
  questionId: number
  name: string
  body: string
  tone: CircleTone | null
  length: CircleLength | null
  origin: 'ai' | 'staff'
  enabled: boolean
  remove: boolean
}

const cell = (row: Partial<Record<CircleColumn, unknown>>, column: CircleColumn) => String(row[column] ?? '').trim()

/** One CircleAnswers row checked and read, or the problems with it by column. */
export function readCircleRow(row: Partial<Record<CircleColumn, unknown>>): { ok: true; value: CircleSheetRow } | { ok: false; issues: { column: CircleColumn; message: string }[] } {
  const issues: { column: CircleColumn; message: string }[] = []
  const questionText = cell(row, 'question_id')
  const circleText = cell(row, 'circle_id')
  const status = cell(row, 'status').toLowerCase()
  const remove = status === 'delete'
  if (status && !remove) issues.push({ column: 'status', message: 'Leave status blank, or put delete to remove the answer.' })
  if (!/^\d+$/.test(questionText)) issues.push({ column: 'question_id', message: 'question_id is the number of the question on the Questions tab.' })
  if (circleText && !/^\d+$/.test(circleText)) issues.push({ column: 'circle_id', message: 'circle_id is the number from an export. Leave it blank to add an answer.' })
  if (remove && !circleText) issues.push({ column: 'circle_id', message: 'Name the answer to delete with its circle_id.' })
  const tone = cell(row, 'tone').toLowerCase()
  if (tone && !(CIRCLE_TONES as readonly string[]).includes(tone)) issues.push({ column: 'tone', message: `Tone is ${CIRCLE_TONES.join(', ')}.` })
  const length = cell(row, 'length').toLowerCase()
  if (length && !(CIRCLE_LENGTHS as readonly string[]).includes(length)) issues.push({ column: 'length', message: `Length is ${CIRCLE_LENGTHS.join(', ')}.` })
  const origin = cell(row, 'origin').toLowerCase() || 'staff'
  if (!['ai', 'staff'].includes(origin)) issues.push({ column: 'origin', message: 'Origin is ai or staff.' })
  const enabledText = cell(row, 'enabled').toLowerCase() || 'yes'
  if (!['yes', 'no'].includes(enabledText)) issues.push({ column: 'enabled', message: 'enabled is yes or no.' })
  const name = cell(row, 'name')
  const body = cell(row, 'body')
  if (!remove) {
    for (const message of circleProblems(name || 'Someone in the circle', body)) issues.push({ column: /name/i.test(message) && !/answer/i.test(message) ? 'name' : 'body', message })
  }
  if (issues.length) return { ok: false, issues }
  return {
    ok: true,
    value: {
      circleId: circleText ? Number(circleText) : null,
      questionId: Number(questionText),
      name: name || 'Someone in the circle',
      body,
      tone: (tone || null) as CircleTone | null,
      length: (length || null) as CircleLength | null,
      origin: origin as 'ai' | 'staff',
      enabled: enabledText === 'yes',
      remove,
    },
  }
}

/** The export row for one circle answer. */
export function circleSheetValues(
  answer: { id: number; point: number; name?: string | null; body?: string | null; tone?: string | null; length?: string | null; origin?: string | null; enabled?: boolean | null },
  talk: { talkKey?: string | null; youtubeId?: string | null },
): Record<CircleColumn, string | number | null> {
  return {
    talk_key: talk.talkKey || null,
    youtube_id: talk.youtubeId || null,
    question_id: answer.point,
    circle_id: answer.id,
    name: answer.name || null,
    body: answer.body || null,
    tone: answer.tone || null,
    length: answer.length || null,
    origin: answer.origin === 'ai' ? 'ai' : 'staff',
    enabled: answer.enabled === false ? 'no' : 'yes',
    status: null,
  }
}
