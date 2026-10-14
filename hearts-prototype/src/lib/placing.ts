import { DOORS, clauseForDoor, doorNumberOfClause, parseDoor, type Door } from './doors'

export type PlacingOption = { label: string; clause: number | null }

export const DEFAULT_START_CLAUSE = 2

/**
 * Options are stored as plain strings. "With prayer | 15" means the answer leans towards clause 15.
 * "With prayer | W5" names door 5 instead, and stands for that door's first clause.
 */
export function parseOption(raw: unknown, doors: Door[] = DOORS): PlacingOption {
  const text = String(raw ?? '').trim()
  const door = text.match(/^(.*?)\s*\|\s*(w\d{1,2})\s*$/i)
  if (door) {
    const number = parseDoor(door[2], doors)
    return { label: door[1].trim(), clause: number ? clauseForDoor(number, null, doors) : null }
  }
  const match = text.match(/^(.*?)\s*\|\s*(\d{1,2})\s*$/)
  if (!match) return { label: text, clause: null }
  const clause = Number(match[2])
  return { label: match[1].trim(), clause: clause >= 1 && clause <= 41 ? clause : null }
}

/** Stores a door answer as its clause, so saved options keep the 41-clause form: "With prayer | W5" becomes "With prayer | 15". */
export function normaliseOption(raw: string, doors: Door[] = DOORS): string {
  if (!/\|\s*w\d{1,2}\s*$/i.test(raw)) return raw
  const parsed = parseOption(raw, doors)
  return parsed.clause ? `${parsed.label} | ${parsed.clause}` : raw
}

export function optionLabels(options: unknown): string[] {
  return Array.isArray(options) ? options.map((option) => parseOption(option).label).filter(Boolean) : []
}

/**
 * Each chosen answer votes for the door its clause sits in. The last question carries double weight
 * because it asks directly where the first talk should stand. Ties go to the earlier vote. The result is the
 * first clause voted for inside the winning door, so the stored starting clause stays a clause.
 */
export function startingClause(answers: { options: unknown; choice: string; weight?: number }[], doors: Door[] = DOORS): number {
  const votes = new Map<number, { score: number; first: number; clause: number }>()
  answers.forEach((answer, index) => {
    const options = Array.isArray(answer.options) ? answer.options.map((option) => parseOption(option, doors)) : []
    const picked = options.find((option) => option.label === answer.choice)
    if (!picked?.clause) return
    const door = doorNumberOfClause(picked.clause, doors) || 0
    const current = votes.get(door) || { score: 0, first: index, clause: picked.clause }
    current.score += answer.weight ?? 1
    votes.set(door, current)
  })
  let best: { score: number; first: number; clause: number } | null = null
  for (const vote of votes.values()) {
    if (!best || vote.score > best.score || (vote.score === best.score && vote.first < best.first)) best = vote
  }
  return best?.clause ?? DEFAULT_START_CLAUSE
}

/** Pick the sitting whose cuts hang in the starting door. Approved cuts count for more. */
export function recommendLesson(
  clause: number,
  cuts: { lessonId: number; bestClause: number | null; approved: boolean }[],
  lessonOrder: number[],
  doors: Door[] = DOORS,
): number | null {
  const door = doorNumberOfClause(clause, doors)
  const scores = new Map<number, number>()
  for (const cut of cuts) {
    if (!door || doorNumberOfClause(cut.bestClause, doors) !== door || !lessonOrder.includes(cut.lessonId)) continue
    scores.set(cut.lessonId, (scores.get(cut.lessonId) || 0) + (cut.approved ? 3 : 1))
  }
  let best: number | null = null
  for (const lessonId of lessonOrder) {
    const score = scores.get(lessonId) || 0
    if (score > 0 && (best === null || score > (scores.get(best) || 0))) best = lessonId
  }
  return best
}
