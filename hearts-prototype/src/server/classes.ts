import type { Payload } from 'payload'
import { classColour } from '@/lib/class-palette'
import { idOf } from '@/lib/ids'

type Doc = Record<string, unknown> & { id: number }

export async function classesInPortal(payload: Payload, portalId: number) {
  const found = await payload.find({
    collection: 'classes' as never,
    overrideAccess: true,
    depth: 0,
    limit: 200,
    sort: 'name',
    where: { portal: { equals: portalId } },
  })
  return found.docs as Doc[]
}

export async function classById(payload: Payload, id: number) {
  if (!id) return null
  return (await payload.findByID({ collection: 'classes' as never, id, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null
}

function idList(value: unknown) {
  if (!Array.isArray(value)) return [] as number[]
  return value.map((item) => idOf(item)).filter((id): id is number => Boolean(id))
}

export async function addPeopleToClass(payload: Payload, classId: number, learnerIds: number[], teacherIds: number[] = []) {
  const row = await classById(payload, classId)
  if (!row) return null
  const learners = [...new Set([...idList(row.learners), ...learnerIds])]
  const teachers = [...new Set([...idList(row.teachers), ...teacherIds])]
  return payload.update({
    collection: 'classes' as never,
    id: classId,
    overrideAccess: true,
    data: { learners, teachers } as never,
  })
}

export async function removePeopleFromClass(payload: Payload, classId: number, personIds: number[]) {
  const row = await classById(payload, classId)
  if (!row) return null
  const drop = new Set(personIds)
  return payload.update({
    collection: 'classes' as never,
    id: classId,
    overrideAccess: true,
    data: {
      learners: idList(row.learners).filter((id) => !drop.has(id)),
      teachers: idList(row.teachers).filter((id) => !drop.has(id)),
    } as never,
  })
}

export async function createClass(
  payload: Payload,
  input: { portal: number; name: string; colour?: string; teachers?: number[]; learners?: number[]; note?: string },
) {
  return payload.create({
    collection: 'classes' as never,
    overrideAccess: true,
    data: {
      name: input.name.trim(),
      colour: classColour(input.colour),
      teachers: input.teachers || [],
      learners: input.learners || [],
      note: input.note || undefined,
      portal: input.portal,
    } as never,
  }) as Promise<{ id: number }>
}

export async function joinRuleForCode(payload: Payload, codeId: number) {
  const found = await payload.find({
    collection: 'class-join-rules' as never,
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { accessCode: { equals: codeId } },
  })
  return (found.docs[0] as Doc | undefined) || null
}

export async function setJoinRule(payload: Payload, portalId: number, codeId: number, classId: number | null) {
  const existing = await joinRuleForCode(payload, codeId)
  if (!classId) {
    if (existing) await payload.delete({ collection: 'class-join-rules' as never, id: existing.id, overrideAccess: true })
    return null
  }
  if (existing) {
    return payload.update({
      collection: 'class-join-rules' as never,
      id: existing.id,
      overrideAccess: true,
      data: { class: classId, accessCode: codeId, portal: portalId } as never,
    })
  }
  return payload.create({
    collection: 'class-join-rules' as never,
    overrideAccess: true,
    data: { class: classId, accessCode: codeId, portal: portalId } as never,
  })
}

/** Called from the Users afterChange hook in payload.config.ts when someone joins. */
export async function assignJoinerToClass(payload: Payload, user: { id: number; accessCode?: unknown; role?: string | null }) {
  const codeId = idOf(user.accessCode)
  if (!codeId) return
  const rule = await joinRuleForCode(payload, codeId)
  const classId = idOf(rule?.class)
  if (!classId) return
  if (user.role === 'teacher') await addPeopleToClass(payload, classId, [], [user.id])
  else await addPeopleToClass(payload, classId, [user.id], [])
}

export function classGroups(classes: Doc[], people: { id: number; name?: string | null; role?: string | null }[]) {
  const byClass = classes.map((row) => {
    const learnerIds = new Set(idList(row.learners))
    const teacherIds = new Set(idList(row.teachers))
    const learners = people.filter((person) => learnerIds.has(person.id))
    const teachers = people.filter((person) => teacherIds.has(person.id))
    return { class: row, learners, teachers, count: learners.length + teachers.length }
  })
  const assigned = new Set(byClass.flatMap((group) => [...group.learners, ...group.teachers].map((person) => person.id)))
  const ungrouped = people.filter((person) => person.role === 'learner' && !assigned.has(person.id))
  return { groups: byClass, ungrouped }
}
