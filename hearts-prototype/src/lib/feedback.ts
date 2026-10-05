/**
 * Feedback for teachers: what may leave the portal, how names are hidden, and how a question
 * reads to a sheikh. Nothing here talks to the database.
 */
import ExcelJS from 'exceljs'
import type { Env } from './env'
import { isProduction } from './env'
import { FontUse, fontObjects, notoSans } from './pdf-font'

export type Family = 'popup' | 'reflection' | 'task' | 'circle' | 'live'

export const FAMILY_LABEL: Record<Family, string> = {
  popup: 'Pop-up',
  reflection: 'Reflection',
  task: 'Activation task',
  circle: 'Circle comment',
  live: 'Live question',
}

export const EXPORT_COLUMNS = ['door', 'seat', 'course', 'talk', 'question', 'family', 'answer', 'date', 'learner', 'teacher reply'] as const

export type FeedbackFilters = {
  door: number | null
  seatId: number | null
  courseId: number | null
  talkId: number | null
  questionId: number | null
  family: Family | ''
  learnerId: number | null
  from: string | null
  to: string | null
  accessCodeId: number | null
}

export const EMPTY_FILTERS: FeedbackFilters = {
  door: null,
  seatId: null,
  courseId: null,
  talkId: null,
  questionId: null,
  family: '',
  learnerId: null,
  from: null,
  to: null,
  accessCodeId: null,
}

export type RawFeedback = {
  id: string
  portalId: number
  keepPrivate: boolean
  shareWithTeacher: boolean
  showImam: boolean
  text: string
  date: string
  learnerId: number
  learnerName: string
  learnerEmail: string
  accessCodeId: number | null
  doorNumber: number | null
  door: string
  seatId: number | null
  seat: string
  courseId: number | null
  course: string
  talkId: number | null
  talk: string
  questionId: number | null
  question: string
  family: Family
  reply: string
}

export type ShownAnswer = {
  id: string
  doorNumber: number | null
  door: string
  seat: string
  courseId: number | null
  course: string
  talkId: number | null
  talk: string
  questionId: number | null
  question: string
  family: Family
  familyLabel: string
  text: string
  date: string
  dateLabel: string
  learnerId: number
  learner: string
  reply: string
}

export type QuestionGroup = {
  key: string
  questionId: number | null
  question: string
  family: Family
  familyLabel: string
  answers: ShownAnswer[]
  privateCount: number
}

export type TalkGroup = {
  key: string
  talkId: number | null
  talk: string
  courseId: number | null
  course: string
  questions: QuestionGroup[]
}

export type DoorGroup = {
  key: string
  doorNumber: number | null
  door: string
  talks: TalkGroup[]
  shared: number
  privateCount: number
}

export type LearnerGroup = {
  learnerId: number
  learner: string
  answers: ShownAnswer[]
}

export type CountRow = { key: string; label: string; shared: number; privateCount: number }

export type BuiltFeedback = {
  portalId: number
  anonymised: boolean
  privateCount: number
  sharedCount: number
  rows: ShownAnswer[]
  doors: DoorGroup[]
  learners: LearnerGroup[]
  doorCounts: CountRow[]
  questionCounts: CountRow[]
}

const YES_NO = /^(do|does|did|is|are|was|were|have|has|had|can|could|will|would|am)\b/i
const GENERIC = /\b(what do you think|any thoughts|how did (this|that|it) make you feel|did you (like|enjoy)|what did you learn|do you agree|any comments)\b/i
const PERSONAL = /\b(this week|your own|one moment|ordinary|name one|when did you|where did you|what did you do|a time when|you|your|yours)\b/i
const YES_NO_OPTION = /^(yes|no|maybe|agree|disagree|true|false)$/i

export type QuestionAssessment = { weak: boolean; reasons: string[]; rewrite: string }

/** A question is weak when a sheikh would only learn yes, no, or nothing particular. */
export function assessQuestion(input: { prompt: string; talk?: string; options?: string[] }): QuestionAssessment {
  const prompt = input.prompt.replace(/\s+/g, ' ').trim()
  const options = (input.options || []).map((option) => option.trim()).filter(Boolean)
  const reasons: string[] = []
  const yesNoOptions = options.length > 0 && options.every((option) => YES_NO_OPTION.test(option))
  if (YES_NO.test(prompt) || yesNoOptions) reasons.push('It can be answered yes or no, so a sheikh learns little about the person.')
  const words = prompt.split(' ').filter(Boolean).length
  if (GENERIC.test(prompt) || words < 6) reasons.push('It is generic, and the same question could sit under any talk.')
  if (!PERSONAL.test(prompt)) reasons.push('It does not ask for a specific, personal moment tied to this talk.')
  const weak = reasons.length > 0 && (YES_NO.test(prompt) || yesNoOptions || GENERIC.test(prompt) || words < 8 || !PERSONAL.test(prompt))
  return { weak, reasons: weak ? reasons : [], rewrite: weak ? suggestRewrite(input.talk || '') : '' }
}

export function suggestRewrite(talk: string) {
  const name = talk.replace(/\s+/g, ' ').trim() || 'this talk'
  return `What from ${name} stayed with you on the way home, or while you were at work?`
}

/** Rewrites stay drafts. Nothing here is a published question. */
export function asDraft<T extends { status?: string | null }>(row: T): T & { status: 'draft' } {
  return { ...row, status: 'draft' }
}

export function familyOfPoint(point: { kind?: string | null; family?: string | null }): Family {
  const family = point.family || ''
  const kind = point.kind || ''
  if (family === 'task' || kind === 'task') return 'task'
  if (family === 'workbook' || kind === 'reflection') return 'reflection'
  return 'popup'
}

/**
 * The learner's sharing choice. Private answers, and answers they did not offer to a teacher,
 * stay out. An activation task marked for the imam counts as shared unless they kept it private.
 */
export function sharingDecision(row: Pick<RawFeedback, 'keepPrivate' | 'shareWithTeacher' | 'showImam'>): 'share' | 'private' {
  if (row.keepPrivate) return 'private'
  if (row.shareWithTeacher || row.showImam) return 'share'
  return 'private'
}

export function canReadFeedback(role: string | null | undefined) {
  return role === 'teacher' || role === 'portal-admin' || role === 'master'
}

const FORMAT_NAMES: Record<string, string> = { csv: 'CSV', pdf: 'PDF', xlsx: 'Excel' }

/** "CSV, anonymised", "Excel, named": how the export log names a download. */
export function exportKindLabel(format: string | null | undefined, named: boolean | null | undefined) {
  const kind = named ? 'named' : 'anonymised'
  const name = FORMAT_NAMES[String(format || '').toLowerCase()] || String(format || '').toUpperCase()
  return name ? `${name}, ${kind}` : kind.charAt(0).toUpperCase() + kind.slice(1)
}

/** Named exports need a teacher or admin on this portal. Learners never qualify. */
export function canNameExport(role: string | null | undefined) {
  return role === 'teacher' || role === 'portal-admin' || role === 'master'
}

/** Learner A, Learner B, … then Learner Z, Learner AA. The index is the sorted place, not the database id. */
export function learnerPseudonym(index: number) {
  let n = index
  let letters = ''
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return `Learner ${letters}`
}

export function assignPseudonyms(learnerIds: number[]) {
  const sorted = [...new Set(learnerIds)].filter((id) => Number.isInteger(id)).sort((a, b) => a - b)
  return new Map(sorted.map((id, index) => [id, learnerPseudonym(index)]))
}

export function parseFilters(query: Record<string, string | undefined>): FeedbackFilters {
  const family = query.family
  return {
    door: doorNumber(query.door),
    seatId: positive(query.seat),
    courseId: positive(query.course),
    talkId: positive(query.talk),
    questionId: positive(query.question),
    family: family === 'popup' || family === 'reflection' || family === 'task' || family === 'circle' || family === 'live' ? family : '',
    learnerId: positive(query.learner),
    from: parseDay(query.from),
    to: parseDay(query.to),
    accessCodeId: positive(query.cohort),
  }
}

/** First visit anonymises. After the filter form is used, the checkbox decides. A named export must say so. */
export function anonymiseFromQuery(query: Record<string, string | undefined>) {
  if (query.named === '1') return false
  if (query.filters === '1') return query.anonymise === '1'
  return true
}

function positive(value: string | undefined) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

/** Accepts a British day (dd/mm/yyyy) or an ISO day, and returns YYYY-MM-DD. */
export function parseDay(value: string | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return validDate(iso[1], iso[2], iso[3])
  const british = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
  if (british) return validDate(british[3], british[2].padStart(2, '0'), british[1].padStart(2, '0'))
  return null
}

function validDate(year: string, month: string, day: string) {
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  if (!Number.isInteger(y) || m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return `${year}-${month}-${day}`
}

/** The value shown in the filter boxes: 03/10/2026. */
export function formatBritishDay(iso: string | null | undefined) {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

export function displayDay(value: string | undefined) {
  return formatBritishDay(parseDay(value))
}

export function countPhrase(shared: number, privateCount: number) {
  return `${shared} shared, ${privateCount} kept private`
}

function doorNumber(value: string | undefined) {
  const match = String(value || '').trim().match(/^(?:w|door\s*)?(\d{1,2})$/i)
  if (!match) return null
  const number = Number(match[1])
  return number >= 1 && number <= 20 ? number : null
}

function doorKeyOf(row: { family: Family; doorNumber: number | null }) {
  if (row.family === 'circle') return 'circle'
  if (row.family === 'live') return row.doorNumber == null ? 'live' : String(row.doorNumber)
  return row.doorNumber == null ? 'none' : String(row.doorNumber)
}

function doorTitle(row: { family: Family; door: string }) {
  if (row.family === 'circle') return 'Circle'
  if (row.family === 'live') return row.door || 'Live'
  return row.door || 'No door yet'
}

function questionKey(row: { family: Family; doorNumber: number | null; courseId: number | null; talkId: number | null; questionId: number | null; question: string }) {
  return `${doorKeyOf(row)}|${row.courseId ?? 0}|${row.talkId ?? 0}|${row.questionId ?? row.question}|${row.family}`
}

function matches(row: RawFeedback, filters: FeedbackFilters) {
  if (filters.door && row.doorNumber !== filters.door) return false
  if (filters.seatId && row.seatId !== filters.seatId) return false
  if (filters.courseId && row.courseId !== filters.courseId) return false
  if (filters.talkId && row.talkId !== filters.talkId) return false
  if (filters.questionId && row.questionId !== filters.questionId) return false
  if (filters.family && row.family !== filters.family) return false
  if (filters.learnerId && row.learnerId !== filters.learnerId) return false
  if (filters.accessCodeId && row.accessCodeId !== filters.accessCodeId) return false
  const stamp = row.date.slice(0, 10)
  if (filters.from && stamp < filters.from) return false
  if (filters.to && stamp > filters.to) return false
  return true
}

export function britishDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Portal scope is applied here as well as in the query, so a row from another portal cannot slip through.
 * Private rows are counted and then dropped. Names become stable pseudonyms when anonymised, and emails never leave.
 */
export function buildFeedback(rows: RawFeedback[], portalId: number, filters: FeedbackFilters, anonymised: boolean): BuiltFeedback {
  const scoped = rows.filter((row) => row.portalId === portalId).filter((row) => matches(row, filters))
  const shared = scoped.filter((row) => sharingDecision(row) === 'share')
  const names = anonymised ? assignPseudonyms(shared.map((row) => row.learnerId)) : null
  const shown: ShownAnswer[] = shared
    .map((row) => ({
      id: row.id,
      doorNumber: row.doorNumber,
      door: row.door,
      seat: row.seat,
      courseId: row.courseId,
      course: row.course,
      talkId: row.talkId,
      talk: row.talk,
      questionId: row.questionId,
      question: row.question,
      family: row.family,
      familyLabel: FAMILY_LABEL[row.family],
      text: row.text,
      date: row.date,
      dateLabel: britishDate(row.date),
      learnerId: row.learnerId,
      learner: names ? names.get(row.learnerId) || 'Learner' : row.learnerName || 'Learner',
      reply: row.reply,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

  const questionMap = new Map<string, { sample: RawFeedback; shared: ShownAnswer[]; privateCount: number }>()
  for (const row of scoped) {
    const key = questionKey(row)
    if (!questionMap.has(key)) questionMap.set(key, { sample: row, shared: [], privateCount: 0 })
    const bucket = questionMap.get(key)!
    if (sharingDecision(row) === 'private') bucket.privateCount += 1
  }
  for (const row of shown) {
    const key = questionKey(row)
    questionMap.get(key)?.shared.push(row)
  }

  const talkMap = new Map<string, TalkGroup>()
  const doorMap = new Map<string, DoorGroup>()
  for (const [key, bucket] of questionMap) {
    const sample = bucket.sample
    const doorKey = doorKeyOf(sample)
    const talkKey = `${doorKey}|${sample.courseId ?? 0}|${sample.talkId ?? 0}|${sample.course}|${sample.talk}`
    if (!doorMap.has(doorKey)) {
      doorMap.set(doorKey, { key: doorKey, doorNumber: sample.family === 'circle' ? null : sample.doorNumber, door: doorTitle(sample), talks: [], shared: 0, privateCount: 0 })
    }
    if (!talkMap.has(talkKey)) {
      const talk: TalkGroup = { key: talkKey, talkId: sample.talkId, talk: sample.talk || 'Circle board', courseId: sample.courseId, course: sample.course, questions: [] }
      talkMap.set(talkKey, talk)
      doorMap.get(doorKey)!.talks.push(talk)
    }
    talkMap.get(talkKey)!.questions.push({
      key,
      questionId: sample.questionId,
      question: sample.question,
      family: sample.family,
      familyLabel: FAMILY_LABEL[sample.family],
      answers: bucket.shared,
      privateCount: bucket.privateCount,
    })
    const door = doorMap.get(doorKey)!
    door.shared += bucket.shared.length
    door.privateCount += bucket.privateCount
  }

  const doors = [...doorMap.values()]
    .map((door) => ({
      ...door,
      talks: door.talks
        .map((talk) => ({ ...talk, questions: talk.questions.sort((a, b) => a.question.localeCompare(b.question)) }))
        .sort((a, b) => a.course.localeCompare(b.course) || a.talk.localeCompare(b.talk)),
    }))
    .sort((a, b) => (a.doorNumber ?? 100) - (b.doorNumber ?? 100) || a.door.localeCompare(b.door))

  const learnerMap = new Map<number, LearnerGroup>()
  for (const row of shown) {
    if (!learnerMap.has(row.learnerId)) learnerMap.set(row.learnerId, { learnerId: row.learnerId, learner: row.learner, answers: [] })
    learnerMap.get(row.learnerId)!.answers.push(row)
  }
  const learners = [...learnerMap.values()].sort((a, b) => a.learner.localeCompare(b.learner))

  return {
    portalId,
    anonymised,
    privateCount: scoped.length - shared.length,
    sharedCount: shown.length,
    rows: shown,
    doors,
    learners,
    doorCounts: doors.map((door) => ({ key: door.key, label: door.door, shared: door.shared, privateCount: door.privateCount })),
    questionCounts: [...questionMap.entries()]
      .map(([key, bucket]) => ({ key, label: bucket.sample.question, shared: bucket.shared.length, privateCount: bucket.privateCount }))
      .sort((a, b) => b.shared - a.shared || a.label.localeCompare(b.label)),
  }
}

export function exportCells(row: ShownAnswer): string[] {
  return [row.door, row.seat, row.course, row.talk, row.question, row.familyLabel, row.text, row.dateLabel, row.learner, row.reply]
}

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
  return safe
}

export function feedbackCsv(built: BuiltFeedback) {
  const lines = [EXPORT_COLUMNS.join(','), ...built.rows.map((row) => exportCells(row).map(csvCell).join(','))]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export async function feedbackXlsx(built: BuiltFeedback) {
  const book = new ExcelJS.Workbook()
  book.creator = 'Hady Core'
  const sheet = book.addWorksheet('Feedback')
  const note = sheet.addRow([
    built.anonymised
      ? `Anonymised. ${built.sharedCount} shared answers. ${built.privateCount} kept private and left out. Emails are not included.`
      : `Named export for this portal only. ${built.sharedCount} shared answers. ${built.privateCount} kept private and left out. Emails are not included.`,
  ])
  sheet.mergeCells(1, 1, 1, EXPORT_COLUMNS.length)
  note.font = { italic: true, color: { argb: 'FF0F3B3A' } }
  const header = sheet.addRow([...EXPORT_COLUMNS])
  header.font = { bold: true, color: { argb: 'FF1A1408' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0AA45' } }
  for (const row of built.rows) {
    const added = sheet.addRow(exportCells(row))
    added.eachCell((cell) => {
      cell.alignment = { wrapText: true, vertical: 'top' }
    })
  }
  EXPORT_COLUMNS.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column === 'answer' || column === 'question' ? 42 : 18
  })
  const out = await book.xlsx.writeBuffer()
  return Buffer.from(out)
}

export type DigestSummary = { questionKey: string; themes: string[]; quotes: string[] }

export type PdfDigest = { portal?: string; from?: string | null; to?: string | null }

const PAPER = '0.937 0.890 0.784'
const TEAL = '0.059 0.231 0.227'
const GOLD = '0.878 0.667 0.271'
const INK = '0.078 0.133 0.122'
const CREAM = '0.969 0.933 0.859'
const MUTED = '0.243 0.333 0.318'

export function feedbackPdf(built: BuiltFeedback, summaries: DigestSummary[] = [], digest: PdfDigest = {}) {
  const portal = (digest.portal || 'This portal').replace(/\s+/g, ' ').trim() || 'This portal'
  const fonts: PdfFonts = { F1: new FontUse(notoSans('regular')), F2: new FontUse(notoSans('bold')), F3: new FontUse(notoSans('italic')) }
  writing = fonts
  try {
    const pages: string[][] = [coverPage(built, portal, digest.from, digest.to)]
    const content = contentPages(built, summaries, portal)
    return assemblePdf([...pages, ...content].map((ops) => ops.join('\n')), fonts)
  } finally {
    writing = null
  }
}

function coverPage(built: BuiltFeedback, portal: string, from?: string | null, to?: string | null) {
  const ops = paper()
  ops.push(`${TEAL} rg`, '0 520 595 322 re f', `${GOLD} rg`, '0 512 595 8 re f')
  text(ops, 56, 760, 'Hady Core', 'F2', 12, GOLD)
  text(ops, 56, 718, 'Feedback for teachers', 'F2', 28, CREAM)
  for (const [index, line] of wrap(portal, 32).entries()) text(ops, 56, 672 - index * 26, line, 'F2', 20, CREAM)
  text(ops, 56, 460, dateRange(built, from, to), 'F1', 14, INK)
  text(ops, 56, 418, built.anonymised ? 'Anonymised' : 'Named', 'F2', 22, TEAL)
  text(ops, 56, 384, built.anonymised ? 'Names are Learner A, Learner B, and so on. Emails are left out.' : 'Names are included for this portal only. Emails are left out.', 'F1', 12, MUTED)
  text(ops, 56, 348, countPhrase(built.sharedCount, built.privateCount), 'F2', 14, INK)
  text(ops, 56, 322, 'Answers kept private are counted on this page and left out of the ones that follow.', 'F1', 11, MUTED)
  return ops
}

function dateRange(built: BuiltFeedback, from?: string | null, to?: string | null) {
  const dates = built.rows.map((row) => row.date.slice(0, 10)).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort()
  const start = from || dates[0] || ''
  const end = to || dates[dates.length - 1] || ''
  const label = (iso: string) => britishDate(`${iso}T12:00:00.000Z`)
  if (start && end && start !== end) return `${label(start)} to ${label(end)}`
  if (start || end) return label(start || end)
  return 'All dates'
}

function contentPages(built: BuiltFeedback, summaries: DigestSummary[], portal: string) {
  const byQuestion = new Map(summaries.map((summary) => [summary.questionKey, summary]))
  const pages: string[][] = []
  let ops = contentHeader(portal)
  let y = 748
  const next = () => {
    pages.push(ops)
    ops = contentHeader(portal)
    y = 748
  }
  const need = (height: number) => {
    if (y - height < 56) next()
  }
  if (!built.doors.length) {
    text(ops, 56, y, 'Nothing shared matches these filters.', 'F1', 13, INK)
    pages.push(ops)
    return pages
  }
  for (const door of built.doors) {
    const doorLines = wrap(door.door || 'Door', 42)
    need(36 + doorLines.length * 22)
    ops.push(`${GOLD} rg`, `48 ${y - 16} 8 18 re f`)
    doorLines.forEach((line, index) => text(ops, 66, y - index * 22, line, 'F2', 16, TEAL))
    y -= doorLines.length * 22 + 6
    text(ops, 66, y, countPhrase(door.shared, door.privateCount), 'F1', 10, MUTED)
    y -= 26
    for (const talk of door.talks) {
      const heading = talk.course && talk.course !== talk.talk ? `${talk.course} - ${talk.talk}` : talk.talk || talk.course || 'Talk'
      const talkLines = wrap(heading, 70)
      need(18 + talkLines.length * 16)
      talkLines.forEach((line, index) => text(ops, 56, y - index * 16, line, 'F2', 12, INK))
      y -= talkLines.length * 16 + 12
      for (const question of talk.questions) {
        const questionLines = wrap(question.question, 68)
        need(28 + questionLines.length * 16)
        text(ops, 56, y, question.familyLabel, 'F2', 9, TEAL)
        y -= 16
        questionLines.forEach((line, index) => text(ops, 56, y - index * 16, line, 'F2', 12, INK))
        y -= questionLines.length * 16 + 4
        if (question.privateCount) {
          text(ops, 56, y, countPhrase(question.answers.length, question.privateCount), 'F1', 10, MUTED)
          y -= 16
        }
        const summary = byQuestion.get(question.key)
        if (summary) {
          const themes = summary.themes.slice(0, 5)
          need(20 + themes.length * 14)
          text(ops, 56, y, 'AI summary', 'F2', 10, TEAL)
          y -= 14
          for (const theme of themes) {
            const bits = wrap(theme, 74)
            need(bits.length * 13)
            bits.forEach((bit) => {
              text(ops, 68, y, `- ${bit}`, 'F1', 10, INK)
              y -= 13
            })
          }
          y -= 6
        }
        if (!question.answers.length) {
          need(18)
          text(ops, 68, y, 'No shared answer under this question.', 'F1', 10, MUTED)
          y -= 20
        }
        for (const answer of question.answers) {
          const quote = wrap(`"${answer.text}"`, 72)
          const replyLines = answer.reply ? wrap(answer.reply, 64) : []
          const block = 22 + quote.length * 15 + (replyLines.length ? 16 + replyLines.length * 13 : 0) + 14
          need(block)
          const top = y + 12
          const bottom = y - block + 18
          ops.push(`${CREAM} rg`, `52 ${bottom.toFixed(1)} 491 ${(top - bottom).toFixed(1)} re f`)
          ops.push(`${GOLD} rg`, `52 ${bottom.toFixed(1)} 4 ${(top - bottom).toFixed(1)} re f`)
          quote.forEach((line) => {
            text(ops, 68, y, line, 'F3', 12, INK)
            y -= 15
          })
          text(ops, 68, y, `${answer.learner}, ${answer.dateLabel}`, 'F1', 9, MUTED)
          y -= 14
          if (replyLines.length) {
            text(ops, 84, y, 'Teacher reply', 'F2', 10, TEAL)
            y -= 13
            replyLines.forEach((line) => {
              text(ops, 84, y, line, 'F1', 10, TEAL)
              y -= 13
            })
          }
          y -= 12
        }
        y -= 8
      }
    }
    y -= 8
  }
  pages.push(ops)
  return pages
}

function paper() {
  return [`${PAPER} rg`, '0 0 595 842 re f']
}

function contentHeader(portal: string) {
  const ops = paper()
  ops.push(`${TEAL} rg`, '0 786 595 56 re f', `${GOLD} rg`, '0 782 595 4 re f')
  text(ops, 48, 808, 'Feedback for teachers', 'F2', 12, CREAM)
  text(ops, 220, 808, wrap(portal, 42)[0] || portal, 'F1', 11, CREAM)
  return ops
}

function wrap(value: string, width: number) {
  const words = value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > width && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

type PdfFonts = Record<'F1' | 'F2' | 'F3', FontUse>

/** The faces of the document being written. feedbackPdf is synchronous, so one document is written at a time. */
let writing: PdfFonts | null = null

function text(ops: string[], x: number, y: number, value: string, font: 'F1' | 'F2' | 'F3', size: number, color: string) {
  if (!writing) throw new Error('No PDF is being written.')
  ops.push(`${color} rg`, `BT /${font} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td ${writing[font].encode(value.replace(/\s+/g, ' '))} Tj ET`)
}

function assemblePdf(pages: string[], fonts: PdfFonts) {
  const objects: Buffer[] = []
  const pageObjectAt: number[] = []
  objects.push(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'))
  objects.push(Buffer.alloc(0))
  const faces = (['F1', 'F2', 'F3'] as const).map((key, index) => {
    const built = fontObjects(fonts[key], objects.length + 1, `HRTS${'ABC'[index]}A`)
    objects.push(...built.objects)
    return `/${key} ${built.id} 0 R`
  })
  pages.forEach((content) => {
    const contentId = objects.length + 1
    objects.push(Buffer.from(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`))
    pageObjectAt.push(objects.length + 1)
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << ${faces.join(' ')} >> >> >>`))
  })
  const kids = pageObjectAt.map((id) => `${id} 0 R`).join(' ')
  objects[1] = Buffer.from(`<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`)
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')]
  let length = chunks[0].length
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(length)
    const piece = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from('\nendobj\n')])
    chunks.push(piece)
    length += piece.length
  })
  let tail = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) tail += `${String(offset).padStart(10, '0')} 00000 n \n`
  tail += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF`
  chunks.push(Buffer.from(tail))
  return Buffer.concat(chunks)
}

export function themesFromAnswers(text: string): { themes: string[]; quotes: string[] } {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 8)
  if (!lines.length) return { themes: ['Nothing shared to read yet.'], quotes: [] }
  const clip = (line: string) => (line.length > 90 ? `${line.slice(0, 87)}...` : line)
  const quotes = lines.slice(0, 3).map((line) => (line.length > 180 ? `${line.slice(0, 177)}...` : line))
  const themes = [`One person wrote: ${clip(lines[0])}`]
  if (lines[1]) themes.push(`Someone else: ${clip(lines[1])}`)
  if (lines.length > 2) themes.push('A couple more said something close to that.')
  if (lines.length > 4) themes.push('A few answers are only a line. Those ones stuck.')
  return { themes: themes.slice(0, 5), quotes }
}

/**
 * Sample feedback rows are part of the hearts demo only: local seed, the e2e database, or a host named hearts-demo.
 * Production and a starters load never create them.
 */
export function feedbackDemoSeedAllowed(env: Env = process.env, startersOnly = false) {
  if (startersOnly || isProduction(env)) return false
  if (env.HEARTS_DEMO === '0') return false
  const url = env.SERVER_URL || ''
  if (!url || /localhost|127\.0\.0\.1|hearts-demo/i.test(url)) return true
  return env.HEARTS_DEMO === '1' || env.HEARTS_E2E === '1'
}

export function filterQuery(filters: FeedbackFilters, extra: Record<string, string> = {}) {
  const query = new URLSearchParams()
  if (filters.door) query.set('door', `W${filters.door}`)
  if (filters.seatId) query.set('seat', String(filters.seatId))
  if (filters.courseId) query.set('course', String(filters.courseId))
  if (filters.talkId) query.set('talk', String(filters.talkId))
  if (filters.questionId) query.set('question', String(filters.questionId))
  if (filters.family) query.set('family', filters.family)
  if (filters.learnerId) query.set('learner', String(filters.learnerId))
  if (filters.from) query.set('from', filters.from)
  if (filters.to) query.set('to', filters.to)
  if (filters.accessCodeId) query.set('cohort', String(filters.accessCodeId))
  for (const [key, value] of Object.entries(extra)) if (value) query.set(key, value)
  return query
}
