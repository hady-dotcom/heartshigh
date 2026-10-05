import type { Payload, Where } from 'payload'
import { now } from '@/lib/clock'
import { idOf } from '@/lib/ids'
import {
  daysLeftInTrash,
  groupTrash,
  isExpiredTrash,
  isTrashCollection,
  trashCollection,
  trashCutoff,
  trashTitle,
  type TrashItem,
  TRASH_COLLECTIONS,
} from '@/lib/trash'

type Doc = Record<string, unknown> & { id: number }

function collectionOn(payload: Payload, slug: string) {
  return Boolean((payload.config.collections || []).some((collection) => collection.slug === slug))
}

async function findTrashed(payload: Payload, slug: string, where?: Where) {
  return (await payload.find({
    collection: slug as never,
    overrideAccess: true,
    depth: 0,
    limit: 200,
    sort: '-deletedAt',
    trash: true,
    where: {
      and: [{ deletedAt: { exists: true } }, ...(where ? [where] : [])],
    },
  })).docs as Doc[]
}

async function courseIdsForPortal(payload: Payload, portalId: number) {
  const found = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    depth: 0,
    limit: 500,
    pagination: false,
    trash: true,
    where: { portal: { equals: portalId } },
  })
  return (found.docs as Doc[]).map((row) => row.id)
}

async function lessonIdsForPortal(payload: Payload, portalId: number) {
  const courseIds = await courseIdsForPortal(payload, portalId)
  const where: Where = courseIds.length
    ? { or: [{ portal: { equals: portalId } }, { course: { in: courseIds } }] }
    : { portal: { equals: portalId } }
  const found = await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 500,
    pagination: false,
    trash: true,
    where,
  })
  return (found.docs as Doc[]).map((row) => row.id)
}

async function whereForPortal(payload: Payload, slug: string, portalId: number): Promise<Where | null> {
  const spec = trashCollection(slug)
  if (!spec) return { id: { equals: 0 } }
  if (spec.portalField) return { portal: { equals: portalId } }
  if (spec.via === 'course') {
    const ids = await courseIdsForPortal(payload, portalId)
    if (!ids.length) return { id: { equals: 0 } }
    return { course: { in: ids } }
  }
  if (spec.via === 'lesson') {
    const ids = await lessonIdsForPortal(payload, portalId)
    if (!ids.length) return { id: { equals: 0 } }
    return { lesson: { in: ids } }
  }
  return { id: { equals: 0 } }
}

export async function portalOfTrashDoc(payload: Payload, slug: string, doc: Doc): Promise<number | null> {
  const direct = idOf(doc.portal)
  if (direct) return direct
  const spec = trashCollection(slug)
  if (spec?.via === 'course') {
    const courseId = idOf(doc.course)
    if (!courseId) return null
    const course = (await payload.findByID({ collection: 'courses', id: courseId, overrideAccess: true, depth: 0, trash: true }).catch(() => null)) as Doc | null
    return course ? idOf(course.portal) : null
  }
  if (spec?.via === 'lesson') {
    const lessonId = idOf(doc.lesson)
    if (!lessonId) return null
    const lesson = (await payload.findByID({ collection: 'lessons', id: lessonId, overrideAccess: true, depth: 0, trash: true }).catch(() => null)) as Doc | null
    if (!lesson) return null
    const fromLesson = idOf(lesson.portal)
    if (fromLesson) return fromLesson
    return portalOfTrashDoc(payload, 'lessons', lesson)
  }
  return null
}

export async function listTrash(payload: Payload, portalId?: number | null): Promise<TrashItem[]> {
  const items: TrashItem[] = []
  for (const spec of TRASH_COLLECTIONS) {
    if (spec.optional && !collectionOn(payload, spec.slug)) continue
    if (!collectionOn(payload, spec.slug)) continue
    const where = portalId ? await whereForPortal(payload, spec.slug, portalId) : undefined
    if (where && 'id' in where && (where.id as { equals?: number })?.equals === 0) continue
    const docs = await findTrashed(payload, spec.slug, where || undefined)
    for (const doc of docs) {
      items.push({
        id: doc.id,
        collection: spec.slug,
        title: trashTitle(doc, spec.slug),
        deletedAt: typeof doc.deletedAt === 'string' ? doc.deletedAt : doc.deletedAt ? String(doc.deletedAt) : null,
        portalId: idOf(doc.portal),
      })
    }
  }
  return items
}

export function trashGroups(items: TrashItem[]) {
  return groupTrash(items).map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item, daysLeft: daysLeftInTrash(item.deletedAt) })),
  }))
}

export async function loadTrashDoc(payload: Payload, collection: string, id: number) {
  if (!isTrashCollection(collection) || !id) return null
  if (!collectionOn(payload, collection)) return null
  return (await payload.findByID({ collection: collection as never, id, overrideAccess: true, depth: 0, trash: true }).catch(() => null)) as Doc | null
}

/** Soft-delete. Learners stop seeing it. Restore can bring it back. */
export async function moveToTrash(payload: Payload, collection: string, id: number) {
  if (!isTrashCollection(collection)) throw new Error('That kind of row does not go to Recently removed.')
  if (!collectionOn(payload, collection)) throw new Error('That collection is not on this branch yet.')
  const doc = await loadTrashDoc(payload, collection, id)
  if (!doc) throw new Error('That item could not be found.')
  if (doc.deletedAt) return doc
  return (await payload.update({
    collection: collection as never,
    id,
    overrideAccess: true,
    data: { deletedAt: now().toISOString() } as never,
  })) as Doc
}

export async function restoreFromTrash(payload: Payload, collection: string, id: number) {
  if (!isTrashCollection(collection)) throw new Error('That kind of row is not in Recently removed.')
  const doc = await loadTrashDoc(payload, collection, id)
  if (!doc) throw new Error('That item could not be found.')
  if (!doc.deletedAt) return doc
  return (await payload.update({
    collection: collection as never,
    id,
    overrideAccess: true,
    trash: true,
    data: { deletedAt: null } as never,
  })) as Doc
}

/**
 * Permanent delete. Personal-data wipes must use this so a person does not sit in Recently removed.
 */
export async function hardDelete(payload: Payload, collection: string, id: number) {
  await payload.delete({
    collection: collection as never,
    id,
    overrideAccess: true,
    trash: true,
    context: { hardDelete: true },
  })
}

export async function emptyTrash(payload: Payload, items: { collection: string; id: number }[]) {
  let removed = 0
  for (const item of items) {
    if (!isTrashCollection(item.collection)) continue
    const doc = await loadTrashDoc(payload, item.collection, item.id)
    if (!doc?.deletedAt) continue
    await hardDelete(payload, item.collection, item.id)
    removed += 1
  }
  return removed
}

export async function emptyExpiredTrash(payload: Payload, portalId?: number | null) {
  const items = await listTrash(payload, portalId)
  const due = items.filter((item) => isExpiredTrash(item.deletedAt))
  return emptyTrash(payload, due)
}

export { trashCutoff }
