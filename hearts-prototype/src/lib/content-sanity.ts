import { questionKey } from './question-keep'

export type TimedQuestion = { id: number; second: number; prompt: string }

/**
 * One row per question, each at its own second inside the film.
 * A time past the film, or past 80% when `pullLate` is set, is brought forward.
 * Several that would land on the same second are stepped apart, latest first, so earlier questions stay put.
 */
export function placeQuestionTimes(
  rows: TimedQuestion[],
  duration?: number | null,
  opts: { pullLate?: boolean } = {},
): TimedQuestion[] {
  const pullLate = opts.pullLate !== false
  const kept: TimedQuestion[] = []
  const seen = new Set<string>()
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    const key = questionKey(row.prompt)
    if (key) {
      if (seen.has(key)) continue
      seen.add(key)
    }
    kept.push(row)
  }
  const ordered = kept.sort((a, b) => a.second - b.second || a.id - b.id)
  if (!ordered.length) return []
  const length = Number(duration)
  const known = Number.isFinite(length) && length >= 5
  const limit = known ? Math.floor(length) : null
  const latest = limit == null ? null : Math.max(1, Math.floor(limit * 0.8))
  const gap = limit == null ? 20 : Math.max(8, Math.floor(limit / 40))
  const desired = ordered.map((row) => {
    let at = Math.max(0, Math.floor(Number(row.second) || 0))
    if (limit != null && at >= limit) at = latest as number
    else if (pullLate && latest != null && at > latest) at = latest
    return at
  })
  const out = desired.slice()
  for (let index = 1; index < out.length; index += 1) {
    if (out[index] <= out[index - 1]) out[index] = out[index - 1] + gap
  }
  const cap = pullLate ? latest : (limit != null ? Math.max(1, limit - 1) : null)
  if (cap != null && out[out.length - 1] > cap) {
    out[out.length - 1] = cap
    for (let index = out.length - 2; index >= 0; index -= 1) {
      if (out[index] >= out[index + 1]) out[index] = Math.max(0, out[index + 1] - gap)
    }
  }
  if (limit != null) {
    for (let index = 0; index < out.length; index += 1) out[index] = Math.min(out[index], Math.max(0, limit - 1))
  }
  return ordered.map((row, index) => ({ ...row, second: out[index] }))
}

/** What is wrong with the stored questions, before they are placed for the learner. */
export function rawQuestionProblems(rows: TimedQuestion[], duration?: number | null): string[] {
  const problems: string[] = []
  const prompts = new Map<string, number>()
  const seconds = new Map<number, number>()
  const length = Number(duration)
  const known = Number.isFinite(length) && length >= 5
  for (const row of rows) {
    const key = questionKey(row.prompt)
    if (key) prompts.set(key, (prompts.get(key) || 0) + 1)
    const at = Math.floor(Number(row.second) || 0)
    seconds.set(at, (seconds.get(at) || 0) + 1)
    if (known && at >= length) problems.push(`question ${row.id} is at ${at}s, past the ${Math.floor(length)}s film`)
  }
  for (const [prompt, count] of prompts) {
    if (count > 1) problems.push(`“${prompt.slice(0, 80)}” is stored ${count} times`)
  }
  for (const [second, count] of seconds) {
    if (count > 1) problems.push(`${count} questions share ${second}s`)
  }
  if (rows.length > 12) problems.push(`${rows.length} questions on one part is more than a short film should ask`)
  return problems
}

/** Problems that would still show after placement. A clean list returns none. */
export function placedQuestionProblems(rows: TimedQuestion[], duration?: number | null, opts: { pullLate?: boolean } = {}): string[] {
  const placed = placeQuestionTimes(rows, duration, opts)
  const problems: string[] = []
  const length = Number(duration)
  const known = Number.isFinite(length) && length >= 5
  const seenPrompt = new Set<string>()
  const seenSecond = new Set<number>()
  for (const row of placed) {
    const key = questionKey(row.prompt)
    if (key) {
      if (seenPrompt.has(key)) problems.push(`“${key.slice(0, 80)}” still appears twice`)
      seenPrompt.add(key)
    }
    if (seenSecond.has(row.second)) problems.push(`two questions still share ${row.second}s`)
    seenSecond.add(row.second)
    if (row.second < 0) problems.push(`question ${row.id} is before the film`)
    if (known && row.second >= length) problems.push(`question ${row.id} is still past the film`)
  }
  return problems
}

export type PartRow = { title: string; order?: number | null }

/** Part titles and numbers a learner would find confusing. */
export function partListProblems(parts: PartRow[]): string[] {
  const problems: string[] = []
  const titles = new Map<string, number>()
  parts.forEach((part, index) => {
    const place = index + 1
    const title = String(part.title || '').replace(/\s+/g, ' ').trim()
    if (!title) problems.push(`part ${place} has no title`)
    else if (/^(vimeo\s+)?\d{5,}$/i.test(title) || /\.(mp4|webm|mov)$/i.test(title)) problems.push(`part ${place} title is a file name`)
    const key = title.toLowerCase()
    if (key && titles.has(key)) problems.push(`“${title}” is used for part ${titles.get(key)} and part ${place}`)
    if (key) titles.set(key, place)
    const order = Number(part.order)
    if (Number.isFinite(order) && order > 0 && order !== place && parts.every((row) => Number(row.order) > 0)) {
      problems.push(`part ${place} is stored as number ${order}`)
    }
  })
  return problems
}

/** The workbook card always goes to this path. A tap should load it as a normal link. */
export function workbookCardHref(base: string) {
  const root = String(base || '').replace(/\/+$/, '')
  return `${root}/workbook`
}
