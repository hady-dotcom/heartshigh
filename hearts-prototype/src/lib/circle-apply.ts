import { answersForPoint, circleFillProblems, FILL_MIN } from './circle-fill'
import type { CircleDraft, CirclePoint } from './circle'
import { isProduction, isRemoteDatabase, type Env } from './env'

export type CircleFillPoint = CirclePoint & {
  id: number
  family?: string | null
  lesson?: unknown
}

/** How many new drafts to write so this question has at least four, or a full set if it has none. */
export function draftsForGap(point: CircleFillPoint, existing: number): CircleDraft[] {
  if (point.family === 'workbook') return []
  if (existing >= FILL_MIN) return []
  const drafts = answersForPoint({ prompt: point.prompt, kind: point.kind, options: point.options, context: point.context })
  const problems = circleFillProblems(drafts)
  if (problems.length) return []
  const room = existing === 0 ? drafts.length : FILL_MIN - existing
  return drafts.slice(0, room)
}

export function lessonIdOf(point: { lesson?: unknown }) {
  return typeof point.lesson === 'number' ? point.lesson : (point.lesson as { id?: number } | null)?.id
}

/**
 * Additive swarm fill may run locally, in e2e, or on a host named hearts-demo when HEARTS_DEMO=1.
 * It never wipes, and it refuses a production or remote database unless that demo flag is set.
 */
export function circleDemoGuard(env: Env = process.env) {
  if (env.HEARTS_DEMO === '1' || env.HEARTS_E2E === '1') return null
  const url = env.SERVER_URL || ''
  if (/hearts-demo/i.test(url) && !isProduction(env)) return null
  if (isProduction(env) || isRemoteDatabase(env)) {
    return 'Refusing to write circle answers on a production or remote database. Nothing was changed. On hearts-demo set HEARTS_DEMO=1 and run npm run demo:circle.'
  }
  return null
}

export { FILL_MIN }
