import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FUNNEL_STEPS, funnelMaths, retentionByDay, retentionFromBuckets, returnBucketFromDays } from './insight-funnel'

test('funnel counts unique sessions and drop-off from the previous step', () => {
  const events = [
    { sessionId: 'a', step: 'opening_questions' },
    { sessionId: 'b', step: 'opening_questions' },
    { sessionId: 'c', step: 'opening_questions' },
    { sessionId: 'a', step: 'first_clip' },
    { sessionId: 'b', step: 'first_clip' },
    { sessionId: 'a', step: 'course_start' },
    { sessionId: 'a', step: 'study_plan_saved' },
    { sessionId: 'a', step: 'opening_questions' },
  ]
  const result = funnelMaths(events)
  assert.equal(result.started, 3)
  assert.equal(result.finished, 1)
  assert.equal(result.steps[0].sessions, 3)
  assert.equal(result.steps[1].sessions, 2)
  assert.equal(result.steps[2].sessions, 1)
  assert.equal(result.steps[3].sessions, 1)
  assert.ok(Math.abs(result.steps[1].fromPrevious - 2 / 3) < 1e-9)
  assert.ok(Math.abs(result.steps[1].dropOff - 1 / 3) < 1e-9)
  assert.ok(Math.abs(result.completion - 1 / 3) < 1e-9)
  assert.deepEqual(result.steps.map((row) => row.key), FUNNEL_STEPS.map((row) => row.key))
})

test('funnel ignores unknown steps and empty session ids', () => {
  const result = funnelMaths([
    { sessionId: '', step: 'opening_questions' },
    { sessionId: 'x', step: 'typed_answer' },
  ])
  assert.equal(result.started, 0)
  assert.equal(result.steps[0].sessions, 0)
})

test('retention by day uses first-seen cohort and later visits', () => {
  const firstSeen = { a: '2026-02-01', b: '2026-02-01', c: '2026-02-02' }
  const visits = [
    { subject: 'a', day: '2026-02-01' },
    { subject: 'a', day: '2026-02-02' },
    { subject: 'b', day: '2026-02-01' },
    { subject: 'b', day: '2026-02-08' },
    { subject: 'c', day: '2026-02-02' },
  ]
  const result = retentionByDay(firstSeen, visits, [1, 7])
  assert.equal(result.cohort, 3)
  assert.equal(result.points[0].returned, 1)
  assert.equal(result.points[1].returned, 1)
})

test('return buckets are coarse and drive next-day retention', () => {
  assert.equal(returnBucketFromDays(0), '0')
  assert.equal(returnBucketFromDays(1), '1')
  assert.equal(returnBucketFromDays(4), '2-7')
  assert.equal(returnBucketFromDays(8), '8+')
  assert.equal(returnBucketFromDays(null), null)
  const result = retentionFromBuckets(['1', '1', '2-7', '8+', '0', '', null])
  assert.equal(result.cohort, 5)
  assert.equal(result.points[0].returned, 2)
  assert.ok(Math.abs(result.points[0].rate - 0.4) < 1e-9)
})
