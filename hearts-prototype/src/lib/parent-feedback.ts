import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCourseSheet } from './sequence'

/** Real parent answers and film notes. They are display data, never learner accounts. */

export type ParentPhase = 'Phase 1' | 'Phase 2'

export type RealAnswer = {
  phase: string
  videoOrder: number
  calloutSecond: number
  question: string
  text: string
}

export type FilmFeedback = {
  phase: string
  videoOrder: number
  text: string
}

export type OpeningQuestion = {
  prompt: string
  why: string
  options: string[]
}

export const OPENING_QUESTIONS: OpeningQuestion[] = [
  {
    prompt: 'How old are your children?',
    why: 'So the films can meet them where they are.',
    options: ['Under 5', '5 to 7', '8 to 11', '12 to 16', 'Mixed ages', 'No children at home right now'],
  },
  {
    prompt: 'What is hardest about home learning right now?',
    why: 'A plain picture of this week.',
    options: ['Finding the time', 'Keeping them on the task', 'Knowing if I am doing it right', 'Fitting more than one child', 'I am not sure yet'],
  },
  {
    prompt: 'How much time can you give this on a usual day?',
    why: 'The films work in short sittings.',
    options: ['Under 20 minutes', 'About half an hour', 'About an hour', 'More than an hour', 'It changes every day'],
  },
  {
    prompt: 'What do you want to get better at?',
    why: 'This is where the course starts for you.',
    options: ['A calmer start', 'A plan for the week', 'Helping when they get stuck', 'Letting them try it themselves', 'I want to see the films first'],
  },
]

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export function phaseLabel(phase: string) {
  if (/2/.test(phase)) return 'Real parent answer, Phase 2 (Mar 2021)'
  return 'Real parent answer, Phase 1 (Jan 2021)'
}

export function feedbackPhaseLabel(phase: string) {
  if (/2/.test(phase)) return 'Phase 2 (Mar 2021)'
  return 'Phase 1 (Jan 2021)'
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

function headerMap(cells: string[]) {
  const map = new Map<string, number>()
  cells.forEach((cell, index) => map.set(cell.trim().toLowerCase(), index))
  return map
}

export function parseRealAnswers(csv: string): RealAnswer[] {
  const table = parseCsv(csv)
  if (!table.length) return []
  const head = headerMap(table[0])
  const at = (name: string) => head.get(name) ?? -1
  const phaseAt = at('phase')
  const orderAt = at('video_order')
  const secondAt = at('callout_second')
  const questionAt = at('question')
  const answerAt = at('answer')
  if (phaseAt < 0 || orderAt < 0 || questionAt < 0 || answerAt < 0) return []
  const answers: RealAnswer[] = []
  for (const cells of table.slice(1)) {
    const text = String(cells[answerAt] || '').replace(/\s+/g, ' ').trim()
    const question = String(cells[questionAt] || '').replace(/\s+/g, ' ').trim()
    const videoOrder = Number(cells[orderAt])
    if (!text || !question || !Number.isFinite(videoOrder)) continue
    const second = secondAt >= 0 ? Number(cells[secondAt]) : 0
    answers.push({
      phase: String(cells[phaseAt] || 'Phase 1').trim() || 'Phase 1',
      videoOrder,
      calloutSecond: Number.isFinite(second) ? second : 0,
      question,
      text,
    })
  }
  return answers
}

export function parseParentFeedback(csv: string): FilmFeedback[] {
  const table = parseCsv(csv)
  if (!table.length) return []
  const head = headerMap(table[0])
  const phaseAt = head.get('phase') ?? -1
  const orderAt = head.get('video_order') ?? -1
  const textAt = head.get('feedback_text') ?? -1
  if (phaseAt < 0 || orderAt < 0 || textAt < 0) return []
  const rows: FilmFeedback[] = []
  for (const cells of table.slice(1)) {
    const text = String(cells[textAt] || '').replace(/\s+/g, ' ').trim()
    const videoOrder = Number(cells[orderAt])
    if (!text || !Number.isFinite(videoOrder)) continue
    rows.push({ phase: String(cells[phaseAt] || 'Phase 1').trim() || 'Phase 1', videoOrder, text })
  }
  return rows
}

let realCache: RealAnswer[] | null = null
let feedbackCache: FilmFeedback[] | null = null

export function realAnswersPath() {
  return path.join(root, 'uploads/real-answers.csv')
}

export function parentFeedbackPath() {
  return path.join(root, 'uploads/parent-feedback.csv')
}

/** Read the committed sheets again. Re-import is replacing the CSV and calling this. */
export function loadRealAnswers(): RealAnswer[] {
  if (!realCache) realCache = parseRealAnswers(readFileSync(realAnswersPath(), 'utf8'))
  return realCache
}

export function loadParentFeedback(): FilmFeedback[] {
  if (!feedbackCache) feedbackCache = parseParentFeedback(readFileSync(parentFeedbackPath(), 'utf8'))
  return feedbackCache
}

export function clearParentFeedbackCache() {
  realCache = null
  feedbackCache = null
}

export function filmTitles(): Map<number, string> {
  const parsed = parseCourseSheet(readFileSync(path.join(root, 'uploads/videos.csv'), 'utf8'))
  return new Map(parsed.films.map((film) => [film.order, film.publicTitle]))
}

export function answersForFilm(order: number, answers: RealAnswer[] = loadRealAnswers()) {
  return answers.filter((row) => row.videoOrder === order)
}

export function feedbackForFilm(order: number, rows: FilmFeedback[] = loadParentFeedback()) {
  return rows.filter((row) => row.videoOrder === order)
}

export function sameQuestion(a: string, b: string) {
  return a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase()
}

export type CalloutSlot = { second: number; prompt: string }

/** Add a sheet question when that film does not already ask it, at callout_second. */
export function mergeCalloutQuestions<T extends { order: number; callouts: CalloutSlot[] }>(films: T[], extras: { videoOrder: number; calloutSecond: number; question: string }[]) {
  let added = 0
  const next = films.map((film) => ({ ...film, callouts: film.callouts.map((callout) => ({ ...callout })) }))
  for (const extra of extras) {
    const film = next.find((row) => row.order === extra.videoOrder)
    if (!film || !extra.question.trim()) continue
    if (film.callouts.some((callout) => sameQuestion(callout.prompt, extra.question))) continue
    film.callouts.push({ second: extra.calloutSecond, prompt: extra.question.trim() })
    film.callouts.sort((a, b) => a.second - b.second)
    added += 1
  }
  return { films: next, added }
}

export function questionsPerFilm(films: { order: number; callouts: { prompt: string }[] }[]) {
  const counts = new Map<number, number>()
  for (const film of films) counts.set(film.order, film.callouts.filter((callout) => callout.prompt.trim()).length)
  return counts
}
