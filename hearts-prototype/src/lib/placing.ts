export type PlacingOption = { label: string; clause: number | null }

export const DEFAULT_START_CLAUSE = 2

/** Options are stored as plain strings. "With prayer | 15" means the answer leans towards clause 15. */
export function parseOption(raw: unknown): PlacingOption {
  const text = String(raw ?? '').trim()
  const match = text.match(/^(.*?)\s*\|\s*(\d{1,2})\s*$/)
  if (!match) return { label: text, clause: null }
  const clause = Number(match[2])
  return { label: match[1].trim(), clause: clause >= 1 && clause <= 41 ? clause : null }
}

export function optionLabels(options: unknown): string[] {
  return Array.isArray(options) ? options.map((option) => parseOption(option).label).filter(Boolean) : []
}

/**
 * Each chosen answer votes for the clause it names. The last question carries double weight
 * because it asks directly where the first talk should stand. Ties go to the earlier vote.
 */
export function startingClause(answers: { options: unknown; choice: string; weight?: number }[]): number {
  const votes = new Map<number, { score: number; first: number }>()
  answers.forEach((answer, index) => {
    const options = Array.isArray(answer.options) ? answer.options.map(parseOption) : []
    const picked = options.find((option) => option.label === answer.choice)
    if (!picked?.clause) return
    const current = votes.get(picked.clause) || { score: 0, first: index }
    current.score += answer.weight ?? 1
    votes.set(picked.clause, current)
  })
  let best: { clause: number; score: number; first: number } | null = null
  for (const [clause, vote] of votes) {
    if (!best || vote.score > best.score || (vote.score === best.score && vote.first < best.first)) {
      best = { clause, ...vote }
    }
  }
  return best?.clause ?? DEFAULT_START_CLAUSE
}

/** Pick the sitting whose cuts hang on the starting clause. Approved cuts count for more. */
export function recommendLesson(
  clause: number,
  cuts: { lessonId: number; bestClause: number | null; approved: boolean }[],
  lessonOrder: number[],
): number | null {
  const scores = new Map<number, number>()
  for (const cut of cuts) {
    if (cut.bestClause !== clause || !lessonOrder.includes(cut.lessonId)) continue
    scores.set(cut.lessonId, (scores.get(cut.lessonId) || 0) + (cut.approved ? 3 : 1))
  }
  let best: number | null = null
  for (const lessonId of lessonOrder) {
    const score = scores.get(lessonId) || 0
    if (score > 0 && (best === null || score > (scores.get(best) || 0))) best = lessonId
  }
  return best ?? lessonOrder[0] ?? null
}
