import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { AFTERNOON_PLAN, DEMO_WALK_EMAIL, DEMO_WALK_PORTAL, demoGardenAt, demoWeekGardenGuard, demoWeekMonday, demoWeekSlots, pickLessonsByArea } from '@/lib/demo-week'
import { doorNumberOfClause } from '@/lib/doors'
import { idOf, portalIdOf } from '@/lib/ids'
import { partTitle } from '@/lib/talk-title'
import { LEARNER_ZONE } from '@/lib/week'
import { visibleCourseIds, type SessionUser } from '@/server/context'
import { loadDoors } from '@/server/doors'

export type DemoWeekGardenResult = {
  ok: true
  portal: string
  email: string
  talks: number
  completions: number
  answers: number
  slots: number
  harvest: number
  field: number
  acts: number
} | { ok: false; reason: string }

type Doc = { id: number; title?: string; course?: unknown; bestClause?: unknown; lesson?: unknown; second?: unknown; status?: unknown; name?: string }

function num(value: unknown) {
  return idOf(value)
}

export { demoWeekGardenGuard }

async function one(payload: Payload, collection: 'portals' | 'users' | 'schedules', where: unknown) {
  const found = await payload.find({ collection, overrideAccess: true, depth: 0, limit: 1, where: where as never })
  return (found.docs[0] as Doc | undefined) || null
}

/** Fills My week and Garden fruits for a demo learner. Adds only. Never wipes other plans or people. */
export async function seedDemoWeekGarden(
  payload: Payload,
  options: { email?: string; portalSlug?: string } = {},
): Promise<DemoWeekGardenResult> {
  const guard = demoWeekGardenGuard()
  if (guard) return { ok: false, reason: guard }

  const email = options.email || DEMO_WALK_EMAIL
  const portalSlug = options.portalSlug || DEMO_WALK_PORTAL
  const portal = await one(payload, 'portals', { slug: { equals: portalSlug } })
  if (!portal) return { ok: false, reason: `No portal named ${portalSlug} was found.` }

  const learner = await one(payload, 'users', { email: { equals: email } })
  if (!learner) return { ok: false, reason: `No learner ${email} was found.` }
  if (portalIdOf(learner as { tenants?: { tenant?: unknown }[] }) !== portal.id) {
    return { ok: false, reason: `${email} is not in ${portalSlug}. Nothing was changed.` }
  }

  const namedTeacher = await one(payload, 'users', { email: { equals: 'elm-teacher@hearts.test' } })
  const staff = namedTeacher || ((await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { or: [{ role: { equals: 'teacher' } }, { role: { equals: 'portal-admin' } }] } as never,
  })).docs as Doc[]).find((person) => portalIdOf(person as { tenants?: { tenant?: unknown }[] }) === portal.id)
  const teacher = staff

  const courseIds = await visibleCourseIds(payload, learner as SessionUser)
  if (!courseIds.length) return { ok: false, reason: `${email} has no courses open yet.` }
  const courses = (await payload.find({
    collection: 'courses',
    overrideAccess: true,
    depth: 0,
    limit: 80,
    where: { id: { in: courseIds } },
  })).docs as Doc[]

  const lessons = (await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 400,
    sort: 'order',
    where: { course: { in: courseIds } },
  })).docs as Doc[]
  const lessonIds = lessons.map((lesson) => lesson.id)
  const cuts = lessonIds.length
    ? ((await payload.find({
      collection: 'cuts',
      overrideAccess: true,
      depth: 0,
      limit: 800,
      where: { lesson: { in: lessonIds } },
    })).docs as Doc[])
    : []
  const doors = await loadDoors(payload)
  const doorFor = (lessonId: number) => {
    const own = cuts.filter((cut) => num(cut.lesson) === lessonId)
    for (const cut of own) {
      const door = doorNumberOfClause(Number(cut.bestClause || 0), doors)
      if (door) return door
    }
    return null
  }
  const mapped = lessons
    .map((lesson) => ({
      id: lesson.id,
      courseId: num(lesson.course) || 0,
      title: partTitle(lesson, String(courses.find((course) => course.id === num(lesson.course))?.title || '')),
      door: doorFor(lesson.id),
    }))
    .filter((lesson) => lesson.courseId)
  const picked = pickLessonsByArea(mapped, 2)
  if (!picked.length) return { ok: false, reason: 'No talks were ready to place on the garden trees.' }

  const monday = demoWeekMonday(now(), LEARNER_ZONE)
  let completions = 0
  let answers = 0
  for (const [index, lesson] of picked.entries()) {
    const at = demoGardenAt(now(), index)
    const have = await payload.find({
      collection: 'completions',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { and: [{ user: { equals: learner.id } }, { lesson: { equals: lesson.id } }] },
    })
    if (!have.docs.length) {
      await payload.create({
        collection: 'completions',
        overrideAccess: true,
        data: {
          user: learner.id,
          lesson: lesson.id,
          portal: portal.id,
          percent: 100,
          onTime: true,
          sourceLevel: 'talk',
          watchedAt: at,
          createdAt: at,
          updatedAt: at,
        } as never,
      })
      completions += 1
    } else {
      await payload.update({
        collection: 'completions',
        id: (have.docs[0] as Doc).id,
        overrideAccess: true,
        data: { watchedAt: at, createdAt: at, updatedAt: at } as never,
      })
    }
    const sitting = await payload.find({
      collection: 'watch-sessions',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { and: [{ user: { equals: learner.id } }, { lesson: { equals: lesson.id } }] },
    })
    if (!sitting.docs.length) {
      await payload.create({
        collection: 'watch-sessions',
        overrideAccess: true,
        data: { user: learner.id, lesson: lesson.id, seconds: 540, portal: portal.id, createdAt: at, updatedAt: at } as never,
      })
    }
    const points = (await payload.find({
      collection: 'engagement-points',
      overrideAccess: true,
      depth: 0,
      limit: 4,
      sort: 'second',
      where: { and: [{ lesson: { equals: lesson.id } }, { status: { not_equals: 'draft' } }] },
    })).docs as Doc[]
    const point = points[0]
    if (!point) continue
    const answered = await payload.find({
      collection: 'answers',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { and: [{ user: { equals: learner.id } }, { point: { equals: point.id } }] },
    })
    if (!answered.docs.length) {
      await payload.create({
        collection: 'answers',
        overrideAccess: true,
        data: {
          user: learner.id,
          lesson: lesson.id,
          point: point.id,
          portal: portal.id,
          body: 'I will carry this sitting into an ordinary day.',
          answeredAt: at,
          atSecond: Number(point.second || 0),
          shareWithTeacher: false,
          keepPrivate: true,
          createdAt: at,
          updatedAt: at,
        } as never,
      })
      answers += 1
    } else {
      await payload.update({
        collection: 'answers',
        id: (answered.docs[0] as Doc).id,
        overrideAccess: true,
        data: { answeredAt: at, createdAt: at, updatedAt: at } as never,
      })
    }
  }
  const weekTalks = picked.length >= 7 ? picked : mapped.filter((lesson) => lesson.courseId).slice(0, 7)
  const slots = demoWeekSlots({
    monday,
    lessons: (weekTalks.length ? weekTalks : picked).map((lesson) => ({ id: lesson.id, title: lesson.title, courseId: lesson.courseId })),
  })
  const owner = teacher?.id || learner.id
  const existing = await one(payload, 'schedules', { and: [{ portal: { equals: portal.id } }, { name: { equals: AFTERNOON_PLAN } }] })
  const data = {
    name: AFTERNOON_PLAN,
    owner,
    learners: [learner.id],
    targetType: 'course',
    course: slots[0]?.courseId,
    portal: portal.id,
    startDate: slots[0]?.date || monday,
    endDate: slots.at(-1)?.date || monday,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    minutesPerDay: 20,
    slots: slots.map((slot) => ({ date: slot.date, title: slot.title, lessonId: slot.lessonId, courseId: slot.courseId })),
  }
  if (existing) {
    const members = ((existing as { learners?: unknown[] }).learners || []).map((item) => num(item))
    if (members.some((id) => id && id !== learner.id)) {
      return { ok: false, reason: 'The afternoon walk plan already includes someone else. Nothing was changed.' }
    }
    await payload.update({ collection: 'schedules', id: existing.id, overrideAccess: true, data: data as never })
  } else {
    await payload.create({ collection: 'schedules', overrideAccess: true, data: data as never })
  }

  let harvest = 0
  let field = 0
  let acts = 0
  const haveHarvest = await payload.find({
    collection: 'harvest-entries',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { user: { equals: learner.id } },
  })
  if (!haveHarvest.docs.length) {
    const lines = [
      { kind: 'line', text: 'A line I am carrying from this sitting into an ordinary day.' },
      { kind: 'line', text: 'Mercy is a practice, not a mood.' },
      { kind: 'line', text: 'I will leave the sitting slower than I arrived.' },
    ]
    for (const [index, line] of lines.entries()) {
      const lesson = picked[index] || picked[0]
      if (!lesson) continue
      const at = demoGardenAt(now(), index)
      await payload.create({
        collection: 'harvest-entries',
        overrideAccess: true,
        data: {
          user: learner.id,
          lesson: lesson.id,
          portal: portal.id,
          kind: line.kind,
          text: line.text,
          surface: 'talk',
          gatheredAt: at,
          createdAt: at,
          updatedAt: at,
        } as never,
      })
      harvest += 1
    }
  }
  const seats = (await payload.find({ collection: 'seats', overrideAccess: true, depth: 0, limit: 6, sort: 'position' })).docs as Doc[]
  for (const seat of seats.slice(0, 3)) {
    const have = await payload.find({
      collection: 'seat-visits',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { and: [{ user: { equals: learner.id } }, { seat: { equals: seat.id } }] },
    })
    if (have.docs.length) continue
    await payload.create({
      collection: 'seat-visits',
      overrideAccess: true,
      data: { user: learner.id, seat: seat.id, returned: false, portal: portal.id } as never,
    })
    field += 1
  }
  const haveActs = await payload.find({
    collection: 'rituals',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { user: { equals: learner.id } },
  })
  if (!haveActs.docs.length) {
    for (const note of ['I held back a harsh word.', 'I sat a little longer after the prayer.']) {
      await payload.create({
        collection: 'rituals',
        overrideAccess: true,
        data: { user: learner.id, note, portal: portal.id } as never,
      })
      acts += 1
    }
  }

  return {
    ok: true,
    portal: portalSlug,
    email,
    talks: picked.length,
    completions,
    answers,
    slots: slots.length,
    harvest,
    field,
    acts,
  }
}
