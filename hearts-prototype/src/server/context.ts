import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { idOf, portalIdOf } from '@/lib/ids'

export type SessionUser = {
  id: number
  email: string
  name?: string | null
  role: 'master' | 'portal-admin' | 'teacher' | 'learner'
  tenants?: { tenant?: unknown }[]
  accessCode?: unknown
  extraPacks?: unknown[]
  extraCourses?: unknown[]
  courseList?: unknown
  audience?: string | null
  seenWelcome?: boolean | null
  shareWatch?: boolean | null
  onboarded?: boolean | null
  startingClause?: number | null
  createdAt?: string
}

export type PortalDoc = {
  id: number
  name: string
  slug: string
  kind?: string | null
  welcome?: string | null
  colour?: string | null
  watchHistoryOptIn?: boolean | null
  organisationName?: string | null
  description?: string | null
  closed?: boolean | null
  logoUrl?: string | null
  showOthersAnswers?: boolean | null
  notificationEmails?: string | null
  theme?: string | null
  calendarUrl?: string | null
  learnerWelcomeUrl?: string | null
  learnerIntroUrl?: string | null
  teacherWelcomeUrl?: string | null
  teacherIntroUrl?: string | null
  learnerLabel?: string | null
  teacherLabel?: string | null
  wizardDone?: boolean | null
}

export async function getPayloadClient() {
  return getPayload({ config })
}

export async function getSession(): Promise<{ payload: Payload; user: SessionUser | null }> {
  const payload = await getPayloadClient()
  const result = await payload.auth({ headers: await headers() })
  if (!result.user) return { payload, user: null }
  const full = await payload.findByID({
    collection: 'users',
    id: result.user.id,
    overrideAccess: true,
    depth: 0,
  })
  return { payload, user: full as unknown as SessionUser }
}

export async function visibleCourseIds(payload: Payload, user: SessionUser): Promise<number[]> {
  if (user.role === 'master') {
    const all = await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 500 })
    return all.docs.map((doc) => doc.id)
  }
  const portal = portalIdOf(user)
  if (!portal) return []
  if (user.role === 'portal-admin' || user.role === 'teacher') {
    const local = await payload.find({
      collection: 'courses',
      overrideAccess: true,
      depth: 0,
      limit: 200,
      where: { portal: { equals: portal } },
    })
    const adopted = await adoptedCourseIds(payload, portal)
    return [...new Set([...local.docs.map((doc) => doc.id), ...adopted])]
  }
  const granted = await learnerCourseIds(payload, user)
  const adopted = new Set(await adoptedCourseIds(payload, portal))
  const courses = granted.length
    ? await payload.find({
        collection: 'courses',
        overrideAccess: true,
        depth: 0,
        limit: 200,
        where: { id: { in: granted } },
      })
    : { docs: [] }
  return courses.docs
    .filter((course) => {
      const doc = course as { id: number; origin?: string; portal?: unknown; visibility?: string }
      if (doc.visibility === 'draft') return false
      if (doc.origin === 'local') return idOf(doc.portal) === portal
      return adopted.has(doc.id)
    })
    .map((course) => course.id)
}

export function idList(value: unknown): number[] | null {
  if (value == null || value === '') return null
  let raw = value
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!Array.isArray(raw)) return null
  return raw.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0)
}

export async function coursesInPacks(payload: Payload, packIds: number[]) {
  if (!packIds.length) return []
  const packs = await payload.find({
    collection: 'packs',
    overrideAccess: true,
    depth: 0,
    limit: 100,
    where: { id: { in: packIds } },
  })
  const courseIds: number[] = []
  for (const pack of packs.docs as { courses?: unknown[] }[]) {
    for (const course of pack.courses || []) {
      const id = idOf(course)
      if (id) courseIds.push(id)
    }
  }
  return [...new Set(courseIds)]
}

export async function learnerCourseIds(payload: Payload, user: SessionUser) {
  const snapshot = idList(user.courseList)
  const fromCode = snapshot ?? (await grantedCourseIds(payload, user))
  const extras = (user.extraCourses || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
  return [...new Set([...fromCode, ...extras])]
}

async function grantedCourseIds(payload: Payload, user: SessionUser) {
  const packIds = new Set<number>()
  const codeId = idOf(user.accessCode)
  if (codeId) {
    const code = await payload.findByID({ collection: 'access-codes', id: codeId, overrideAccess: true, depth: 0 })
    for (const pack of (code as { packs?: unknown[] }).packs || []) {
      const id = idOf(pack)
      if (id) packIds.add(id)
    }
  }
  for (const pack of user.extraPacks || []) {
    const id = idOf(pack)
    if (id) packIds.add(id)
  }
  if (!packIds.size) return []
  const packs = await payload.find({
    collection: 'packs',
    overrideAccess: true,
    depth: 0,
    limit: 100,
    where: { id: { in: [...packIds] } },
  })
  const courseIds: number[] = []
  for (const pack of packs.docs) {
    for (const course of (pack as { courses?: unknown[] }).courses || []) {
      const id = idOf(course)
      if (id) courseIds.push(id)
    }
  }
  return courseIds
}

export async function adoptedCourseIds(payload: Payload, portalId: number) {
  const adoptions = await payload.find({
    collection: 'adoptions',
    overrideAccess: true,
    depth: 0,
    limit: 200,
    where: { portal: { equals: portalId } },
  })
  const ids = new Set<number>()
  const packIds: number[] = []
  for (const adoption of adoptions.docs as { kind?: string; course?: unknown; pack?: unknown }[]) {
    if (adoption.kind === 'course') {
      const id = idOf(adoption.course)
      if (id) ids.add(id)
    }
    if (adoption.kind === 'pack') {
      const id = idOf(adoption.pack)
      if (id) packIds.push(id)
    }
  }
  if (packIds.length) {
    const packs = await payload.find({
      collection: 'packs',
      overrideAccess: true,
      depth: 0,
      limit: 100,
      where: { id: { in: packIds } },
    })
    for (const pack of packs.docs as { courses?: unknown[] }[]) {
      for (const course of pack.courses || []) {
        const id = idOf(course)
        if (id) ids.add(id)
      }
    }
  }
  return [...ids]
}

export async function requireUser() {
  const session = await getSession()
  if (!session.user) redirect('/login')
  return session as { payload: Payload; user: SessionUser }
}

export async function requireMaster() {
  const session = await requireUser()
  if (session.user.role !== 'master') redirect('/?error=The master desk is not yours.')
  return session
}

export async function loadPortal(payload: Payload, slug: string) {
  const found = await payload.find({
    collection: 'portals',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { slug: { equals: slug } },
  })
  return (found.docs[0] as PortalDoc | undefined) || null
}

export async function requirePortal(slug: string, roles?: SessionUser['role'][]) {
  const session = await requireUser()
  const portal = await loadPortal(session.payload, slug)
  if (!portal) redirect('/?error=That portal could not be found.')
  if (session.user.role !== 'master' && portalIdOf(session.user) !== portal.id) {
    redirect('/?error=That portal is not yours.')
  }
  if (roles && session.user.role !== 'master' && !roles.includes(session.user.role)) {
    redirect(`/p/${slug}?error=That room is for another role.`)
  }
  return { ...session, portal }
}
