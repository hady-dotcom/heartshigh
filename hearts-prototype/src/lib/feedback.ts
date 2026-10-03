/**
 * Feedback for teachers: what may leave the portal, how names are hidden, and how a question
 * reads to a sheikh. Nothing here talks to the database.
 */
import ExcelJS from 'exceljs'
import type { Env } from './env'
import { isProduction } from './env'

export type Family = 'popup' | 'reflection' | 'task' | 'circle'

export const FAMILY_LABEL: Record<Family, string> = {
  popup: 'Pop-up',
  reflection: 'Reflection',
  task: 'Activation task',
  circle: 'Circle comment',
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
const PERSONAL = /\b(this week|your own|one moment|ordinary|name one|when did you|where did you|what did you do|a time when)\b/i
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
  return `One line from ${name} stayed with you. Name one ordinary moment this week where you met it, and what you did next.`
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
    family: family === 'popup' || family === 'reflection' || family === 'task' || family === 'circle' ? family : '',
    learnerId: positive(query.learner),
    from: day(query.from),
    to: day(query.to),
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

function day(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function doorNumber(value: string | undefined) {
  const match = String(value || '').trim().match(/^(?:w|door\s*)?(\d{1,2})$/i)
  if (!match) return null
  const number = Number(match[1])
  return number >= 1 && number <= 20 ? number : null
}

function doorKeyOf(row: { family: Family; doorNumber: number | null }) {
  if (row.family === 'circle') return 'circle'
  return row.doorNumber == null ? 'none' : String(row.doorNumber)
}

function doorTitle(row: { family: Family; door: string }) {
  if (row.family === 'circle') return 'Circle'
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
      doorMap.set(doorKey, { doorNumber: sample.family === 'circle' ? null : sample.doorNumber, door: doorTitle(sample), talks: [], shared: 0, privateCount: 0 })
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
    doorCounts: doors.map((door) => ({ key: String(door.doorNumber ?? 'circle'), label: door.door, shared: door.shared, privateCount: door.privateCount })),
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
  book.creator = 'HEARTS'
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

export function digestLines(built: BuiltFeedback, summaries: DigestSummary[] = []) {
  const byQuestion = new Map(summaries.map((summary) => [summary.questionKey, summary]))
  const lines: { text: string; bold?: boolean; size: number }[] = [
    { text: 'Feedback for teachers', bold: true, size: 18 },
    { text: built.anonymised ? 'Anonymised digest. Names are Learner A, Learner B, and so on. Emails are left out.' : 'Named digest for this portal only. Emails are left out.', size: 11 },
    { text: `${built.sharedCount} shared answers. ${built.privateCount} kept private, and left out of this digest.`, size: 11 },
    { text: ' ', size: 8 },
  ]
  if (!built.doors.length) {
    lines.push({ text: 'Nothing shared matches these filters.', size: 12 })
    return lines
  }
  for (const door of built.doors) {
    lines.push({ text: door.door, bold: true, size: 14 })
    lines.push({ text: `${door.shared} shared. ${door.privateCount} kept private.`, size: 10 })
    for (const talk of door.talks) {
      const heading = talk.course && talk.course !== talk.talk ? `${talk.course} - ${talk.talk}` : talk.talk || talk.course || 'Talk'
      lines.push({ text: heading || 'Talk', bold: true, size: 12 })
      for (const question of talk.questions) {
        lines.push({ text: `${question.familyLabel}. ${question.question}`, bold: true, size: 11 })
        if (question.privateCount) lines.push({ text: `${question.privateCount} kept private.`, size: 10 })
        const summary = byQuestion.get(question.key)
        if (summary) {
          lines.push({ text: 'AI summary', bold: true, size: 11 })
          for (const theme of summary.themes.slice(0, 5)) lines.push({ text: `• ${theme}`, size: 10 })
          for (const quote of summary.quotes.slice(0, 3)) lines.push({ text: `“${quote}”`, size: 10 })
        }
        for (const answer of question.answers) {
          lines.push({ text: `${answer.learner} - ${answer.dateLabel}`, size: 10 })
          for (const bit of wrap(answer.text, 92)) lines.push({ text: bit, size: 11 })
          if (answer.reply) {
            lines.push({ text: `Teacher reply: ${answer.reply}`, size: 10 })
          }
        }
        if (!question.answers.length) lines.push({ text: 'No shared answer under this question.', size: 10 })
        lines.push({ text: ' ', size: 6 })
      }
    }
  }
  return lines
}

export function feedbackPdf(built: BuiltFeedback, summaries: DigestSummary[] = []) {
  return renderPdf(digestLines(built, summaries))
}

function wrap(text: string, width: number) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
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

function pdfEscape(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function winAnsi(text: string) {
  return text
    .replace(/·/g, ' - ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E]/g, '')
}

export function renderPdf(lines: { text: string; bold?: boolean; size: number }[]) {
  const pages: string[] = []
  let ops: string[] = []
  let y = 790
  const flush = () => {
    if (!ops.length) return
    pages.push(ops.join('\n'))
    ops = []
    y = 790
  }
  for (const line of lines) {
    const step = line.size + 5
    if (y - step < 46) flush()
    const font = line.bold ? 'F2' : 'F1'
    const shown = winAnsi(line.text) || ' '
    ops.push(`BT /${font} ${line.size} Tf 48 ${y.toFixed(1)} Td (${pdfEscape(shown)}) Tj ET`)
    y -= step
  }
  flush()
  if (!pages.length) pages.push('BT /F1 12 Tf 48 790 Td (Empty) Tj ET')
  return assemblePdf(pages)
}

function assemblePdf(pages: string[]) {
  const objects: string[] = []
  const pageObjectAt: number[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push('')
  const fontRegular = objects.length + 1
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const fontBold = objects.length + 1
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
  pages.forEach((content) => {
    const stream = `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
    const contentId = objects.length + 1
    objects.push(stream)
    pageObjectAt.push(objects.length + 1)
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> >>`,
    )
  })
  const kids = pageObjectAt.map((id) => `${id} 0 R`).join(' ')
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`
  let body = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body))
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n`
  body += '0000000000 65535 f \n'
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, '0')} 00000 n \n`
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(body)
}

export function themesFromAnswers(text: string): { themes: string[]; quotes: string[] } {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 8)
  if (!lines.length) return { themes: ['There are no shared answers to summarise yet.'], quotes: [] }
  const quotes = lines.slice(0, 3).map((line) => (line.length > 180 ? `${line.slice(0, 177)}...` : line))
  const themes = [
    'People wrote about a particular moment, not a general opinion.',
    `A repeated note: ${lines[0].slice(0, 90)}`,
    lines[1] ? `Another thread: ${lines[1].slice(0, 90)}` : 'The answers stay close to the question that was asked.',
  ]
  if (lines.length > 3) themes.push('More than one person came back to the same kind of moment.')
  if (lines.length > 6) themes.push(`${lines.length} shared answers are enough to see a pattern, and not enough to speak for everyone.`)
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
