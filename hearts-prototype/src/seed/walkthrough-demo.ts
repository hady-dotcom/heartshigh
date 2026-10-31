// Idempotent walkthrough fill for the hearts-demo portal only.
// Additive. Never deletes. Never writes another portal. Existing passwords stay as they are.
// Safe to run on Railway production after the starter talks are loaded.

import type { Payload } from 'payload'
import { randomCode } from '../lib/access-codes'
import { answersForPoint } from '../lib/circle-fill'
import { SCENES } from '../lib/opening-data'
import { idOf, portalIdOf } from '../lib/ids'
import { ensurePackAdopted } from '../server/pack-adopt'
import { giveHarvest } from '../server/scripture'
import {
  AFTERNOON_WALK_EMAIL,
  AFTERNOON_WALK_NAME,
  COURSE_NEEDLES,
  EXISTING_FILL_EMAILS,
  WALKTHROUGH_CODE_LABEL,
  WALKTHROUGH_CODE_PREFIX,
  WALKTHROUGH_LEARNER_EMAIL,
  WALKTHROUGH_LEARNER_NAME,
  WALKTHROUGH_OPENING,
  WALKTHROUGH_PLAN_NAME,
  WALKTHROUGH_PORTAL_NAME,
  WALKTHROUGH_PORTAL_SLUG,
  WALKTHROUGH_RITUALS,
  WALKTHROUGH_STARTING_CLAUSE,
  WALKTHROUGH_TIME_ZONE,
  circleDraftsForPoint,
  finishEveryLesson,
  learnerAnswerForPoint,
  matchCourseKey,
  passwordForNewWalkthrough,
  walkthroughDemoGuard,
  walkthroughWeekSlots,
  type CourseKey,
} from '../lib/walkthrough-demo'

type Doc = Record<string, unknown> & { id: number }

export type WalkthroughSeedResult = {
  ok: true
  portal: string
  joinCode: string
  joinPath: string
  learnerEmail: string
  learnerName: string
  createdLearner: boolean
  password: string | null
  alsoFilled: string[]
  courses: { title: string; key: CourseKey; percent: number }[]
  created: Record<string, number>
  reused: Record<string, number>
  notes: string[]
}

export type WalkthroughSeedFailure = { ok: false; reason: string }

const DAY = 86_400_000

async function one(payload: Payload, collection: string, where: Record<string, unknown>) {
  const found = await payload.find({ collection: collection as never, overrideAccess: true, depth: 0, limit: 1, where: where as never })
  return (found.docs[0] as unknown as Doc | undefined) || null
}

function tenantsOf(user: Doc) {
  const rows = Array.isArray(user.tenants) ? user.tenants : []
  return rows.map((row) => idOf((row as { tenant?: unknown }).tenant)).filter((id): id is number => Boolean(id))
}

function bump(map: Record<string, number>, key: string, amount = 1) {
  map[key] = (map[key] || 0) + amount
}

function mergeIds(current: unknown, extra: number[]) {
  const have = Array.isArray(current) ? current.map((item) => Number(item)).filter((id) => Number.isFinite(id) && id > 0) : []
  return [...new Set([...have, ...extra])]
}

type MatchedLesson = {
  id: number
  title: string
  courseId: number
  courseTitle: string
  key: CourseKey
  durationSeconds: number
  youtubeId: string
  importToken: string
  transcript: string
}

async function loadMatchedLessons(payload: Payload): Promise<MatchedLesson[]> {
  const lessons = (await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 1000,
    pagination: false,
  })).docs as unknown as Doc[]
  const courseIds = [...new Set(lessons.map((lesson) => idOf(lesson.course)).filter((id): id is number => Boolean(id)))]
  const courses = courseIds.length
    ? ((await payload.find({
        collection: 'courses',
        overrideAccess: true,
        depth: 0,
        limit: 400,
        where: { id: { in: courseIds } },
      })).docs as unknown as Doc[])
    : []
  const byId = new Map(courses.map((course) => [course.id, course]))
  const matched = new Map<number, MatchedLesson>()
  const take = (lesson: Doc, course: Doc | undefined, key: CourseKey) => {
    const courseId = idOf(lesson.course)
    if (!courseId || matched.has(lesson.id)) return
    matched.set(lesson.id, {
      id: lesson.id,
      title: String(lesson.title || course?.title || 'Talk'),
      courseId,
      courseTitle: String(course?.title || lesson.title || 'Talk'),
      key,
      durationSeconds: Number(lesson.durationSeconds || 0),
      youtubeId: String(lesson.youtubeId || ''),
      importToken: String(course?.importToken || ''),
      transcript: typeof lesson.transcript === 'string' ? lesson.transcript : '',
    })
  }
  for (const lesson of lessons) {
    const course = byId.get(idOf(lesson.course) || 0)
    const key = matchCourseKey({
      title: String(lesson.title || course?.title || ''),
      importToken: String(course?.importToken || ''),
      youtubeId: String(lesson.youtubeId || ''),
    }) || matchCourseKey({
      title: String(course?.title || ''),
      importToken: String(course?.importToken || ''),
      youtubeId: String(lesson.youtubeId || ''),
    })
    if (!key) continue
    take(lesson, course, key)
  }
  const seriesCourses = new Set(
    [...matched.values()].filter((row) => finishEveryLesson(row.key, row.courseTitle, row.title)).map((row) => row.courseId),
  )
  for (const lesson of lessons) {
    const courseId = idOf(lesson.course)
    if (!courseId || !seriesCourses.has(courseId) || matched.has(lesson.id)) continue
    const course = byId.get(courseId)
    const sibling = [...matched.values()].find((row) => row.courseId === courseId)
    take(lesson, course, sibling?.key || 'starter')
  }
  const rank = (key: CourseKey) => COURSE_NEEDLES.findIndex((row) => row.key === key)
  return [...matched.values()].sort((a, b) => rank(a.key) - rank(b.key) || a.id - b.id)
}

async function ensurePortal(payload: Payload, notes: string[]) {
  let portal = await one(payload, 'portals', { slug: { equals: WALKTHROUGH_PORTAL_SLUG } })
  if (!portal) {
    portal = (await payload.create({
      collection: 'portals',
      overrideAccess: true,
      data: {
        name: WALKTHROUGH_PORTAL_NAME,
        slug: WALKTHROUGH_PORTAL_SLUG,
        kind: 'mosque',
        welcome: 'A quiet room for a short talk, when you have a moment.',
        organisationName: WALKTHROUGH_PORTAL_NAME,
        wizardDone: true,
        colour: '#123f3a',
        timeZone: WALKTHROUGH_TIME_ZONE,
        showOthersAnswers: true,
      },
    })) as unknown as Doc
    notes.push(`Created portal ${WALKTHROUGH_PORTAL_SLUG}.`)
    return { portal, created: true }
  }
  const blocked = walkthroughDemoGuard(String(portal.slug || ''))
  if (blocked) throw new Error(blocked)
  const patch: Record<string, unknown> = {}
  if (portal.timeZone !== WALKTHROUGH_TIME_ZONE) patch.timeZone = WALKTHROUGH_TIME_ZONE
  if (portal.showOthersAnswers === false) patch.showOthersAnswers = true
  if (portal.wizardDone !== true) patch.wizardDone = true
  if (Object.keys(patch).length) {
    await payload.update({ collection: 'portals', id: portal.id, overrideAccess: true, data: patch })
    notes.push(`Updated portal ${WALKTHROUGH_PORTAL_SLUG} so the walkthrough screens can show.`)
  } else {
    notes.push(`Portal ${WALKTHROUGH_PORTAL_SLUG} is already there.`)
  }
  return { portal, created: false }
}

async function ensureLearnerCode(payload: Payload, portalId: number, packIds: number[], notes: string[]) {
  const labelled = await one(payload, 'access-codes', { and: [{ portal: { equals: portalId } }, { label: { equals: WALKTHROUGH_CODE_LABEL } }] })
  if (labelled && !labelled.disabled) {
    if (packIds.length) {
      const have = ((labelled.packs as unknown[]) || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
      const next = [...new Set([...have, ...packIds])]
      if (next.length !== have.length) {
        await payload.update({ collection: 'access-codes', id: labelled.id, overrideAccess: true, data: { packs: next } as never })
      }
    }
    notes.push(`Learner join code ${labelled.code} (label ${WALKTHROUGH_CODE_LABEL}).`)
    return labelled
  }
  const existing = (await payload.find({
    collection: 'access-codes',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { and: [{ portal: { equals: portalId } }, { role: { equals: 'learner' } }, { disabled: { not_equals: true } }] },
  })).docs as unknown as Doc[]
  const prefer = existing.find((row) => String(row.code || '').toUpperCase().startsWith(`${WALKTHROUGH_CODE_PREFIX}-`)) || existing[0]
  if (prefer) {
    notes.push(`Reusing learner join code ${prefer.code}. A new code was not made.`)
    return prefer
  }
  const created = (await payload.create({
    collection: 'access-codes',
    overrideAccess: true,
    data: {
      code: randomCode(WALKTHROUGH_CODE_PREFIX),
      label: WALKTHROUGH_CODE_LABEL,
      role: 'learner',
      portal: portalId,
      packs: packIds,
    },
  })) as unknown as Doc
  notes.push(`Created learner join code ${created.code}.`)
  return created
}

async function adoptCourses(payload: Payload, portalId: number, courseIds: number[], created: Record<string, number>, reused: Record<string, number>) {
  const packs = (await payload.find({
    collection: 'packs',
    overrideAccess: true,
    depth: 0,
    limit: 40,
    where: { owner: { equals: 'master' } },
  })).docs as unknown as Doc[]
  const packIds: number[] = []
  for (const pack of packs) {
    const courses = ((pack.courses as unknown[]) || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    if (!courses.some((id) => courseIds.includes(id)) && pack.title !== 'Jibril sittings') continue
    packIds.push(pack.id)
    const linked = await ensurePackAdopted(payload, portalId, pack.id)
    if (linked) bump(reused, 'packs')
  }
  for (const courseId of courseIds) {
    const already = await one(payload, 'adoptions', { and: [{ portal: { equals: portalId } }, { course: { equals: courseId } }] })
    if (already) {
      bump(reused, 'adoptions')
      continue
    }
    const packAlready = packIds.length
      ? await one(payload, 'adoptions', { and: [{ portal: { equals: portalId } }, { pack: { in: packIds } }] })
      : null
    if (packAlready) {
      bump(reused, 'adoptions')
      continue
    }
    await payload.create({
      collection: 'adoptions',
      overrideAccess: true,
      data: { kind: 'course', portal: portalId, course: courseId },
    })
    bump(created, 'adoptions')
  }
  return packIds
}

async function ensureLearner(
  payload: Payload,
  spec: { email: string; name: string; create: boolean },
  portalId: number,
  codeId: number | null,
  courseIds: number[],
  notes: string[],
): Promise<{ user: Doc; created: boolean; password: string | null } | null> {
  const existing = await one(payload, 'users', { email: { equals: spec.email } })
  if (existing) {
    const homes = tenantsOf(existing)
    if (homes.some((id) => id !== portalId)) {
      notes.push(`Skipping ${spec.email}: they already belong to another portal.`)
      return null
    }
    if (String(existing.role || '') !== 'learner') {
      notes.push(`Skipping ${spec.email}: not a learner.`)
      return null
    }
    const data: Record<string, unknown> = {
      onboarded: true,
      seenWelcome: true,
      shareWithLearners: true,
      shareOpening: true,
      keepPlace: true,
      startingClause: existing.startingClause || WALKTHROUGH_STARTING_CLAUSE,
      courseList: mergeIds(existing.courseList, courseIds),
    }
    if (!homes.length) data.tenants = [{ tenant: portalId }]
    if (codeId && !existing.accessCode) data.accessCode = codeId
    if (!existing.joinedAt) data.joinedAt = new Date(Date.now() - 18 * DAY).toISOString()
    await payload.update({ collection: 'users', id: existing.id, overrideAccess: true, data: data as never })
    notes.push(`${spec.email} is already there. Password was left as it is.`)
    return { user: { ...existing, ...data, id: existing.id }, created: false, password: null }
  }
  if (!spec.create) {
    notes.push(`${spec.email} is not on this portal, so they were left alone.`)
    return null
  }
  const password = passwordForNewWalkthrough(true)
  const user = (await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      email: spec.email,
      password,
      name: spec.name,
      role: 'learner',
      audience: 'learner',
      tenants: [{ tenant: portalId }],
      accessCode: codeId || undefined,
      onboarded: true,
      seenWelcome: true,
      shareWithLearners: true,
      shareOpening: true,
      keepPlace: true,
      startingClause: WALKTHROUGH_STARTING_CLAUSE,
      courseList: courseIds,
      joinedAt: new Date(Date.now() - 18 * DAY).toISOString(),
    },
  })) as unknown as Doc
  notes.push(`Created ${spec.email}. Sign in with the printed password.`)
  return { user, created: true, password }
}

async function fillOpening(payload: Payload, user: Doc, portalId: number, created: Record<string, number>, reused: Record<string, number>) {
  const scenes = (await payload.find({
    collection: 'opening-scenes',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { status: { equals: 'published' } },
  })).docs as unknown as Doc[]
  if (!scenes.length) return
  const byKey = new Map(scenes.map((scene) => [String(scene.key), scene]))
  for (const [index, pick] of WALKTHROUGH_OPENING.entries()) {
    const scene = byKey.get(pick.sceneKey)
    const option = SCENES.find((row) => row.key === pick.sceneKey)?.options.find((row) => row.key === pick.optionKey)
    if (!scene || !option) continue
    const already = await one(payload, 'opening-answers', { and: [{ user: { equals: user.id } }, { sceneKey: { equals: pick.sceneKey } }, { supersededAt: { exists: false } }] })
    if (already) {
      bump(reused, 'opening')
      continue
    }
    const isPrivate = option.sensitivity === 'private'
    await payload.create({
      collection: 'opening-answers',
      overrideAccess: true,
      data: {
        user: user.id,
        portal: portalId,
        scene: scene.id,
        sceneKey: pick.sceneKey,
        optionKey: pick.optionKey,
        labelSnapshot: option.label,
        private: isPrivate,
        staffVisible: !isPrivate,
        scenesVersion: 1,
        answeredAt: new Date(Date.now() - 3 * DAY + index * 8000).toISOString(),
        recordedAt: new Date(Date.now() - 3 * DAY + 70_000).toISOString(),
      } as never,
    })
    bump(created, 'opening')
  }
}

function watchPlan(lessons: MatchedLesson[]) {
  const series = lessons.filter((lesson) => finishEveryLesson(lesson.key, lesson.courseTitle, lesson.title))
  const starters = lessons.filter((lesson) => !series.some((row) => row.id === lesson.id))
  const complete = [...series, ...starters.slice(0, 10)]
  const partial = starters.slice(10, 13)
  const seen = new Set<number>()
  const rows: { lesson: MatchedLesson; percent: number; daysAgo: number }[] = []
  complete.forEach((lesson, index) => {
    if (seen.has(lesson.id)) return
    seen.add(lesson.id)
    rows.push({ lesson, percent: 100, daysAgo: 16 - index })
  })
  partial.forEach((lesson, index) => {
    if (seen.has(lesson.id)) return
    seen.add(lesson.id)
    rows.push({ lesson, percent: 72, daysAgo: 4 - index })
  })
  return rows
}

async function fillProgress(
  payload: Payload,
  user: Doc,
  portalId: number,
  lessons: MatchedLesson[],
  created: Record<string, number>,
  reused: Record<string, number>,
  notes: string[],
) {
  const plan = watchPlan(lessons)
  if (!plan.length) {
    notes.push('No matching demo talks were found. Load the starter talks first, then run this again.')
    return []
  }
  for (const row of plan) {
    const watchedAt = new Date(Date.now() - Math.max(1, row.daysAgo) * DAY + 18 * 60 * 60 * 1000).toISOString()
    const existing = await one(payload, 'completions', { and: [{ user: { equals: user.id } }, { lesson: { equals: row.lesson.id } }] })
    if (!existing) {
      await payload.create({
        collection: 'completions',
        overrideAccess: true,
        data: {
          user: user.id,
          lesson: row.lesson.id,
          portal: portalId,
          percent: row.percent,
          sourceLevel: 'talk',
          onTime: true,
          watchedAt,
        },
      })
      bump(created, 'completions')
    } else {
      if (Number(existing.percent || 0) < row.percent) {
        await payload.update({
          collection: 'completions',
          id: existing.id,
          overrideAccess: true,
          data: { percent: row.percent, sourceLevel: 'talk', watchedAt },
        })
      }
      bump(reused, 'completions')
    }
    const seconds = row.lesson.durationSeconds
      ? Math.round((row.lesson.durationSeconds * row.percent) / 100)
      : row.percent >= 90 ? 1200 : 480
    const session = await one(payload, 'watch-sessions', { and: [{ user: { equals: user.id } }, { lesson: { equals: row.lesson.id } }] })
    if (!session) {
      await payload.create({
        collection: 'watch-sessions',
        overrideAccess: true,
        data: { user: user.id, lesson: row.lesson.id, portal: portalId, seconds } as never,
      })
      bump(created, 'watch-sessions')
    } else {
      if (Number(session.seconds || 0) < seconds) {
        await payload.update({ collection: 'watch-sessions', id: session.id, overrideAccess: true, data: { seconds } })
      }
      bump(reused, 'watch-sessions')
    }
    const visit = await one(payload, 'lesson-visits', { and: [{ user: { equals: user.id } }, { lesson: { equals: row.lesson.id } }] })
    if (!visit) {
      await payload.create({
        collection: 'lesson-visits',
        overrideAccess: true,
        data: { user: user.id, lesson: row.lesson.id, portal: portalId } as never,
      })
      bump(created, 'visits')
    } else {
      bump(reused, 'visits')
    }
    if (row.percent >= 90 && row.lesson.transcript.trim()) {
      const harvest = await payload.count({
        collection: 'harvest-entries',
        overrideAccess: true,
        where: { and: [{ user: { equals: user.id } }, { lesson: { equals: row.lesson.id } }] },
      })
      if (!harvest.totalDocs) {
        try {
          const added = await giveHarvest(payload, user.id, row.lesson.id, row.lesson.transcript, portalId, { createdAt: watchedAt, seenAt: indexSeen(row.daysAgo) })
          if (added) bump(created, 'harvest', added)
        } catch {
          notes.push(`Harvest for “${row.lesson.title}” was skipped.`)
        }
      } else {
        bump(reused, 'harvest')
      }
    }
  }
  return plan
}

function indexSeen(daysAgo: number) {
  return daysAgo > 3 ? new Date(Date.now() - (daysAgo - 1) * DAY).toISOString() : undefined
}

async function fillAnswers(
  payload: Payload,
  user: Doc,
  portalId: number,
  lessons: MatchedLesson[],
  created: Record<string, number>,
  reused: Record<string, number>,
) {
  const lessonIds = lessons.map((lesson) => lesson.id)
  if (!lessonIds.length) return
  const points = (await payload.find({
    collection: 'engagement-points',
    overrideAccess: true,
    depth: 0,
    limit: 1000,
    pagination: false,
    where: { and: [{ lesson: { in: lessonIds } }, { status: { not_equals: 'draft' } }, { family: { not_equals: 'workbook' } }] },
  })).docs as unknown as Doc[]
  const published = points.filter((point) => String(point.status || 'published') === 'published')
  let answerIndex = 0
  for (const point of published) {
    const lessonId = idOf(point.lesson)
    const lesson = lessons.find((row) => row.id === lessonId)
    if (!lesson) continue
    const draft = learnerAnswerForPoint(String(point.prompt || ''), answerIndex)
    answerIndex += 1
    const existing = await one(payload, 'answers', { and: [{ user: { equals: user.id } }, { point: { equals: point.id } }] })
    let answer = existing
    if (!existing) {
      answer = (await payload.create({
        collection: 'answers',
        overrideAccess: true,
        data: {
          point: point.id,
          user: user.id,
          lesson: lesson.id,
          portal: portalId,
          body: draft.choice ? '' : draft.body,
          choice: draft.choice || '',
          keepPrivate: draft.keepPrivate,
          shareWithTeacher: draft.shareWithTeacher,
          shareWithLearners: draft.shareWithLearners && !draft.keepPrivate,
          sourceLevel: 'talk',
          answeredAt: new Date(Date.now() - 2 * DAY - answerIndex * 3600_000).toISOString(),
          atSecond: Number(point.second || 0),
        } as never,
      })) as unknown as Doc
      bump(created, 'answers')
    } else {
      bump(reused, 'answers')
    }
    if (!answer) continue
    const book = await one(payload, 'workbook-entries', { and: [{ user: { equals: user.id } }, { answer: { equals: answer.id } }] })
    if (!book) {
      await payload.create({
        collection: 'workbook-entries',
        overrideAccess: true,
        data: {
          user: user.id,
          answer: answer.id,
          lesson: lesson.id,
          course: lesson.courseId,
          portal: portalId,
          body: draft.choice || draft.body,
          consent: draft.shareWithTeacher && !draft.keepPrivate,
        } as never,
      })
      bump(created, 'workbook')
    } else {
      bump(reused, 'workbook')
    }
  }
}

async function fillRituals(payload: Payload, user: Doc, portalId: number, created: Record<string, number>, reused: Record<string, number>) {
  for (const ritual of WALKTHROUGH_RITUALS) {
    const already = await one(payload, 'rituals', { and: [{ user: { equals: user.id } }, { note: { equals: ritual.note } }] })
    if (already) {
      bump(reused, 'rituals')
      continue
    }
    await payload.create({
      collection: 'rituals',
      overrideAccess: true,
      data: { user: user.id, portal: portalId, note: ritual.note } as never,
    })
    bump(created, 'rituals')
  }
}

async function fillWeek(
  payload: Payload,
  user: Doc,
  portalId: number,
  lessons: MatchedLesson[],
  created: Record<string, number>,
  reused: Record<string, number>,
) {
  const weekLessons = watchPlan(lessons).filter((row) => row.percent >= 90).map((row) => row.lesson).slice(0, 4)
  if (!weekLessons.length) return
  const slots = walkthroughWeekSlots(new Date(), weekLessons)
  if (!slots.length) return
  const mine = (await payload.find({
    collection: 'schedules',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { and: [{ portal: { equals: portalId } }, { or: [{ owner: { equals: user.id } }, { learners: { contains: user.id } }] }] },
  })).docs as unknown as Doc[]
  const existing = mine.find((plan) => String(plan.name) === WALKTHROUGH_PLAN_NAME)
  const otherOwn = mine.filter((plan) => String(plan.name) !== WALKTHROUGH_PLAN_NAME)
  if (!existing && otherOwn.length) {
    bump(reused, 'schedules')
    return
  }
  const data = {
    name: WALKTHROUGH_PLAN_NAME,
    owner: user.id,
    learners: [user.id],
    targetType: 'course',
    course: weekLessons[0].courseId,
    portal: portalId,
    startDate: slots[0].date,
    endDate: slots[slots.length - 1].date,
    weekdays: [...new Set(slots.map((slot) => new Date(`${slot.date}T12:00:00Z`).getUTCDay()))],
    minutesPerDay: 20,
    slots,
  }
  if (existing) {
    await payload.update({ collection: 'schedules', id: existing.id, overrideAccess: true, data: data as never })
    bump(reused, 'schedules')
    return
  }
  await payload.create({ collection: 'schedules', overrideAccess: true, data: data as never })
  bump(created, 'schedules')
}

async function fillSeats(payload: Payload, user: Doc, portalId: number, created: Record<string, number>, reused: Record<string, number>) {
  const seats = (await payload.find({
    collection: 'seats',
    overrideAccess: true,
    depth: 0,
    limit: 40,
    sort: 'position',
  })).docs as unknown as Doc[]
  if (!seats.length) return
  const have = (await payload.find({
    collection: 'seat-visits',
    overrideAccess: true,
    depth: 0,
    limit: 80,
    where: { user: { equals: user.id } },
  })).docs as unknown as Doc[]
  const seen = new Set(have.map((row) => idOf(row.seat)).filter((id): id is number => Boolean(id)))
  const want = 12
  if (seen.size >= want) {
    bump(reused, 'seats', seen.size)
    return
  }
  for (const seat of seats) {
    if (seen.size >= want) break
    if (seen.has(seat.id)) continue
    await payload.create({
      collection: 'seat-visits',
      overrideAccess: true,
      data: { user: user.id, seat: seat.id, portal: portalId, returned: true } as never,
    })
    seen.add(seat.id)
    bump(created, 'seats')
  }
}

async function fillCircle(payload: Payload, portalId: number, lessons: MatchedLesson[], created: Record<string, number>, reused: Record<string, number>) {
  const lessonIds = lessons.map((lesson) => lesson.id)
  if (!lessonIds.length) return
  const points = (await payload.find({
    collection: 'engagement-points',
    overrideAccess: true,
    depth: 0,
    limit: 1000,
    pagination: false,
    where: { and: [{ lesson: { in: lessonIds } }, { status: { not_equals: 'draft' } }, { family: { not_equals: 'workbook' } }] },
  })).docs as unknown as Doc[]
  for (const point of points) {
    if (String(point.status || 'published') !== 'published') continue
    const drafts = circleDraftsForPoint({
      prompt: String(point.prompt || ''),
      kind: String(point.kind || 'reflection'),
      options: Array.isArray(point.options) ? point.options.map(String) : undefined,
    })
    const fallback = answersForPoint({ prompt: String(point.prompt || ''), kind: String(point.kind || 'reflection'), options: Array.isArray(point.options) ? point.options.map(String) : undefined })
    for (const draft of drafts.length ? drafts : fallback) {
      const already = await one(payload, 'circle-answers', {
        and: [
          { point: { equals: point.id } },
          { name: { equals: draft.name } },
          { body: { equals: draft.body } },
        ],
      })
      if (already) {
        bump(reused, 'circle')
        continue
      }
      await payload.create({
        collection: 'circle-answers',
        overrideAccess: true,
        data: {
          point: point.id,
          lesson: idOf(point.lesson) || undefined,
          portal: portalId,
          name: draft.name,
          body: draft.body,
          tone: draft.tone,
          length: draft.length,
          origin: 'staff',
          enabled: true,
        },
      })
      bump(created, 'circle')
    }
  }
}

async function fillLearner(
  payload: Payload,
  user: Doc,
  portalId: number,
  lessons: MatchedLesson[],
  created: Record<string, number>,
  reused: Record<string, number>,
  notes: string[],
) {
  await fillOpening(payload, user, portalId, created, reused)
  const plan = await fillProgress(payload, user, portalId, lessons, created, reused, notes)
  await fillAnswers(payload, user, portalId, plan.map((row) => row.lesson), created, reused)
  await fillRituals(payload, user, portalId, created, reused)
  await fillSeats(payload, user, portalId, created, reused)
  await fillWeek(payload, user, portalId, lessons, created, reused)
  return plan
}

export async function seedWalkthroughDemo(payload: Payload): Promise<WalkthroughSeedResult | WalkthroughSeedFailure> {
  const notes: string[] = []
  const created: Record<string, number> = {}
  const reused: Record<string, number> = {}
  const { portal } = await ensurePortal(payload, notes)
  const blocked = walkthroughDemoGuard(String(portal.slug || ''))
  if (blocked) return { ok: false, reason: blocked }
  const portalId = portal.id
  const lessons = await loadMatchedLessons(payload)
  const courseIds = [...new Set(lessons.map((lesson) => lesson.courseId))]
  const packIds = await adoptCourses(payload, portalId, courseIds, created, reused)
  const code = await ensureLearnerCode(payload, portalId, packIds, notes)
  const walkthrough = await ensureLearner(
    payload,
    { email: WALKTHROUGH_LEARNER_EMAIL, name: WALKTHROUGH_LEARNER_NAME, create: true },
    portalId,
    code.id,
    courseIds,
    notes,
  )
  if (!walkthrough) return { ok: false, reason: `${WALKTHROUGH_LEARNER_EMAIL} could not be used on ${WALKTHROUGH_PORTAL_SLUG}. Nothing else was written for that account.` }
  const alsoFilled: string[] = []
  const plan = await fillLearner(payload, walkthrough.user, portalId, lessons, created, reused, notes)
  for (const email of EXISTING_FILL_EMAILS) {
    const existing = await ensureLearner(
      payload,
      { email, name: email === AFTERNOON_WALK_EMAIL ? AFTERNOON_WALK_NAME : WALKTHROUGH_LEARNER_NAME, create: false },
      portalId,
      code.id,
      courseIds,
      notes,
    )
    if (!existing) continue
    await fillLearner(payload, existing.user, portalId, lessons, created, reused, notes)
    alsoFilled.push(email)
  }
  await fillCircle(payload, portalId, lessons, created, reused)
  if (!lessons.some((lesson) => lesson.key === 'sheltered')) {
    notes.push('Divinely Sheltered was not in the library. Other key talks were still filled.')
  }
  const joinCode = String(code.code || '')
  return {
    ok: true,
    portal: WALKTHROUGH_PORTAL_SLUG,
    joinCode,
    joinPath: `/join?code=${joinCode}`,
    learnerEmail: WALKTHROUGH_LEARNER_EMAIL,
    learnerName: String(walkthrough.user.name || WALKTHROUGH_LEARNER_NAME),
    createdLearner: walkthrough.created,
    password: walkthrough.password,
    alsoFilled,
    courses: plan.map((row) => ({ title: row.lesson.title, key: row.lesson.key, percent: row.percent })),
    created,
    reused,
    notes,
  }
}
