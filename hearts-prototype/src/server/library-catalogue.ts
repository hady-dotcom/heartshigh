import type { Payload, Where } from 'payload'
import { portalDisplayName } from '@/lib/portal-name'
import {
  FILM_PAGE_SIZE,
  LIBRARY_PAGE_SIZE,
  type CourseUse,
  type LibraryTotals,
  type LinkedDoc,
  type RelationField,
  assembleUse,
  joinCodeName,
  linksFromDoc,
  relationshipsOf,
  youtubeIdOf,
} from '@/lib/library-catalogue'
import { type Row, allDocs, clampPage, countDocs, pageCount, pageDocs } from '@/screens/common'

export type CourseStat = {
  films: number
  approved: number
  youtubeId: string | null
}

const PLAYABLE: Where = {
  or: [
    { youtubeId: { not_equals: '' } },
    { vimeoId: { not_equals: '' } },
    { videoProvider: { equals: 'file' } },
  ],
}

/** Talks under five minutes are not counted. Clips use this too. */
const NOT_SHORT: Where = { tooShort: { not_equals: true } }

/** A talk in the bin is not a film learners can open. Clips have no bin flag of their own. */
const COUNTED: Where = { and: [NOT_SHORT, { binned: { not_equals: true } }] }

type FieldList = { name?: string; type?: string; relationTo?: string | string[]; fields?: FieldList[]; tabs?: { fields?: FieldList[] }[] }

function relations(payload: Payload, slug: string): RelationField[] | null {
  const collection = payload.config.collections.find((item) => item.slug === slug)
  if (!collection) return null
  return relationshipsOf(collection.fields as FieldList[])
}

async function countChunked(payload: Payload, collection: string, courseIds: number[], extra?: Where) {
  if (!courseIds.length) return 0
  let total = 0
  const size = 150
  for (let index = 0; index < courseIds.length; index += size) {
    const chunk = courseIds.slice(index, index + size)
    const courseWhere: Where = { course: { in: chunk } }
    total += await countDocs(payload, collection, extra ? { and: [courseWhere, extra] } : courseWhere)
  }
  return total
}

async function masterCourseIds(payload: Payload) {
  const ids: number[] = []
  let page = 1
  for (;;) {
    const found = await pageDocs(payload, 'courses', { origin: { equals: 'master' } }, { page, limit: 200, sort: 'id' })
    ids.push(...found.docs.map((doc) => doc.id))
    if (!found.docs.length || page >= found.pages) break
    page += 1
  }
  return ids
}

export async function libraryTotals(payload: Payload): Promise<LibraryTotals> {
  const [courses, courseIds] = await Promise.all([
    countDocs(payload, 'courses', { origin: { equals: 'master' } }),
    masterCourseIds(payload),
  ])
  const [films, playable, clips] = await Promise.all([
    countChunked(payload, 'lessons', courseIds, COUNTED),
    countChunked(payload, 'lessons', courseIds, { and: [PLAYABLE, COUNTED] }),
    countChunked(payload, 'cuts', courseIds, NOT_SHORT),
  ])
  return { courses, films, playable, clips }
}

async function statFor(payload: Payload, courseId: number): Promise<CourseStat> {
  const [films, approved, thumb] = await Promise.all([
    countDocs(payload, 'lessons', { and: [{ course: { equals: courseId } }, COUNTED] }),
    countDocs(payload, 'cuts', { and: [{ course: { equals: courseId } }, { status: { equals: 'approved' } }, NOT_SHORT] }),
    payload.find({
      collection: 'lessons',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      sort: 'order',
      where: { and: [{ course: { equals: courseId } }, { youtubeId: { not_equals: '' } }, COUNTED] },
    }),
  ])
  return {
    films,
    approved,
    youtubeId: youtubeIdOf((thumb.docs[0] as { youtubeId?: unknown } | undefined)?.youtubeId),
  }
}

export async function libraryPage(payload: Payload, rawPage: string | undefined) {
  const total = await countDocs(payload, 'courses', { origin: { equals: 'master' } })
  const pages = pageCount(total, LIBRARY_PAGE_SIZE)
  const page = clampPage(rawPage, pages)
  const found = await pageDocs(payload, 'courses', { origin: { equals: 'master' } }, { page, limit: LIBRARY_PAGE_SIZE, sort: 'title' })
  const stats = new Map<number, CourseStat>()
  const ids = found.docs.map((course) => course.id)
  for (let index = 0; index < ids.length; index += 4) {
    const slice = ids.slice(index, index + 4)
    const rows = await Promise.all(slice.map(async (id) => [id, await statFor(payload, id)] as const))
    for (const [id, stat] of rows) stats.set(id, stat)
  }
  return { courses: found.docs, stats, page, pages, total }
}

export async function courseFilms(payload: Payload, courseId: number, rawPage: string | undefined) {
  const where: Where = { and: [{ course: { equals: courseId } }, { binned: { not_equals: true } }] }
  const total = await countDocs(payload, 'lessons', where)
  const pages = pageCount(total, FILM_PAGE_SIZE)
  const page = clampPage(rawPage, pages)
  const found = await pageDocs(payload, 'lessons', where, { page, limit: FILM_PAGE_SIZE, sort: 'order' })
  return { lessons: found.docs, page, pages, total }
}

async function safely(run: () => Promise<Row[]>) {
  try {
    return await run()
  } catch {
    return [] as Row[]
  }
}

function courseRels(rels: RelationField[]) {
  return rels.filter((rel) => rel.collections.includes('courses'))
}

function packRelsOf(rels: RelationField[]) {
  return rels.filter((rel) => rel.collections.includes('packs'))
}

function orOf(parts: Where[]): Where | null {
  if (!parts.length) return null
  if (parts.length === 1) return parts[0]
  return { or: parts }
}

function relClause(rel: RelationField, id: number): Where {
  return { [rel.name]: rel.hasMany ? { contains: id } : { equals: id } }
}

function linkedWhere(courseFields: RelationField[], packFields: RelationField[], courseId: number, packIds: number[]): Where | null {
  const parts: Where[] = courseFields.map((rel) => relClause(rel, courseId))
  for (const rel of packFields) {
    for (const packId of packIds) parts.push(relClause(rel, packId))
  }
  return orOf(parts)
}

async function matchingDocs(payload: Payload, slug: string, where: Where | null) {
  if (!where) return [] as Row[]
  return safely(() => allDocs(payload, slug, where, { sort: 'id' }))
}

function toLinked(docs: Row[], rels: RelationField[], labelOf: (doc: Row) => string): LinkedDoc[] {
  return docs.map((doc) => linksFromDoc(doc, rels, labelOf(doc)))
}

/** Join codes, packs and portals that open this course. A missing packs collection does not throw. */
export async function whoUsesCourse(payload: Payload, courseId: number): Promise<CourseUse> {
  const packRels = relations(payload, 'packs')
  const codeRels = relations(payload, 'access-codes') || []
  const adoptionRels = relations(payload, 'adoptions') || []
  const packCourseFields = packRels ? courseRels(packRels) : []
  const packs = packRels ? await matchingDocs(payload, 'packs', orOf(packCourseFields.map((rel) => relClause(rel, courseId)))) : []
  const packDocs = packRels ? toLinked(packs, packRels, (doc) => (typeof doc.title === 'string' && doc.title.trim()) || `Pack ${doc.id}`) : []
  const packIds = packDocs.filter((pack) => pack.courseIds.includes(courseId)).map((pack) => pack.id)

  const codes = codeRels.length
    ? await matchingDocs(payload, 'access-codes', linkedWhere(courseRels(codeRels), packRelsOf(codeRels), courseId, packIds))
    : []
  const adoptions = adoptionRels.length
    ? await matchingDocs(payload, 'adoptions', linkedWhere(courseRels(adoptionRels), packRelsOf(adoptionRels), courseId, packIds))
    : []
  const codeDocs = toLinked(codes, codeRels, (doc) => joinCodeName(doc))
  const adoptionDocs = toLinked(adoptions, adoptionRels, () => '')

  const portalIds = new Set<number>()
  for (const doc of [...packDocs, ...codeDocs, ...adoptionDocs]) if (doc.portalId) portalIds.add(doc.portalId)
  const portals = portalIds.size
    ? await safely(() => allDocs(payload, 'portals', { id: { in: [...portalIds] } }, { sort: 'name' }))
    : []
  return assembleUse(courseId, packDocs, codeDocs, adoptionDocs, portals.map((portal) => ({ id: portal.id, name: portalDisplayName(portal) })))
}
