import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { peopleCsv, peopleExportGuard, type PeopleExportRow } from '@/lib/people-export'
import { idOf, portalIdOf } from '@/lib/ids'
import { addPeopleToClass, classesInPortal } from './classes'
import type { SessionUser } from './context'

type Doc = Record<string, unknown> & { id: number }

export async function peopleInScope(payload: Payload, portalId?: number | null) {
  const where = portalId ? { 'tenants.tenant': { equals: portalId } } : undefined
  const found = await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 1,
    limit: 500,
    sort: 'name',
    where,
  })
  return found.docs as unknown as (SessionUser & Doc)[]
}

export async function buildPeopleExport(
  payload: Payload,
  portalId: number | null,
): Promise<{ rows: PeopleExportRow[]; csv: string; blocked: string | null }> {
  const people = (await peopleInScope(payload, portalId)).filter((person) => person.role !== 'master')
  const codes = new Map<number, string>()
  const codeIds = [...new Set(people.map((person) => idOf(person.accessCode)).filter((id): id is number => Boolean(id)))]
  if (codeIds.length) {
    const found = await payload.find({ collection: 'access-codes', overrideAccess: true, depth: 0, limit: 200, where: { id: { in: codeIds } } })
    for (const row of found.docs as unknown as Doc[]) codes.set(row.id, String(row.code || ''))
  }
  const completions = portalId
    ? ((await payload.find({ collection: 'completions', overrideAccess: true, depth: 0, limit: 2000, where: { portal: { equals: portalId } } })).docs as unknown as Doc[])
    : []
  const watches = portalId
    ? ((await payload.find({ collection: 'watch-sessions', overrideAccess: true, depth: 0, limit: 2000, where: { portal: { equals: portalId } } })).docs as unknown as Doc[])
    : []
  const classes = portalId ? await classesInPortal(payload, portalId) : []
  const classOf = new Map<number, string>()
  for (const row of classes) {
    for (const person of [...((row.learners as unknown[]) || []), ...((row.teachers as unknown[]) || [])]) {
      const id = idOf(person)
      if (id) classOf.set(id, String(row.name || ''))
    }
  }

  const rows: PeopleExportRow[] = people.map((person) => {
    const extra = ((person.extraCourses as unknown[]) || []).map((item) => idOf(item)).filter(Boolean)
    const listed = Array.isArray(person.courseList) ? person.courseList.map((item) => Number(item)).filter(Boolean) : []
    const courseCount = new Set([...extra, ...listed]).size
    const done = completions.filter((row) => idOf(row.user) === person.id).length
    const lastWatch = watches
      .filter((row) => idOf(row.user) === person.id)
      .map((row) => String(row.createdAt || ''))
      .sort()
      .at(-1)
    return {
      name: person.name || '',
      email: person.email,
      role: person.role,
      code: codes.get(idOf(person.accessCode) || 0) || '',
      joined: (person.joinedAt || person.createdAt || '').toString().slice(0, 10),
      lastSeen: (lastWatch || person.createdAt || '').toString().slice(0, 10),
      courses: String(courseCount),
      progress: String(done),
      consent: '—',
      className: classOf.get(person.id) || '',
    }
  })
  const blocked = peopleExportGuard(rows)
  return { rows, csv: blocked ? '' : peopleCsv(rows), blocked }
}

export async function createImportedUser(
  payload: Payload,
  input: {
    portal: number
    name: string
    email: string
    role: 'learner' | 'teacher' | 'portal-admin'
    codeId: number
    courseList: number[]
    classId?: number
    password: string
  },
) {
  const existing = await payload.find({ collection: 'users', overrideAccess: true, limit: 1, where: { email: { equals: input.email } } })
  if (existing.docs.length) return { ok: false as const, error: 'That email already has an account.' }
  const created = await payload.create({
    collection: 'users',
    overrideAccess: true,
    context: { skipAudit: true },
    data: {
      email: input.email,
      password: input.password,
      name: input.name,
      role: input.role,
      accessCode: input.codeId,
      courseList: input.courseList,
      tenants: [{ tenant: input.portal }],
      onboarded: input.role !== 'learner',
      joinedAt: now().toISOString(),
    } as never,
  })
  if (input.classId) {
    if (input.role === 'teacher') await addPeopleToClass(payload, input.classId, [], [created.id])
    else await addPeopleToClass(payload, input.classId, [created.id], [])
  }
  return { ok: true as const, id: created.id }
}

export function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 10; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export function staffMayTouchPerson(actor: SessionUser, person: SessionUser) {
  if (actor.role === 'master') return person.role !== 'master'
  if (actor.role === 'portal-admin') return portalIdOf(actor) === portalIdOf(person) && person.role !== 'master'
  if (actor.role === 'teacher') return portalIdOf(actor) === portalIdOf(person) && person.role === 'learner'
  return false
}
