import type { Payload } from 'payload'
import { offerJoinedNotice, offerOnCodeNotice } from '@/lib/course-offer'
import { idOf } from '@/lib/ids'
import { coursesOpenedByCode, type PackCourses } from '@/lib/code-courses'
import { adoptedCourseIds } from './context'
import { giveCourseToCodeHolders, openedCourseIdsForCode } from './code-courses'
import { ensurePackAdopted } from './pack-adopt'

type CodeRow = { id: number; code?: string; label?: string; role?: string; packs?: unknown[]; courses?: unknown[] }
type PackRow = { id: number; title?: string; owner?: string; portal?: unknown; courses?: unknown[] }

export type CodeChoice = {
  id: number
  label: string
  packId: number
  packTitle: string
  packOwner: string
  hasCourse: boolean
}

function idsOf(value: unknown) {
  return ((value as unknown[]) || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
}

/** Learner codes in this portal, and whether each one's course set already includes the course. */
export async function learnerCodeChoices(payload: Payload, portalId: number, courseId: number): Promise<CodeChoice[]> {
  const codes = (await payload.find({
    collection: 'access-codes',
    overrideAccess: true,
    depth: 0,
    limit: 200,
    sort: 'code',
    where: { and: [{ portal: { equals: portalId } }, { role: { equals: 'learner' } }] },
  })).docs as unknown as CodeRow[]
  const packIds = [...new Set(codes.flatMap((code) => idsOf(code.packs)))]
  const packs = packIds.length
    ? ((await payload.find({ collection: 'packs', overrideAccess: true, depth: 0, limit: packIds.length, where: { id: { in: packIds } } })).docs as unknown as PackRow[])
    : []
  const packList: PackCourses[] = packs.map((pack) => ({ id: pack.id, title: String(pack.title || ''), courses: idsOf(pack.courses) }))
  return codes.map((code) => {
    const pack = packs.find((row) => row.id === idsOf(code.packs)[0])
    const label = String(code.label || '').trim() || String(code.code || `Code ${code.id}`)
    const opened = coursesOpenedByCode({ courses: idsOf(code.courses), packs: idsOf(code.packs) }, packList)
    return {
      id: code.id,
      label,
      packId: pack?.id || 0,
      packTitle: String(pack?.title || ''),
      packOwner: String(pack?.owner || ''),
      hasCourse: opened.includes(courseId),
    }
  })
}

async function courseInPortal(payload: Payload, portalId: number, courseId: number) {
  const course = await payload.findByID({ collection: 'courses', id: courseId, overrideAccess: true, depth: 0 }).catch(() => null) as { id: number; title?: string; origin?: string; portal?: unknown } | null
  if (!course) return { error: 'That course could not be found.' }
  const local = course.origin === 'local' && idOf(course.portal) === portalId
  const adopted = (await adoptedCourseIds(payload, portalId)).includes(courseId)
  if (!local && !adopted && course.origin !== 'master') return { error: 'That course is not in this portal.' }
  if (!local && !adopted && course.origin === 'master') return { error: 'Link that library course into this portal before you put it on a code.' }
  return { course }
}

/** Puts the course on a learner code's set. A library set is copied into a portal set so the shared library stays as it is. */
export async function addCourseToCode(payload: Payload, input: { portalId: number; courseId: number; codeId: number; giveJoined: boolean }): Promise<{ error?: string; notice?: string }> {
  const found = await courseInPortal(payload, input.portalId, input.courseId)
  if ('error' in found && found.error) return { error: found.error }
  const course = found.course!
  const code = await payload.findByID({ collection: 'access-codes', id: input.codeId, overrideAccess: true, depth: 0 }).catch(() => null) as CodeRow & { portal?: unknown } | null
  if (!code || idOf(code.portal) !== input.portalId || code.role !== 'learner') return { error: 'Choose a learner code from this portal.' }
  const packId = idsOf(code.packs)[0]
  const pack = packId ? await payload.findByID({ collection: 'packs', id: packId, overrideAccess: true, depth: 0 }).catch(() => null) as PackRow | null : null
  const title = String(course.title || 'This course')
  const codeLabel = String(code.label || '').trim() || String(code.code || 'that code')
  const opened = await openedCourseIdsForCode(payload, code)
  if (!opened.includes(input.courseId)) {
    await payload.update({
      collection: 'access-codes',
      id: code.id,
      overrideAccess: true,
      data: { courses: [...opened, input.courseId] },
    })
  }
  if (pack?.owner === 'portal' && idOf(pack.portal) === input.portalId) {
    const existing = idsOf(pack.courses)
    if (!existing.includes(input.courseId)) {
      await payload.update({ collection: 'packs', id: pack.id, overrideAccess: true, data: { courses: [...existing, input.courseId] } })
    }
    await ensurePackAdopted(payload, input.portalId, pack.id)
  }
  const given = input.giveJoined ? await giveCourseToCodeHolders(payload, code.id, [input.courseId]) : { updated: 0, live: 0 }
  return { notice: offerOnCodeNotice({ course: title, code: codeLabel, copied: false, given: given.updated, live: given.live }) }
}

/** Gives the course to learners who have already joined, without changing any code. */
export async function giveCourseToJoinedLearners(payload: Payload, portalId: number, courseId: number): Promise<{ error?: string; notice?: string; count?: number }> {
  const found = await courseInPortal(payload, portalId, courseId)
  if ('error' in found && found.error) return { error: found.error }
  const people = await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 500,
    where: { and: [{ role: { equals: 'learner' } }, { 'tenants.tenant': { equals: portalId } }] },
  })
  let count = 0
  for (const person of people.docs as unknown as { id: number; extraCourses?: unknown[] }[]) {
    const existing = idsOf(person.extraCourses)
    if (existing.includes(courseId)) continue
    await payload.update({ collection: 'users', id: person.id, overrideAccess: true, data: { extraCourses: [...existing, courseId] } })
    count += 1
  }
  return { notice: offerJoinedNotice(count), count }
}
