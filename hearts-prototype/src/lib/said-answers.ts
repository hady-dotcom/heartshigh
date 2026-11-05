import { phaseLabel } from './parent-feedback'
import { SAMPLE_GAP_ANSWERS } from './sample-gap-data'

/** A parent line stored on one course. It is display copy, never a learner account. */
export type SaidAnswer = {
  order: number
  phase: string
  label: string
  question: string
  text: string
  sample?: boolean
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const source = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"'
          i += 1
        } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') {
      quoted = true
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (ch === '\n') {
      row.push(cell)
      if (row.some((item) => item.trim())) rows.push(row)
      row = []
      cell = ''
      continue
    }
    if (ch !== '\r') cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    if (row.some((item) => item.trim())) rows.push(row)
  }
  return rows
}

function headerAt(head: string[], names: string[]) {
  return head.findIndex((cell) => names.includes(cell))
}

/** phase, video_order, question, answer. callout_second is kept when the sheet has it and is otherwise ignored. */
export function parseSaidSheet(raw: string): { rows: SaidAnswer[]; error?: string } {
  const text = String(raw || '').replace(/^\uFEFF/, '').trim()
  if (!text) return { rows: [], error: 'That answers sheet is empty.' }
  const table = parseCsv(text)
  const head = (table[0] || []).map((cell) => cell.trim().toLowerCase())
  const phaseAt = headerAt(head, ['phase'])
  const orderAt = headerAt(head, ['video_order', 'order'])
  const questionAt = headerAt(head, ['question', 'prompt'])
  const textAt = headerAt(head, ['answer', 'text'])
  if (orderAt < 0 || textAt < 0) return { rows: [], error: 'That sheet needs a video_order column and an answer column.' }
  const rows: SaidAnswer[] = []
  for (const cells of table.slice(1)) {
    const order = Number(cells[orderAt])
    const answer = String(cells[textAt] || '').replace(/\s+/g, ' ').trim()
    if (!Number.isFinite(order) || order <= 0 || !answer) continue
    const phase = (phaseAt >= 0 ? String(cells[phaseAt] || '').trim() : '') || 'Phase 1'
    const question = questionAt >= 0 ? String(cells[questionAt] || '').replace(/\s+/g, ' ').trim() : ''
    const sample = /^sample$/i.test(phase)
    rows.push({
      order: Math.round(order),
      phase: sample ? 'Sample' : phase,
      label: sample ? 'Sample answer' : phaseLabel(phase),
      question,
      text: answer.slice(0, 2000),
      ...(sample ? { sample: true } : {}),
    })
  }
  if (!rows.length) return { rows: [], error: 'That sheet has no answers.' }
  return { rows }
}

export function readSaidAnswers(value: unknown): SaidAnswer[] {
  if (!Array.isArray(value)) return []
  const rows: SaidAnswer[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<SaidAnswer>
    const order = Number(row.order)
    const text = String(row.text || '').trim()
    if (!Number.isFinite(order) || order <= 0 || !text) continue
    const phase = String(row.phase || 'Phase 1')
    rows.push({
      order,
      phase,
      label: String(row.label || phaseLabel(phase)),
      question: String(row.question || ''),
      text,
      ...(row.sample ? { sample: true } : {}),
    })
  }
  return rows
}

/** Sample lines for films that have no real answer yet. Films that already have one are left alone. */
export function fillSampleGaps(rows: SaidAnswer[]): SaidAnswer[] {
  const orders = new Set(rows.map((row) => row.order))
  const extra: SaidAnswer[] = SAMPLE_GAP_ANSWERS.filter((row) => !orders.has(row.order)).map((row) => ({
    order: row.order,
    phase: 'Sample',
    label: 'Sample answer',
    question: row.prompt,
    text: row.body,
    sample: true,
  }))
  return [...rows, ...extra]
}

export function saidForFilm(rows: SaidAnswer[], order: number, prompt = '') {
  const mine = rows.filter((row) => row.order === order)
  const matched = prompt ? mine.filter((row) => row.question === prompt) : []
  return matched.length ? matched : mine
}

/**
 * Home Learning sample lines were saved onto Book Summaries.
 * Guiding Home Learning keeps its own lines. Any other Book Summaries row loses them.
 */
export function misplacedHomeAnswers(course: { id?: number | null; title?: string | null; sampleAnswers?: unknown }) {
  const title = String(course.title || '')
  if (/guiding home learning/i.test(title)) return false
  const rows = readSaidAnswers(course.sampleAnswers)
  if (!rows.length) return false
  if (/book summar/i.test(title)) return true
  const home = rows.some((row) => /home learning/i.test(`${row.question} ${row.text}`))
  return home && Number(course.id) === 77
}
