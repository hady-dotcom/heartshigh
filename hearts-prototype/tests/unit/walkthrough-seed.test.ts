import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { AFTERNOON_WALK_EMAIL, WALKTHROUGH_LEARNER_EMAIL, WALKTHROUGH_PLAN_NAME } from '../../src/lib/walkthrough-demo'

const dir = mkdtempSync(path.join(tmpdir(), 'hearts-walkthrough-'))
process.env.DATABASE_URL = `file:${path.join(dir, 'hearts.db')}`
process.env.DATABASE_ADAPTER = 'sqlite'
process.env.PAYLOAD_SECRET = 'walkthrough-seed-test-secret-32-chars'
Object.assign(process.env, { NODE_ENV: 'test' })

test('demo:walkthrough writes only hearts-demo, never touches passwords, and a second run does not duplicate', { timeout: 180_000 }, async () => {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config')
  const { seedWalkthroughDemo } = await import('../../src/seed/walkthrough-demo')
  const payload = await getPayload({ config })

  const other = await payload.create({
    collection: 'portals',
    overrideAccess: true,
    data: { name: 'Other masjid', slug: 'other-masjid', kind: 'mosque', wizardDone: true } as never,
  })
  const outsider = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      email: 'outsider@masjid.org',
      password: 'keep-outsider-password',
      name: 'Outsider',
      role: 'learner',
      tenants: [{ tenant: other.id }],
    } as never,
  })

  const course = await payload.create({
    collection: 'courses',
    overrideAccess: true,
    data: {
      title: 'The Names Class 19: Ar-Rabb',
      speaker: 'Shaykh Mikaeel Smith',
      origin: 'master',
      importable: true,
      isPublic: true,
      importToken: 'AR-RABB',
      visibility: 'published',
    } as never,
  })
  const unit = await payload.create({
    collection: 'units',
    overrideAccess: true,
    data: { title: 'The sitting', course: course.id, order: 1 },
  })
  const lesson = await payload.create({
    collection: 'lessons',
    overrideAccess: true,
    data: {
      title: 'The Names Class 19: Ar-Rabb',
      unit: unit.id,
      course: course.id,
      speaker: 'Shaykh Mikaeel Smith',
      order: 1,
      durationSeconds: 600,
      youtubeId: 'ECaTWkof57E',
      transcriptSource: 'none',
    } as never,
  })
  const point = await payload.create({
    collection: 'engagement-points',
    overrideAccess: true,
    data: {
      lesson: lesson.id,
      second: 120,
      kind: 'reflection',
      prompt: 'What is one thing you have that you could see as Allah\'s rather than yours?',
      timing: 'immediate',
      audience: 'everyone',
      status: 'published',
    },
  })
  const demoPortal = await payload.create({
    collection: 'portals',
    overrideAccess: true,
    data: {
      name: 'HEARTS demo',
      slug: 'hearts-demo',
      kind: 'mosque',
      wizardDone: true,
      timeZone: 'America/Toronto',
    } as never,
  })
  const afternoon = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      email: AFTERNOON_WALK_EMAIL,
      password: 'keep-afternoon-walk-password',
      name: 'Afternoon Walk',
      role: 'learner',
      audience: 'learner',
      tenants: [{ tenant: demoPortal.id }],
      onboarded: true,
      seenWelcome: true,
    } as never,
  })
  await payload.create({
    collection: 'completions',
    overrideAccess: true,
    data: { user: afternoon.id, lesson: lesson.id, portal: demoPortal.id, percent: 40, sourceLevel: 'talk' },
  })
  await payload.create({
    collection: 'schedules',
    overrideAccess: true,
    data: {
      name: 'Afternoon sittings',
      owner: afternoon.id,
      learners: [afternoon.id],
      targetType: 'course',
      course: course.id,
      portal: demoPortal.id,
      startDate: '2026-10-05',
      endDate: '2026-10-11',
      weekdays: [1, 3],
      slots: [{ date: '2026-10-05', lessonId: lesson.id, title: 'Ar-Rabb' }],
    } as never,
  })

  await payload.create({
    collection: 'opening-scenes',
    overrideAccess: true,
    data: {
      key: 'extra',
      order: 1,
      caption: 'A little unexpected extra lands in your pocket.',
      subline: 'Go with your first thought.',
      layout: 'grid4',
      status: 'published',
      options: [
        { key: 'treat', label: 'Treat myself. I have earned it.' },
        { key: 'tuck', label: 'Tuck it away, just in case.' },
        { key: 'pass-on', label: 'Pass some on. Someone needs it.' },
        { key: 'pause', label: 'Pause. Then decide.' },
        { key: 'heavy', label: 'It is more than I can hold right now.', crisis: true },
      ],
    } as never,
  })

  const first = await seedWalkthroughDemo(payload)
  assert.equal(first.ok, true)
  if (!first.ok) return
  assert.equal(first.portal, 'hearts-demo')
  assert.equal(first.learnerEmail, WALKTHROUGH_LEARNER_EMAIL)
  assert.equal(first.createdLearner, true)
  assert.ok(first.joinCode)
  assert.match(first.joinPath, /\/join\?code=/)
  assert.ok(first.courses.some((row) => row.key === 'ar-rabb' && row.percent === 100))
  assert.ok(first.alsoFilled.includes(AFTERNOON_WALK_EMAIL))

  const portal = (await payload.find({
    collection: 'portals',
    overrideAccess: true,
    limit: 1,
    where: { slug: { equals: 'hearts-demo' } },
  })).docs[0]
  assert.ok(portal)
  const learner = (await payload.find({
    collection: 'users',
    overrideAccess: true,
    limit: 1,
    where: { email: { equals: WALKTHROUGH_LEARNER_EMAIL } },
  })).docs[0] as { id: number; email?: string }

  const completions = await payload.find({
    collection: 'completions',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { and: [{ portal: { equals: portal.id } }, { user: { equals: learner.id } }] },
  })
  assert.ok(completions.docs.length >= 1)
  const answers = await payload.find({
    collection: 'answers',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { and: [{ portal: { equals: portal.id } }, { user: { equals: learner.id } }] },
  })
  assert.ok(answers.docs.length >= 1)
  assert.ok(answers.docs.every((row) => !(row as { keepPrivate?: boolean }).keepPrivate || !(row as { shareWithLearners?: boolean }).shareWithLearners))
  const book = await payload.find({
    collection: 'workbook-entries',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { user: { equals: learner.id } },
  })
  assert.ok(book.docs.length >= 1)
  const rituals = await payload.find({
    collection: 'rituals',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { and: [{ portal: { equals: portal.id } }, { user: { equals: learner.id } }] },
  })
  assert.equal(rituals.docs.length, 8)
  const plans = await payload.find({
    collection: 'schedules',
    overrideAccess: true,
    depth: 0,
    limit: 10,
    where: { and: [{ portal: { equals: portal.id } }, { name: { equals: WALKTHROUGH_PLAN_NAME } }] },
  })
  assert.equal(plans.docs.length, 1)
  const circle = await payload.find({
    collection: 'circle-answers',
    overrideAccess: true,
    depth: 0,
    limit: 40,
    where: { and: [{ portal: { equals: portal.id } }, { point: { equals: point.id } }] },
  })
  assert.ok(circle.docs.length >= 4)
  const opening = await payload.find({
    collection: 'opening-answers',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { user: { equals: learner.id } },
  })
  assert.ok(opening.docs.length >= 1)

  const second = await seedWalkthroughDemo(payload)
  assert.equal(second.ok, true)
  if (!second.ok) return
  assert.equal(second.createdLearner, false)
  assert.equal(second.password, null)
  const completionsAgain = await payload.find({
    collection: 'completions',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { and: [{ portal: { equals: portal.id } }, { user: { equals: learner.id } }] },
  })
  assert.equal(completionsAgain.docs.length, completions.docs.length)
  const answersAgain = await payload.find({
    collection: 'answers',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { and: [{ portal: { equals: portal.id } }, { user: { equals: learner.id } }] },
  })
  assert.equal(answersAgain.docs.length, answers.docs.length)
  const ritualsAgain = await payload.find({
    collection: 'rituals',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { and: [{ portal: { equals: portal.id } }, { user: { equals: learner.id } }] },
  })
  assert.equal(ritualsAgain.docs.length, rituals.docs.length)
  const circleAgain = await payload.find({
    collection: 'circle-answers',
    overrideAccess: true,
    depth: 0,
    limit: 40,
    where: { and: [{ portal: { equals: portal.id } }, { point: { equals: point.id } }] },
  })
  assert.equal(circleAgain.docs.length, circle.docs.length)
  const plansAgain = await payload.find({
    collection: 'schedules',
    overrideAccess: true,
    depth: 0,
    limit: 10,
    where: { and: [{ portal: { equals: portal.id } }, { name: { equals: WALKTHROUGH_PLAN_NAME } }] },
  })
  assert.equal(plansAgain.docs.length, 1)

  const afternoonPlans = await payload.find({
    collection: 'schedules',
    overrideAccess: true,
    depth: 0,
    limit: 10,
    where: { and: [{ portal: { equals: portal.id } }, { owner: { equals: afternoon.id } }] },
  })
  assert.equal(afternoonPlans.docs.length, 1)
  assert.equal((afternoonPlans.docs[0] as { name?: string }).name, 'Afternoon sittings')
  const afternoonDone = await payload.find({
    collection: 'completions',
    overrideAccess: true,
    depth: 0,
    limit: 10,
    where: { and: [{ user: { equals: afternoon.id } }, { lesson: { equals: lesson.id } }] },
  })
  assert.equal(afternoonDone.docs.length, 1)
  assert.equal(Number((afternoonDone.docs[0] as { percent?: number }).percent), 100)
  const afternoonRituals = await payload.find({
    collection: 'rituals',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { user: { equals: afternoon.id } },
  })
  assert.ok(afternoonRituals.docs.length >= 8)

  const leakedCompletions = await payload.find({
    collection: 'completions',
    overrideAccess: true,
    depth: 0,
    limit: 10,
    where: { portal: { equals: other.id } },
  })
  assert.equal(leakedCompletions.docs.length, 0)
  const leakedAnswers = await payload.find({
    collection: 'answers',
    overrideAccess: true,
    depth: 0,
    limit: 10,
    where: { user: { equals: outsider.id } },
  })
  assert.equal(leakedAnswers.docs.length, 0)
  const sameOutsider = await payload.findByID({ collection: 'users', id: outsider.id, overrideAccess: true, depth: 0 })
  assert.equal((sameOutsider as { email?: string }).email, 'outsider@masjid.org')
})
