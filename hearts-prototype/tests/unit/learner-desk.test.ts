import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dir = mkdtempSync(path.join(tmpdir(), 'hearts-desk-'))
process.env.DATABASE_URL = `file:${path.join(dir, 'hearts.db')}`
process.env.DATABASE_ADAPTER = 'sqlite'
process.env.PAYLOAD_SECRET = 'learner-desk-test-secret-32-characters'
Object.assign(process.env, { NODE_ENV: 'test' })

test('a portal admin cannot touch another portal, and deleting an account wipes personal data', { timeout: 180_000 }, async () => {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config')
  const {
    bulkLearnerAction,
    deleteDiary,
    deleteLearnerAccount,
    deletePlan,
    resetLearnerPassword,
  } = await import('../../src/server/learner-desk')
  const payload = await getPayload({ config })

  const portalA = await payload.create({
    collection: 'portals',
    overrideAccess: true,
    data: { name: 'Desk A', slug: 'desk-a', kind: 'mosque', wizardDone: true } as never,
  })
  const portalB = await payload.create({
    collection: 'portals',
    overrideAccess: true,
    data: { name: 'Desk B', slug: 'desk-b', kind: 'mosque', wizardDone: true } as never,
  })
  const adminA = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: { email: 'admin-a@desk.test', password: 'portal-admin', name: 'Admin A', role: 'portal-admin', tenants: [{ tenant: portalA.id }] } as never,
  })
  const teacherA = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: { email: 'teacher-a@desk.test', password: 'portal-teacher', name: 'Teacher A', role: 'teacher', tenants: [{ tenant: portalA.id }] } as never,
  })
  const learnerA = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: { email: 'learner-a@desk.test', password: 'portal-learner', name: 'Learner A', role: 'learner', tenants: [{ tenant: portalA.id }] } as never,
  })
  const learnerB = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: { email: 'learner-b@desk.test', password: 'portal-learner', name: 'Learner B', role: 'learner', tenants: [{ tenant: portalB.id }] } as never,
  })
  const kept = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: { email: 'learner-kept@desk.test', password: 'portal-learner', name: 'Learner Kept', role: 'learner', tenants: [{ tenant: portalA.id }] } as never,
  })

  const course = await payload.create({ collection: 'courses', overrideAccess: true, data: { title: 'Desk course', origin: 'local', portal: portalA.id } })
  const unit = await payload.create({ collection: 'units', overrideAccess: true, data: { title: 'Desk unit', course: course.id, order: 1 } })
  const lesson = await payload.create({ collection: 'lessons', overrideAccess: true, data: { title: 'Desk talk', unit: unit.id, course: course.id, order: 1 } })
  const point = await payload.create({
    collection: 'engagement-points',
    overrideAccess: true,
    data: { lesson: lesson.id, second: 1, prompt: 'What stayed with you?', kind: 'reflection' },
  })
  const answer = await payload.create({
    collection: 'answers',
    overrideAccess: true,
    data: { point: point.id, user: learnerA.id, lesson: lesson.id, body: 'A private line', portal: portalA.id, keepPrivate: true } as never,
  })
  const diary = await payload.create({
    collection: 'workbook-entries',
    overrideAccess: true,
    data: { user: learnerA.id, answer: answer.id, body: 'A private line', consent: false, portal: portalA.id } as never,
  })
  const ownPlan = await payload.create({
    collection: 'schedules',
    overrideAccess: true,
    data: { name: 'Only A', owner: learnerA.id, learners: [learnerA.id], startDate: '2026-10-01', endDate: '2026-10-08', weekdays: [1], slots: [], portal: portalA.id } as never,
  })
  const sharedPlan = await payload.create({
    collection: 'schedules',
    overrideAccess: true,
    data: {
      name: 'Shared',
      owner: learnerA.id,
      learners: [learnerA.id, kept.id],
      startDate: '2026-10-01',
      endDate: '2026-10-08',
      weekdays: [1],
      slots: [],
      portal: portalA.id,
    } as never,
  })
  const insight = await payload.create({
    collection: 'insight-events' as 'users',
    overrideAccess: true,
    data: {
      kind: 'tap',
      route: '/p/desk-a',
      sessionId: 'desk-session',
      subject: String(learnerA.id),
      portal: portalA.id,
      props: { email: 'learner-a@desk.test', note: 'kept', name: 'Learner A' },
      at: new Date().toISOString(),
    } as never,
  })
  const experiment = await payload.create({
    collection: 'experiments' as 'users',
    overrideAccess: true,
    data: {
      key: 'desk-cascade',
      name: 'Desk cascade',
      status: 'running',
      slot: 'feed-line',
      surface: 'feed',
      allocation: 'fixed',
      primaryMetric: 'clip_cta_tap',
      variants: [
        { key: 'a', label: 'A', payload: { text: 'Hello' }, weight: 1 },
        { key: 'b', label: 'B', payload: { text: 'Hello again' }, weight: 1 },
      ],
    } as never,
  })
  const exposure = await payload.create({
    collection: 'experiment-events' as 'users',
    overrideAccess: true,
    data: {
      experiment: experiment.id,
      experimentKey: 'desk-cascade',
      variantKey: 'a',
      kind: 'exposure',
      event: 'seen',
      learner: learnerA.id,
      subject: `learner:${learnerA.id}`,
      portal: portalA.id,
      props: { email: 'learner-a@desk.test', count: 1 },
      at: new Date().toISOString(),
    } as never,
  })

  const refused = await resetLearnerPassword(payload, adminA, learnerB.id)
  assert.match(refused.error || '', /another portal/)
  const stillB = await payload.findByID({ collection: 'users', id: learnerB.id, overrideAccess: true, depth: 0 })
  assert.equal(stillB.email, 'learner-b@desk.test')

  const teacher = await resetLearnerPassword(payload, teacherA, learnerA.id)
  assert.match(teacher.error || '', /portal admin/)
  const diaryRefused = await deleteDiary(payload, teacherA, diary.id)
  assert.match(diaryRefused.error || '', /portal admin/)
  const planOk = await deletePlan(payload, teacherA, ownPlan.id)
  assert.match(planOk.notice || '', /deleted/)
  const gonePlan = await payload.findByID({ collection: 'schedules', id: ownPlan.id, overrideAccess: true, depth: 0 }).catch(() => null)
  assert.equal(gonePlan, null)

  const wrong = await deleteLearnerAccount(payload, adminA, learnerA.id, 'Someone else')
  assert.match(wrong.error || '', /Nothing was deleted/)
  const stillA = await payload.findByID({ collection: 'users', id: learnerA.id, overrideAccess: true, depth: 0 })
  assert.equal(stillA.email, 'learner-a@desk.test')

  const bulk = await bulkLearnerAction(payload, adminA, [learnerA.id, learnerB.id], 'remove', 'remove')
  assert.match(bulk.error || '', /another portal/)
  const stillIn = await payload.findByID({ collection: 'users', id: learnerA.id, overrideAccess: true, depth: 0 })
  assert.equal((stillIn as { tenants?: unknown[] }).tenants?.length, 1)

  const removed = await deleteLearnerAccount(payload, adminA, learnerA.id, 'Learner A')
  assert.match(removed.notice || '', /deleted/)
  const missing = await payload.findByID({ collection: 'users', id: learnerA.id, overrideAccess: true, depth: 0 }).catch(() => null)
  assert.equal(missing, null)
  const diaryGone = await payload.findByID({ collection: 'workbook-entries', id: diary.id, overrideAccess: true, depth: 0 }).catch(() => null)
  assert.equal(diaryGone, null)
  const answerGone = await payload.findByID({ collection: 'answers', id: answer.id, overrideAccess: true, depth: 0 }).catch(() => null)
  assert.equal(answerGone, null)
  const shared = await payload.findByID({ collection: 'schedules', id: sharedPlan.id, overrideAccess: true, depth: 0 })
  const members = ((shared as { learners?: unknown[] }).learners || []).map((item) => (typeof item === 'object' && item ? (item as { id: number }).id : item))
  assert.deepEqual(members, [kept.id])
  assert.equal((shared as { owner?: unknown }).owner ?? null, null)

  const event = await payload.findByID({ collection: 'insight-events' as 'users', id: insight.id, overrideAccess: true, depth: 0 })
  assert.equal((event as { subject?: string }).subject, 'removed')
  const props = (event as { props?: Record<string, unknown> }).props || {}
  assert.equal(props.note, 'kept')
  assert.equal(props.email, undefined)
  assert.equal(props.name, undefined)

  const seen = await payload.findByID({ collection: 'experiment-events' as 'users', id: exposure.id, overrideAccess: true, depth: 0 })
  assert.equal((seen as { subject?: string }).subject, 'removed')
  assert.equal((seen as { learner?: unknown }).learner ?? null, null)
  assert.equal(((seen as { props?: { count?: number; email?: string } }).props || {}).count, 1)
  assert.equal(((seen as { props?: { email?: string } }).props || {}).email, undefined)

  const log = await payload.find({
    collection: 'audit-log',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { event: { equals: 'learner.delete' } },
  })
  const entry = log.docs.find((row) => (row as { detail?: { learnerId?: number } }).detail?.learnerId === learnerA.id) as { actor?: number; at?: string; target?: unknown; detail?: { name?: string; email?: string } }
  assert.ok(entry, 'delete is in the audit log')
  assert.equal(entry.actor, adminA.id)
  assert.ok(entry.at)
  assert.equal(entry.target ?? null, null)
  assert.equal(entry.detail?.name, 'Learner A')
  assert.equal(entry.detail?.email, 'learner-a@desk.test')
  const resetLog = await payload.find({
    collection: 'audit-log',
    overrideAccess: true,
    depth: 0,
    limit: 5,
    where: { event: { equals: 'learner.refused' } },
  })
  assert.ok(resetLog.docs.length > 0)
  assert.equal(JSON.stringify(resetLog.docs).includes('portal-learner'), false)
})
