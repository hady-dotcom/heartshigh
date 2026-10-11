import type { Payload, Where } from 'payload'
import { idList } from './context'

type Doc = { id: number; courseList?: unknown; packs?: unknown[]; courses?: unknown[] }

async function allDocs(payload: Payload, collection: string, where: Where) {
  const docs: Doc[] = []
  let page = 1
  for (;;) {
    const found = await payload.find({ collection: collection as 'users', overrideAccess: true, depth: 0, limit: 200, page, where })
    docs.push(...(found.docs as unknown as Doc[]))
    if (!found.hasNextPage || page > 40) break
    page += 1
  }
  return docs
}

/**
 * Adds courses to learners who already hold a pack that contains them, when their course list is a
 * saved snapshot. Learners with no snapshot read the pack live and are counted, not rewritten.
 */
export async function giveCourseToPackHolders(payload: Payload, courseIds: number[]) {
  const uniqueCourses = [...new Set(courseIds.filter((id) => id > 0))]
  const updatedUsers = new Set<number>()
  const liveUsers = new Set<number>()
  for (const courseId of uniqueCourses) {
    const packs = await allDocs(payload, 'packs', { courses: { in: [courseId] } })
    for (const pack of packs) {
      const codes = await allDocs(payload, 'access-codes', { packs: { in: [pack.id] } })
      const or: Where[] = []
      if (codes.length) or.push({ accessCode: { in: codes.map((code) => code.id) } })
      or.push({ extraPacks: { in: [pack.id] } })
      const holders = await allDocs(payload, 'users', { and: [{ role: { equals: 'learner' } }, { or }] })
      for (const holder of holders) {
        const list = idList(holder.courseList)
        if (!list) {
          liveUsers.add(holder.id)
          continue
        }
        if (list.includes(courseId)) continue
        const fresh = [...list, courseId]
        await payload.update({ collection: 'users', id: holder.id, overrideAccess: true, data: { courseList: fresh } as never })
        holder.courseList = fresh
        updatedUsers.add(holder.id)
      }
    }
  }
  return { updated: updatedUsers.size, live: liveUsers.size, users: [...updatedUsers] }
}

export async function packsContaining(payload: Payload, courseIds: number[]) {
  if (!courseIds.length) return []
  return allDocs(payload, 'packs', { courses: { in: courseIds } })
}
