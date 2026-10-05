import { doorOfClause, type Door } from './doors'
import { matchDoorTalk } from './first-course'

export type DoorCut = {
  bestClause?: unknown
  status?: unknown
  placeholder?: unknown
  start?: unknown
  end?: unknown
  [key: string]: unknown
}

/** The clause that should place a talk: the carrier placeholder, else the majority of approved cuts. */
export function primaryBestClause(cuts: DoorCut[]): number {
  const own = cuts.filter((cut) => Number(cut.bestClause))
  const placeholder = own.find((cut) => cut.placeholder)
  if (placeholder) return Number(placeholder.bestClause)
  const approved = own.filter((cut) => cut.status === 'approved')
  const pool = approved.length ? approved : own
  if (!pool.length) return 0
  const groups = new Map<number, { count: number; span: number }>()
  for (const cut of pool) {
    const clause = Number(cut.bestClause)
    const span = Math.max(0, Number(cut.end || 0) - Number(cut.start || 0))
    const cur = groups.get(clause) || { count: 0, span: 0 }
    groups.set(clause, { count: cur.count + 1, span: cur.span + span })
  }
  return [...groups.entries()].sort((a, b) => b[1].count - a[1].count || b[1].span - a[1].span)[0]?.[0] || 0
}

/** Prefer a unique title match so a dua is not parked under an early mistagged cut. */
export function lessonDoor(input: { lessonTitle: string; courseTitle: string; cuts: DoorCut[]; doors: Door[] }): Door | null {
  const titled = input.doors.filter((door) => matchDoorTalk(door.number, { title: input.lessonTitle, courseTitle: input.courseTitle }))
  if (titled.length === 1) return titled[0]
  return doorOfClause(primaryBestClause(input.cuts), input.doors)
}

export function showCourseDoorHeading(input: {
  lessonCount: number
  groupCount: number
  doorMatchesTitle?: boolean
}) {
  if (input.groupCount !== 1) return input.groupCount > 1
  if (input.lessonCount <= 1) return false
  if (input.doorMatchesTitle === false) return false
  return true
}

/** Hide a lone W-code when the course name does not sit in that door (mistagged early cuts). */
export function courseDoorHeadingVisible(
  groups: { door: Door | null; items: Array<{ title?: unknown } & Record<string, unknown>> }[],
  courseTitle: string,
) {
  const only = groups.length === 1 ? groups[0] : null
  const doorMatchesTitle = Boolean(
    only?.door &&
      only.items.some((item) => matchDoorTalk(only.door!.number, { title: String(item.title || ''), courseTitle })),
  )
  return showCourseDoorHeading({
    lessonCount: groups.reduce((sum, group) => sum + group.items.length, 0),
    groupCount: groups.length,
    doorMatchesTitle,
  })
}
