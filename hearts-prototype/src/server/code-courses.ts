import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { COPY_PACK_COURSES_SQL, MISSING_PACK_COURSES_SQL } from '@/lib/code-courses-sql'
import { capitalAfterColon, doorByNumber, doorCode, parseDoor, type Door } from '@/lib/doors'
import {
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

type SqlResult = { rowsAffected?: number; rowCount?: number | null; rows?: Record<string, unknown>[] }

type CopyDb = {
  name?: string
  client?: { execute: (statement: string) => Promise<SqlResult> }
  drizzle?: { execute?: (query: unknown) => Promise<SqlResult> }
}

async function runSql(payload: Payload, statement: string) {
  const db = payload.db as unknown as CopyDb
  const result = db.name === 'postgres'
    ? await db.drizzle?.execute?.(sql.raw(statement))
    : await db.client?.execute(statement)
  if (!result) throw new Error('The database could not copy pack courses onto access codes.')
  return result
}

function rowsOf(result: SqlResult) {
  if (Array.isArray(result.rows)) return result.rows
  if (Array.isArray(result)) return result as Record<string, unknown>[]
  return []
}

function insertMissingCourse(parentId: number, courseId: number) {
  return `
INSERT INTO "access_codes_rels" ("order", "parent_id", "path", "courses_id")
SELECT COALESCE((SELECT MAX("order") FROM "access_codes_rels" WHERE "parent_id" = ${parentId}), 0) + 1,
       ${parentId}, 'courses', ${courseId}
WHERE NOT EXISTS (
  SELECT 1 FROM "access_codes_rels" already
  WHERE already."parent_id" = ${parentId}
    AND already."path" = 'courses'
    AND already."courses_id" = ${courseId}
);
`
}

/**
 * Store each pack's courses on the codes that use that pack.
 * Stored courses become the ones already on the code plus every course its packs open.
 * A short read of a relationship list cannot drop a course, and nothing already stored is removed.
 * Does not change the code string, and does not remove the pack link.
 * Safe to run more than once.
 */
export async function copyPackCoursesOntoCodes(payload: Payload) {
  const result = await runSql(payload, COPY_PACK_COURSES_SQL)
  const missing = rowsOf(await runSql(payload, MISSING_PACK_COURSES_SQL))
  let repaired = 0
  for (const row of missing) {
    const parentId = Number(row.parent_id ?? row.parentId)
    const courseId = Number(row.courses_id ?? row.coursesId)
    if (!Number.isInteger(parentId) || parentId <= 0 || !Number.isInteger(courseId) || courseId <= 0) continue
    const inserted = await runSql(payload, insertMissingCourse(parentId, courseId))
    repaired += Number(inserted.rowsAffected ?? inserted.rowCount ?? 0)
  }
  const counted = result as SqlResult
  const updated = Number(counted.rowsAffected ?? counted.rowCount ?? 0) + repaired
  const codes = await payload.count({ collection: 'access-codes', overrideAccess: true })
  return { updated, codes: codes.totalDocs }
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
