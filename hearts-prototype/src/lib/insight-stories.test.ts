import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildInsightStories, type InsightPoint } from './insight-stories'

const thin = buildInsightStories([])

test('thin data still names a next step for every insight', () => {
  assert.deepEqual(thin.map((story) => story.actionLabel), [
    'Start an experiment on this',
    'Make a study plan from this',
    'Message the teacher',
    'Open the talk',
  ])
  assert.equal(thin.every((story) => story.thin), true)
  assert.equal(thin.every((story) => story.moments.length === 0), true)
})

test('a small set of visits fills numbers, a trend and drivers without a person', () => {
  const points: InsightPoint[] = [
    { kind: 'funnel', route: '/p/east-london/start', at: '2026-10-01T10:00:00.000Z', sessionId: 's1', step: 'opening_questions', portalId: 3 },
    { kind: 'funnel', route: '/p/east-london/feed', at: '2026-10-01T10:05:00.000Z', sessionId: 's1', step: 'first_clip', portalId: 3 },
    { kind: 'route', route: '/p/east-london/feed', at: '2026-10-01T10:06:00.000Z', sessionId: 's1', portalId: 3, returnBucket: '1' },
    { kind: 'clip_watch', route: '/p/east-london/feed', at: '2026-10-02T11:00:00.000Z', sessionId: 's1', clipId: '12', watchPct: 80, portalId: 3 },
    { kind: 'angry_tap', route: '/p/east-london/feed', at: '2026-10-02T11:02:00.000Z', sessionId: 's1', portalId: 3 },
    { kind: 'funnel', route: '/p/east-london/course/9', at: '2026-10-02T11:03:00.000Z', sessionId: 's1', step: 'course_start', portalId: 3 },
  ]
  const stories = buildInsightStories(points)
  const leaving = stories.find((story) => story.key === 'leaving')!
  assert.equal(leaving.thin, false)
  assert.equal(leaving.numbers[0]?.value, '1')
  assert.ok(leaving.trend.length >= 1)
  assert.ok(leaving.drivers.some((row) => row.kind === 'portal' && row.id === '3'))
  assert.ok(leaving.drivers.some((row) => row.kind === 'course' && row.id === '9'))
  const talks = stories.find((story) => story.key === 'talks')!
  assert.equal(talks.thin, false)
  assert.ok(talks.drivers.some((row) => row.kind === 'talk' && row.id === '12'))
  const dumped = JSON.stringify(stories)
  assert.equal(dumped.includes('learner'), false)
  assert.equal(dumped.includes('@'), false)
})
