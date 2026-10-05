// Idempotent demo for the Teach "On time" column.
// Creates a portal named hearts-demo and four learners with a study plan.
// It never reads or writes a user outside that portal, and it refuses a production or remote database.
import { getPayload } from 'payload'
import config from '../payload.config'
import { isProduction, isRemoteDatabase } from '../lib/env'
import { portalIdOf } from '../lib/ids'
import { dateKey, demoTimeline, finishedBySchedule } from '../lib/on-time'

const SLUG = 'hearts-demo'
const DOMAIN = '@hearts-demo.test'
const PASSWORD = 'demo-timed'
const PLAN = 'Demo study days'
const COURSE = 'Demo sittings'
const ADMIN = { email: `demo-admin${DOMAIN}`, name: 'Nabil Hassan (demo)' }

const TITLES = [
  'One day, as it was told (demo)',
  'How he sat with them (demo)',
  'Tell me about Islam (demo)',
  'The two testimonies (demo)',
  'Establishing the prayer (demo)',
  'Zakat and who it is for (demo)',
  'Fasting the month (demo)',
  'The walk of Hajj (demo)',
  'He came to teach you (demo)',
]

type Payload = Awaited<ReturnType<typeof getPayload>>
type Doc = { id: number; email?: string; portal?: unknown; user?: unknown; learners?: unknown; title?: string; order?: number }

function num(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value && !Number.isNaN(Number(value))) return Number(value)
  if (value && typeof value === 'object' && 'id' in value) return num((value as { id?: unknown }).id)
  return null
}

function refuse(message: string): never {
  console.error(message)
  process.exit(1)
}

async function main() {
  if (isProduction() || isRemoteDatabase()) {
    refuse('Refusing to write demo learners on a production or remote database. Nothing was changed.')
  }
  const payload = await getPayload({ config })
  const today = dateKey(new Date())
  const found = await payload.find({ collection: 'portals', overrideAccess: true, limit: 1, where: { slug: { equals: SLUG } } })
  const portal = found.docs[0] || await payload.create({
    collection: 'portals',
    overrideAccess: true,
    data: {
      name: 'HEARTS demo',
      slug: SLUG,
      kind: 'mosque',
      welcome: 'A demo portal for the Teach page. These learners are not real.',
      organisationName: 'HEARTS demo',
      wizardDone: true,
      colour: '#123f3a',
      timeZone: 'America/Toronto',
    },
  })
  if ((portal as { timeZone?: string }).timeZone !== 'America/Toronto') {
    await payload.update({ collection: 'portals', id: portal.id, overrideAccess: true, data: { timeZone: 'America/Toronto' } })
  }
  if (portal.slug !== SLUG) refuse('The demo portal slug did not match. Nothing else was written.')

  const course = await ensureCourse(payload, portal.id)
  const lessons = await ensureLessons(payload, course.id, portal.id)
  const points = await ensurePoints(payload, lessons)
  const { fillMissingCircleAnswers } = await import('./circle-seed')
  const { attachExtraPlacing, ensureDefaultPlacing } = await import('./placing-seed')
  await ensureDefaultPlacing(payload)
  await attachExtraPlacing(payload, portal.id)
  await fillMissingCircleAnswers(payload)
  const admin = await ensureUser(payload, portal.id, { ...ADMIN, role: 'portal-admin' })
  const timeline = demoTimeline(today, lessons.map((lesson) => lesson.id))
  const learners = []
  for (const [index, person] of timeline.people.entries()) {
    learners.push(await ensureUser(payload, portal.id, {
      email: person.email,
      name: person.name,
      role: 'learner',
      joinedAt: new Date(`${dateKey(new Date(Date.now() - (12 - index) * 86_400_000))}T09:00:00.000Z`).toISOString(),
    }))
  }
  const allow = new Set([admin.id, ...learners.map((learner) => learner.id)])
  for (const id of allow) await assertDemo(payload, id, portal.id)

  await removeScoped(payload, 'completions', portal.id, allow)
  await removeScoped(payload, 'answers', portal.id, allow)
  await removePlans(payload, portal.id, allow)

  const learnerIds = learners.map((learner) => learner.id)
  await payload.create({
    collection: 'schedules',
    overrideAccess: true,
    data: {
      name: PLAN,
      owner: admin.id,
      learners: learnerIds,
      targetType: 'course',
      course: course.id,
      portal: portal.id,
      startDate: timeline.slots[0].date,
      endDate: timeline.slots.at(-1)!.date,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      slots: timeline.slots.map((slot, index) => ({ date: slot.date, lessonId: slot.lessonId, title: TITLES[index] })),
    },
  })

  const byEmail = new Map(learners.map((learner, index) => [timeline.people[index].email, learner]))
  for (const person of timeline.people) {
    const user = byEmail.get(person.email)!
    for (const watch of person.watches) {
      const dates = timeline.slots.filter((slot) => slot.lessonId === watch.lessonId).map((slot) => slot.date)
      await payload.create({
        collection: 'completions',
        overrideAccess: true,
        data: {
          user: user.id,
          lesson: watch.lessonId,
          portal: portal.id,
          percent: 100,
          onTime: finishedBySchedule(dates, watch.watchedOn),
          watchedAt: `${watch.watchedOn}T18:00:00.000Z`,
        },
      })
    }
    for (const answer of person.answers) {
      const point = points.get(answer.lessonId)
      if (!point) continue
      await payload.create({
        collection: 'answers',
        overrideAccess: true,
        data: {
          user: user.id,
          lesson: answer.lessonId,
          point: point.id,
          portal: portal.id,
          body: answerLine(person.name, answer.answeredOn),
          answeredAt: `${answer.answeredOn}T20:15:00.000Z`,
          shareWithTeacher: false,
          keepPrivate: true,
        },
      })
    }
  }

  console.log(`Demo portal /p/${SLUG} is ready. Sign in as ${ADMIN.email} / ${PASSWORD}`)
  for (const person of timeline.people) {
    const watched = person.watches.length
    const answers = person.answers.length
    console.log(`  ${person.name}: ${watched} parts watched, ${answers} answers`)
  }
  process.exit(0)
}

function answerLine(name: string, day: string) {
  return `${name.replace(' (demo)', '')} wrote this on ${day}, as a demo answer.`
}

async function ensureCourse(payload: Payload, portalId: number) {
  const found = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    limit: 1,
    where: { and: [{ title: { equals: COURSE } }, { portal: { equals: portalId } }] },
  })
  if (found.docs[0]) return found.docs[0]
  return payload.create({
    collection: 'courses',
    overrideAccess: true,
    data: {
      title: COURSE,
      summary: 'Nine short parts used only to show the Teach page. Not a real course.',
      speaker: 'Demo circle',
      origin: 'local',
      portal: portalId,
      importable: false,
      visibility: 'published',
    },
  })
}

async function ensureLessons(payload: Payload, courseId: number, portalId: number) {
  let unit = (await payload.find({ collection: 'units', overrideAccess: true, limit: 1, where: { course: { equals: courseId } } })).docs[0]
  if (!unit) {
    unit = await payload.create({ collection: 'units', overrideAccess: true, data: { title: 'Sittings', course: courseId, order: 1 } })
  }
  const existing = (await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    sort: 'order',
    where: { course: { equals: courseId } },
  })).docs as Doc[]
  const lessons: Doc[] = []
  for (const [index, title] of TITLES.entries()) {
    const order = index + 1
    const have = existing.find((lesson) => Number(lesson.order) === order) || existing.find((lesson) => lesson.title === title)
    if (have) {
      lessons.push(have)
      continue
    }
    const created = await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: { title, unit: unit.id, course: courseId, portal: portalId, order, durationSeconds: 480, transcriptSource: 'none', speaker: 'Demo circle' },
    })
    lessons.push(created as Doc)
  }
  return lessons
}

async function ensurePoints(payload: Payload, lessons: Doc[]) {
  const points = new Map<number, Doc>()
  for (const lesson of lessons) {
    const found = await payload.find({ collection: 'engagement-points', overrideAccess: true, limit: 1, where: { lesson: { equals: lesson.id } } })
    const point = found.docs[0] || await payload.create({
      collection: 'engagement-points',
      overrideAccess: true,
      data: {
        lesson: lesson.id,
        second: 30,
        kind: 'reflection',
        prompt: 'What will you carry from this sitting into tomorrow?',
        timing: 'immediate',
        audience: 'everyone',
        status: 'published',
      },
    })
    points.set(lesson.id, point as Doc)
  }
  return points
}

async function ensureUser(payload: Payload, portalId: number, spec: { email: string; name: string; role: 'learner' | 'portal-admin'; joinedAt?: string }) {
  if (!spec.email.endsWith(DOMAIN)) refuse(`Refusing to create ${spec.email}: demo learners use ${DOMAIN}.`)
  const found = await payload.find({ collection: 'users', overrideAccess: true, limit: 1, where: { email: { equals: spec.email } } })
  const data = {
    email: spec.email,
    password: PASSWORD,
    name: spec.name,
    role: spec.role,
    audience: spec.role === 'learner' ? 'learner' : undefined,
    tenants: [{ tenant: portalId }],
    onboarded: true,
    seenWelcome: true,
    joinedAt: spec.joinedAt,
  }
  if (!found.docs[0]) return payload.create({ collection: 'users', overrideAccess: true, data }) as Promise<Doc>
  const existing = found.docs[0] as Doc
  if (portalIdOf(existing as { tenants?: { tenant?: unknown }[] }) !== portalId) {
    refuse(`Refusing to touch ${spec.email}: that account is not in the ${SLUG} portal.`)
  }
  return payload.update({ collection: 'users', id: existing.id, overrideAccess: true, data }) as Promise<Doc>
}

async function assertDemo(payload: Payload, id: number, portalId: number) {
  const user = await payload.findByID({ collection: 'users', id, overrideAccess: true, depth: 0 }) as Doc
  if (!String(user.email || '').endsWith(DOMAIN) || portalIdOf(user as { tenants?: { tenant?: unknown }[] }) !== portalId) {
    refuse(`Refusing to write history for user ${id}. They are not a ${SLUG} demo account.`)
  }
}

async function removeScoped(payload: Payload, collection: 'completions' | 'answers', portalId: number, allow: Set<number>) {
  const found = await payload.find({
    collection,
    overrideAccess: true,
    depth: 0,
    limit: 500,
    where: { and: [{ portal: { equals: portalId } }, { user: { in: [...allow] } }] },
  })
  for (const doc of found.docs as Doc[]) {
    const user = num(doc.user)
    const portal = num(doc.portal)
    if (!user || !allow.has(user) || portal !== portalId) refuse(`Refusing to delete a ${collection} row outside the demo portal.`)
    await payload.delete({ collection, id: doc.id, overrideAccess: true })
  }
}

async function removePlans(payload: Payload, portalId: number, allow: Set<number>) {
  const found = await payload.find({
    collection: 'schedules',
    overrideAccess: true,
    depth: 0,
    limit: 50,
    where: { and: [{ portal: { equals: portalId } }, { name: { equals: PLAN } }] },
  })
  for (const doc of found.docs as Doc[]) {
    if (num(doc.portal) !== portalId) refuse('Refusing to delete a study plan outside the demo portal.')
    const members = ((doc.learners as unknown[]) || []).map((item) => num(item)).filter((id): id is number => Boolean(id))
    if (members.some((id) => !allow.has(id))) refuse('Refusing to delete a study plan that includes someone outside the demo.')
    await payload.delete({ collection: 'schedules', id: doc.id, overrideAccess: true })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
