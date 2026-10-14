import type { Payload } from 'payload'
import { capitalAfterColon, doorByNumber, doorCode, parseDoor, type Door } from '@/lib/doors'
import {
  coursesAfterPackCopy,
  coursesOpenedByCode,
  indexOpeners,
  openedByLine,
  type LibraryCoursePick,
  type PackCourses,
} from '@/lib/code-courses'
import type { DoorGroup } from '@/lib/curriculum-groups'
import { idOf } from '@/lib/ids'
import { portalDisplayName } from '@/lib/portal-name'
import { groupThese, listDocs } from './curriculum'
import { loadDoors } from './doors'

type Doc = Record<string, unknown> & { id: number }

function ids(value: unknown) {
  return ((value as unknown[]) || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
}

function packRows(docs: Doc[]): PackCourses[] {
  return docs.map((pack) => ({
    id: pack.id,
    title: String(pack.title || ''),
    courses: ids(pack.courses),
  }))
}

/** Add courses to people who already joined with this code and keep a saved list. */
export async function giveCourseToCodeHolders(payload: Payload, codeId: number, courseIds: number[]) {
  const unique = [...new Set(courseIds.filter((id) => id > 0))]
  if (!unique.length) return { updated: 0, live: 0 }
  const holders = await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 500,
    where: { accessCode: { equals: codeId } },
  })
  let updated = 0
  let live = 0
  for (const holder of holders.docs as { id: number; courseList?: unknown }[]) {
    const list = Array.isArray(holder.courseList) ? holder.courseList.map((item) => Number(item)).filter((id) => id > 0) : null
    if (!list) {
      live += 1
      continue
    }
    const fresh = [...new Set([...list, ...unique])]
    if (fresh.length === list.length) continue
    await payload.update({ collection: 'users', id: holder.id, overrideAccess: true, data: { courseList: fresh } })
    updated += 1
  }
  return { updated, live }
}

/** Courses this code opens right now: its own list, plus anything still on its packs. */
export async function openedCourseIdsForCode(payload: Payload, code: { courses?: unknown; packs?: unknown }) {
  const packIds = ids(code.packs)
  const packs = packIds.length
    ? ((await payload.find({
        collection: 'packs',
        overrideAccess: true,
        depth: 0,
        limit: packIds.length,
        where: { id: { in: packIds } },
      })).docs as unknown as Doc[])
    : []
  return coursesOpenedByCode({ courses: ids(code.courses), packs: packIds }, packRows(packs))
}

/**
 * Store each pack's courses on the codes that use that pack.
 * Does not change the code string, and does not remove the pack link.
 * Safe to run more than once.
 */
export async function copyPackCoursesOntoCodes(payload: Payload) {
  const [codes, packs] = await Promise.all([
    listDocs(payload, 'access-codes'),
    listDocs(payload, 'packs'),
  ])
  const packList = packRows(packs)
  let updated = 0
  for (const code of codes) {
    const current = [...ids(code.courses)].sort((a, b) => a - b)
    const next = coursesAfterPackCopy(
      { code: String(code.code || ''), courses: current, packs: ids(code.packs) },
      packList,
    )
    if (next.courses.length === current.length && next.courses.every((id, index) => id === current[index])) continue
    await payload.update({
      collection: 'access-codes',
      id: code.id,
      overrideAccess: true,
      data: { courses: next.courses },
    })
    updated += 1
  }
  return { updated, codes: codes.length }
}

function doorTag(number: number, doors: Door[]) {
  const found = doorByNumber(number, doors)
  const title = found ? capitalAfterColon(found.title).split(':')[0].trim() : doorCode(number)
  return { number, code: doorCode(number), title }
}

/** Library courses, with any Jibril door tagged on their talks. */
export async function loadLibraryPicker(payload: Payload): Promise<LibraryCoursePick[]> {
  const courseDocs = await listDocs(payload, 'courses', { and: [{ origin: { equals: 'master' } }, { importable: { not_equals: false } }] })
  const courses = courseDocs
    .map((course) => ({ id: course.id, title: String(course.title || 'Untitled course'), summary: String(course.summary || '') }))
    .sort((a, b) => a.title.localeCompare(b.title, 'en'))
  if (!courses.length) return []
  const ids = courses.map((course) => course.id)
  const [groups, doors, lessons] = await Promise.all([
    groupThese(payload, courses),
    loadDoors(payload),
    listDocs(payload, 'lessons', { course: { in: ids } }),
  ])
  const tagged = new Map<number, Set<number>>()
  const add = (courseId: number, number: number | null | undefined) => {
    if (!courseId || !number || number < 1 || number > 20) return
    const set = tagged.get(courseId) || new Set<number>()
    set.add(number)
    tagged.set(courseId, set)
  }
  for (const group of groups) {
    for (const course of group.courses) {
      add(course.id, course.door)
      for (const other of course.otherDoors) add(course.id, other.number)
    }
  }
  for (const lesson of lessons) {
    const courseId = idOf(lesson.course)
    const number = parseDoor(lesson.jibrilSection)
    if (courseId) add(courseId, number)
  }
  return courses.map((course) => ({
    id: course.id,
    title: course.title,
    doors: [...(tagged.get(course.id) || [])].sort((a, b) => a - b).map((number) => doorTag(number, doors)),
  }))
}

/** The door a course is filed under, or Other when its talks are not tagged. */
export function primaryDoorCode(groups: DoorGroup[], courseId: number) {
  for (const group of groups) {
    if (group.courses.some((course) => course.id === courseId)) return group.code
  }
  return 'Other'
}

/** Plain "who can open this" lines for every course a code or portal reaches. */
export async function openedByLines(payload: Payload) {
  const [codes, packs, portals, adoptions] = await Promise.all([
    listDocs(payload, 'access-codes'),
    listDocs(payload, 'packs'),
    listDocs(payload, 'portals'),
    listDocs(payload, 'adoptions'),
  ])
  const index = indexOpeners({
    codes: codes.map((code) => ({
      code: String(code.code || ''),
      label: typeof code.label === 'string' ? code.label : '',
      courses: ids(code.courses),
      packs: ids(code.packs),
    })),
    packs: packRows(packs),
    portals: portals.map((portal) => ({ id: portal.id, name: portalDisplayName(portal) })),
    adoptions: adoptions.map((row) => ({
      portalId: idOf(row.portal) || 0,
      kind: typeof row.kind === 'string' ? row.kind : '',
      courseId: idOf(row.course),
      packId: idOf(row.pack),
    })),
  })
  const lines = new Map<number, string>()
  for (const [courseId, row] of index) lines.set(courseId, openedByLine(row.codes, row.portals))
  return lines
}
