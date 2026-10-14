import { createHmac } from 'node:crypto'
import type { Payload } from 'payload'
import { randomCode } from '@/lib/access-codes'
import {
  DEMO_ANNOUNCE,
  DEMO_ANSWER,
  DEMO_BEATS,
  DEMO_DRAFT_COURSE,
  DEMO_OPEN_COURSE,
  DEMO_QUESTION,
  DEMO_REPLY,
  DEMO_SLOTS,
  DEMO_STAGE_EMAILS,
  DEMO_STAGE_NAME,
  DEMO_STAGE_SLUG,
  canClaimPortal,
  demoCookieName,
  isDemoStageEmail,
  isDemoStageWipeTarget,
  type DemoBeatId,
  type DemoSlot,
} from '@/lib/demo-stage'
import { payloadSecret } from '@/lib/env'
import { defaultFeatures } from '@/lib/features'
import { appendDemoActivity, clearDemoPortalCache, findDemoPortal } from './demo-activity'
import type { SessionUser } from './context'
import { saveAnswer } from './handle'

const PACK_TITLE = 'Demo sittings'
const CODE_LABELS = {
  admin: 'demo-stage-admin',
  teacher: 'demo-stage-teacher',
  learner: 'demo-stage-learner',
} as const

function demoPassword(slot: DemoSlot) {
  return createHmac('sha256', payloadSecret()).update(`demo-stage-v1:${slot}`).digest('hex')
}

async function one(payload: Payload, collection: string, where: Record<string, unknown>) {
  const found = await payload.find({
    collection: collection as 'users',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: where as never,
  })
  return (found.docs[0] as { id: number } | undefined) || null
}

async function removeWhere(payload: Payload, collection: string, where: Record<string, unknown>) {
  const found = await payload.find({
    collection: collection as 'users',
    overrideAccess: true,
    depth: 0,
    limit: 200,
    pagination: false,
    where: where as never,
  }).catch(() => ({ docs: [] as { id: number }[] }))
  for (const doc of found.docs) {
    await payload.delete({ collection: collection as 'users', id: doc.id, overrideAccess: true }).catch(() => undefined)
  }
}

async function userByEmail(payload: Payload, email: string) {
  const doc = await one(payload, 'users', { email: { equals: email } })
  if (!doc) throw new Error(`The demo stage is missing ${email}.`)
  return doc as unknown as SessionUser & { id: number }
}

async function ensureCourse(
  payload: Payload,
  portalId: number,
  title: string,
  visibility: 'draft' | 'published',
  withQuestion: boolean,
  authorId: number,
) {
  let course = await one(payload, 'courses', { and: [{ portal: { equals: portalId } }, { title: { equals: title } }] })
  if (!course) {
    course = (await payload.create({
      collection: 'courses',
      overrideAccess: true,
      data: {
        title,
        summary: 'A sitting kept inside the Demo stage sandbox.',
        speaker: 'Yusuf Rahman',
        origin: 'local',
        portal: portalId,
        importable: false,
        visibility,
      },
    })) as { id: number }
  } else if (visibility === 'published') {
    await payload.update({ collection: 'courses', id: course.id, overrideAccess: true, data: { visibility: 'published', origin: 'local', portal: portalId } as never })
  }
  let unit = await one(payload, 'units', { course: { equals: course.id } })
  if (!unit) {
    unit = (await payload.create({
      collection: 'units',
      overrideAccess: true,
      data: { title: 'Unit 1', course: course.id, order: 1 },
    })) as { id: number }
  }
  let lesson = await one(payload, 'lessons', { course: { equals: course.id } })
  if (!lesson) {
    lesson = (await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: {
        title,
        unit: unit.id,
        course: course.id,
        portal: portalId,
        master: false,
        order: 1,
        speaker: 'Yusuf Rahman',
        transcriptSource: 'none',
        durationSeconds: 180,
      },
    })) as { id: number }
  }
  let pointId: number | null = null
  if (withQuestion) {
    let point = await one(payload, 'engagement-points', { lesson: { equals: lesson.id } })
    if (!point) {
      point = (await payload.create({
        collection: 'engagement-points',
        overrideAccess: true,
        data: {
          lesson: lesson.id,
          second: 12,
          kind: 'reflection',
          prompt: DEMO_QUESTION,
          timing: 'immediate',
          status: 'published',
          audience: 'everyone',
          author: authorId,
          showImam: true,
          family: 'workbook',
        },
      })) as { id: number }
    }
    pointId = point.id
  }
  return { courseId: course.id, pointId }
}

/** Creates the sandbox portal, its four accounts, and the two sittings. Does not touch any other portal. */
export async function ensureDemoStage(payload: Payload) {
  const existing = await one(payload, 'portals', { slug: { equals: DEMO_STAGE_SLUG } })
  const claim = canClaimPortal(existing as { slug?: string; isDemo?: boolean } | null)
  if (claim === 'refuse') {
    throw new Error('A real portal already uses the demo-stage address. The demo stage will not change it.')
  }
  const portal = claim === 'use' && existing
    ? existing
    : ((await payload.create({
        collection: 'portals',
        overrideAccess: true,
        data: {
          name: DEMO_STAGE_NAME,
          slug: DEMO_STAGE_SLUG,
          kind: 'mosque',
          welcome: 'A sandbox for the demo stage. Nothing here is a real portal.',
          colour: '#1f8a78',
          wizardDone: true,
          isDemo: true,
          watchHistoryOptIn: false,
        },
      })) as { id: number })
  if (claim === 'use') {
    await payload.update({
      collection: 'portals',
      id: portal.id,
      overrideAccess: true,
      data: { name: DEMO_STAGE_NAME, isDemo: true, wizardDone: true, closed: false } as never,
    })
  }
  clearDemoPortalCache()

  async function ensureAccount(slot: DemoSlot, data: Record<string, unknown>) {
    const email = DEMO_STAGE_EMAILS[slot]
    if (!isDemoStageEmail(email) || email.endsWith('@hearts.test')) {
      throw new Error('Refusing to create a demo account outside the demo-stage namespace.')
    }
    const found = await one(payload, 'users', { email: { equals: email } })
    if (found) return found
    return (await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: { email, password: demoPassword(slot), ...data } as never,
    })) as { id: number }
  }

  const teacher = await ensureAccount('teacher', {
    name: 'Yusuf Rahman',
    role: 'teacher',
    audience: 'teacher',
    tenants: [{ tenant: portal.id }],
    onboarded: true,
    seenWelcome: true,
    joinedAt: new Date().toISOString(),
  })

  const open = await ensureCourse(payload, portal.id, DEMO_OPEN_COURSE, 'published', true, teacher.id)
  const draft = await ensureCourse(payload, portal.id, DEMO_DRAFT_COURSE, 'draft', false, teacher.id)
  const courseIds = [open.courseId, draft.courseId]

  let pack = await one(payload, 'packs', { and: [{ portal: { equals: portal.id } }, { title: { equals: PACK_TITLE } }] })
  if (!pack) {
    pack = (await payload.create({
      collection: 'packs',
      overrideAccess: true,
      data: { title: PACK_TITLE, summary: 'The sittings the demo learner joined with.', owner: 'portal', portal: portal.id, courses: courseIds },
    })) as { id: number }
  } else {
    await payload.update({ collection: 'packs', id: pack.id, overrideAccess: true, data: { courses: courseIds } as never })
  }

  async function codeFor(label: string, role: 'admin' | 'teacher' | 'learner', uses: number) {
    const found = await one(payload, 'access-codes', { and: [{ portal: { equals: portal.id } }, { label: { equals: label } }] })
    if (found) return found
    return (await payload.create({
      collection: 'access-codes',
      overrideAccess: true,
      data: {
        code: randomCode('DEMO'),
        label,
        role,
        portal: portal.id,
        packs: [pack!.id],
        uses,
        disabled: false,
      },
    })) as { id: number }
  }

  const adminCode = await codeFor(CODE_LABELS.admin, 'admin', 1)
  const teacherCode = await codeFor(CODE_LABELS.teacher, 'teacher', 1)
  const learnerCode = await codeFor(CODE_LABELS.learner, 'learner', 1)

  await ensureAccount('master', {
    name: 'Demo Master',
    role: 'master',
    onboarded: true,
    seenWelcome: true,
  })
  await payload.update({
    collection: 'users',
    id: teacher.id,
    overrideAccess: true,
    data: { accessCode: teacherCode.id, courseList: courseIds, tenants: [{ tenant: portal.id }] } as never,
  })
  await ensureAccount('portal', {
    name: 'Nabil Hassan',
    role: 'portal-admin',
    accessCode: adminCode.id,
    tenants: [{ tenant: portal.id }],
    onboarded: true,
    seenWelcome: true,
    courseList: courseIds,
  })
  // The learner is joined through the sandbox code: same fields a join writes, including the course list from that code's pack.
  const learner = await ensureAccount('learner', {
    name: 'Layla Khan',
    role: 'learner',
    audience: 'learner',
    accessCode: learnerCode.id,
    tenants: [{ tenant: portal.id }],
    onboarded: true,
    seenWelcome: true,
    courseList: courseIds,
    joinedAt: new Date().toISOString(),
    shareWithLearners: false,
  })
  await payload.update({
    collection: 'users',
    id: learner.id,
    overrideAccess: true,
    data: { accessCode: learnerCode.id, courseList: courseIds, tenants: [{ tenant: portal.id }] } as never,
  })

  return { portalId: portal.id, openCourseId: open.courseId, draftCourseId: draft.courseId, pointId: open.pointId }
}

async function wipeSandbox(payload: Payload, portalId: number) {
  const courses = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    depth: 0,
    limit: 50,
    where: { portal: { equals: portalId } },
  })
  const courseIds = courses.docs.map((doc) => doc.id).filter((id) => isDemoStageWipeTarget({ portalId, demoPortalId: portalId }))
  const lessons = courseIds.length
    ? await payload.find({
        collection: 'lessons',
        overrideAccess: true,
        depth: 0,
        limit: 100,
        where: { course: { in: courseIds } },
      })
    : { docs: [] as { id: number }[] }
  const lessonIds = lessons.docs.map((doc) => doc.id)
  if (lessonIds.length) await removeWhere(payload, 'engagement-points', { lesson: { in: lessonIds } })
  for (const collection of ['notifications', 'workbook-entries', 'answers', 'announcements', 'announcement-dismissals', 'messages', 'completions', 'feedback-notes', 'watch-sessions']) {
    await removeWhere(payload, collection, { portal: { equals: portalId } })
  }
  if (lessonIds.length) await removeWhere(payload, 'lessons', { id: { in: lessonIds } })
  if (courseIds.length) await removeWhere(payload, 'units', { course: { in: courseIds } })
  if (courseIds.length) await removeWhere(payload, 'courses', { id: { in: courseIds } })
  for (const email of Object.values(DEMO_STAGE_EMAILS)) {
    if (!isDemoStageWipeTarget({ email, demoPortalId: portalId })) continue
    await removeWhere(payload, 'users', { email: { equals: email } })
  }
  await removeWhere(payload, 'access-codes', { portal: { equals: portalId } })
  await removeWhere(payload, 'packs', { portal: { equals: portalId } })
  await payload.update({ collection: 'portals', id: portalId, overrideAccess: true, data: { demoActivity: [], features: null, isDemo: true } as never })
}

/** Drops and reseeds the sandbox portal only. Real portals and their accounts stay. */
export async function resetDemoStage(payload: Payload) {
  const portal = await findDemoPortal(payload)
  if (portal?.id) await wipeSandbox(payload, portal.id)
  clearDemoPortalCache()
  await ensureDemoStage(payload)
}

export async function demoSessionCookies(payload: Payload) {
  await ensureDemoStage(payload)
  const cookies: { name: string; value: string }[] = []
  for (const slot of DEMO_SLOTS) {
    const email = DEMO_STAGE_EMAILS[slot]
    const result = await payload.login({ collection: 'users', data: { email, password: demoPassword(slot) } })
    if (!result.token) throw new Error(`Could not open the ${slot} demo session.`)
    cookies.push({ name: demoCookieName(slot), value: result.token })
  }
  return cookies
}

async function note(payload: Payload, slot: DemoSlot, kind: string, text: string) {
  await appendDemoActivity(payload, { slot, kind, text })
  return text
}

export async function runDemoBeat(payload: Payload, beat: DemoBeatId) {
  if (!DEMO_BEATS.some((row) => row.id === beat)) return { ok: false as const, error: 'That step is not part of the demo.' }
  const ready = await ensureDemoStage(payload)
  const portal = await findDemoPortal(payload)
  if (!portal?.id || portal.id !== ready.portalId) return { ok: false as const, error: 'The demo stage portal is not ready.' }

  if (beat === 'publish') {
    const course = await one(payload, 'courses', { and: [{ portal: { equals: portal.id } }, { title: { equals: DEMO_DRAFT_COURSE } }] })
    if (!course) return { ok: false as const, error: 'The draft sitting is missing.' }
    await payload.update({ collection: 'courses', id: course.id, overrideAccess: true, data: { visibility: 'published', origin: 'local', portal: portal.id } as never })
    const text = await note(payload, 'portal', 'course', `Course published: ${DEMO_DRAFT_COURSE}`)
    return { ok: true as const, text }
  }

  if (beat === 'answer' || beat === 'reply') {
    const learner = await userByEmail(payload, DEMO_STAGE_EMAILS.learner)
    const point = ready.pointId
      ? ready.pointId
      : (await one(payload, 'engagement-points', { prompt: { equals: DEMO_QUESTION } }))?.id
    if (!point) return { ok: false as const, error: 'The demo question is missing.' }
    const saved = await saveAnswer(payload, learner, {
      pointId: point,
      body: DEMO_ANSWER,
      keepPrivate: false,
      shareWithTeacher: true,
      shareWithLearners: false,
    })
    if (!saved.ok) return { ok: false as const, error: saved.error }
    if (beat === 'answer') {
      const text = await note(payload, 'learner', 'answer', `Learner answered: ${DEMO_ANSWER}`)
      return { ok: true as const, text }
    }
    const entry = await one(payload, 'workbook-entries', { and: [{ portal: { equals: portal.id } }, { user: { equals: learner.id } }] })
    if (!entry) return { ok: false as const, error: 'The answer did not reach the teacher queue.' }
    await payload.update({
      collection: 'workbook-entries',
      id: entry.id,
      overrideAccess: true,
      data: { teacherReply: DEMO_REPLY, repliedAt: new Date().toISOString(), consent: true } as never,
    })
    const text = await note(payload, 'teacher', 'reply', 'Teacher replied')
    return { ok: true as const, text }
  }

  if (beat === 'announce') {
    const admin = await userByEmail(payload, DEMO_STAGE_EMAILS.portal)
    const existing = await one(payload, 'announcements', { and: [{ portal: { equals: portal.id } }, { body: { equals: DEMO_ANNOUNCE } }] })
    if (!existing) {
      await payload.create({
        collection: 'announcements',
        overrideAccess: true,
        data: {
          portal: portal.id,
          body: DEMO_ANNOUNCE,
          audience: 'everyone',
          publishAt: new Date().toISOString(),
          createdBy: admin.id,
        } as never,
      })
    }
    const text = await note(payload, 'portal', 'announcement', `Announcement posted: ${DEMO_ANNOUNCE}`)
    return { ok: true as const, text }
  }

  const features = { ...defaultFeatures(), ...(portal.features || {}) }
  const live = features.live !== false
  await payload.update({
    collection: 'portals',
    id: portal.id,
    overrideAccess: true,
    data: { features: { ...features, live: !live } } as never,
  })
  clearDemoPortalCache()
  const text = await note(payload, 'master', 'feature', 'Feature toggled')
  return { ok: true as const, text }
}
