/**
 * What an access code opens, once course packs are no longer a desk page.
 * A code keeps every course its packs opened, and can also name courses itself.
 * The code string is never part of this copy.
 */

export const LIVE_JOIN_CODES = ['HEARTSDE-7RV9-GFGV', 'HEARTSDE-9QFE-VNEV', 'HEARTSDE-DTRC-99ND'] as const

export type PackCourses = {
  id: number
  title: string
  courses: number[]
}

export type CodeCourses = {
  code: string
  courses: number[]
  packs: number[]
}

export type DoorTag = {
  number: number
  code: string
  title: string
}

export type LibraryCoursePick = {
  id: number
  title: string
  doors: DoorTag[]
}

function uniqueSorted(ids: number[]) {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b)
}

/** Courses sitting on the named packs, in id order, with no duplicates. */
export function coursesFromPacks(packIds: number[], packs: PackCourses[]) {
  const byId = new Map(packs.map((pack) => [pack.id, pack.courses]))
  const ids: number[] = []
  for (const packId of packIds) {
    for (const courseId of byId.get(packId) || []) ids.push(courseId)
  }
  return uniqueSorted(ids)
}

/**
 * Courses a code opens: the ones stored on the code, plus the ones still on its packs.
 * Before the copy, that is the pack list. After the copy, both lists match, so the result does not change.
 */
export function coursesOpenedByCode(code: { courses?: number[]; packs?: number[] }, packs: PackCourses[]) {
  return uniqueSorted([...(code.courses || []), ...coursesFromPacks(code.packs || [], packs)])
}

/**
 * The course list to store on the code. The code string is returned unchanged.
 * Packs named Jibril sittings and Starter map keep their courses on every code that uses them.
 */
export function coursesAfterPackCopy(code: CodeCourses, packs: PackCourses[]) {
  return {
    code: code.code,
    courses: coursesOpenedByCode(code, packs),
  }
}

/** Doors W1–W20 that are tagged on at least one course, with the courses in each door. */
export function doorQuickPicks(courses: LibraryCoursePick[]) {
  const map = new Map<number, DoorTag & { courseIds: number[] }>()
  for (const course of courses) {
    for (const door of course.doors) {
      if (door.number < 1 || door.number > 20) continue
      const row = map.get(door.number) || { ...door, courseIds: [] }
      if (!row.courseIds.includes(course.id)) row.courseIds.push(course.id)
      map.set(door.number, row)
    }
  }
  return [...map.values()].sort((a, b) => a.number - b.number)
}

function joinNames(names: string[]) {
  const clean = names.map((name) => name.trim()).filter(Boolean)
  const shown = clean.slice(0, 4)
  const more = clean.length - shown.length
  const list = shown.join(', ')
  return more > 0 ? `${list}, and ${more} more` : list
}

/** One plain line: which portals and codes can open this course. */
export function openedByLine(codes: string[], portals: string[]) {
  const portalBit = joinNames(portals)
  const codeBit = joinNames(codes)
  if (!portalBit && !codeBit) return 'No code or portal opens this yet.'
  const parts: string[] = []
  if (portalBit) {
    parts.push(portals.length === 1 ? `${portalBit} can open this course` : `These portals can open this course: ${portalBit}`)
  }
  if (codeBit) {
    parts.push(codes.length === 1 ? `This code can open it: ${codeBit}` : `These codes can open it: ${codeBit}`)
  }
  return `${parts.join('. ')}.`
}

export type OpenerIndex = Map<number, { codes: string[]; portals: string[] }>

/** Which codes and portals open each course, from codes, packs and portal links. */
export function indexOpeners(input: {
  codes: { code: string; label?: string | null; courses: number[]; packs: number[] }[]
  packs: PackCourses[]
  portals: { id: number; name: string }[]
  adoptions: { portalId: number; kind?: string | null; courseId?: number | null; packId?: number | null }[]
}): OpenerIndex {
  const packCourses = new Map(input.packs.map((pack) => [pack.id, pack.courses]))
  const portalName = new Map(input.portals.map((portal) => [portal.id, portal.name]))
  const result: OpenerIndex = new Map()
  const ensure = (courseId: number) => {
    let row = result.get(courseId)
    if (!row) {
      row = { codes: [], portals: [] }
      result.set(courseId, row)
    }
    return row
  }
  for (const code of input.codes) {
    const name = (code.label || '').trim() || code.code
    if (!name) continue
    for (const courseId of coursesOpenedByCode(code, input.packs)) {
      const row = ensure(courseId)
      if (!row.codes.includes(name)) row.codes.push(name)
    }
  }
  for (const adoption of input.adoptions) {
    const name = portalName.get(adoption.portalId)
    if (!name) continue
    const courseIds =
      adoption.kind === 'course' && adoption.courseId
        ? [adoption.courseId]
        : adoption.kind === 'pack' && adoption.packId
          ? packCourses.get(adoption.packId) || []
          : []
    for (const courseId of courseIds) {
      const row = ensure(courseId)
      if (!row.portals.includes(name)) row.portals.push(name)
    }
  }
  return result
}
