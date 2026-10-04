import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allowInsightBurst, angrySpotWords, insightBurstKey, insightEventRow, insightHoldsPerson, isAnswerScreen, isPrivateLane, replayLines, resetInsightBursts, sanitizeProps, sessionReplayScore } from './insight-events'
import { insightCollections } from '../collections-insights'
import { actionCta, parseUkDate, ukDate } from './calendar-context'
import { formatSlotLabel, slotPlainName } from './experiment-slots'

test('opening question routes are answer screens', () => {
  assert.equal(isAnswerScreen('/p/east-london/start'), true)
  assert.equal(isAnswerScreen('/p/east-london/welcome'), true)
  assert.equal(isAnswerScreen('/p/east-london/placing'), true)
  assert.equal(isAnswerScreen('/p/east-london/feed'), false)
  assert.equal(isAnswerScreen('/p/east-london/course/1'), false)
  assert.equal(isAnswerScreen('/p/east-london/course/1', { sheet: true }), true)
})

test('guarding the gaze is a private lane', () => {
  assert.equal(isPrivateLane('guarding-gaze'), true)
  assert.equal(isPrivateLane('patience'), false)
})

test('insight bursts are rate-limited', () => {
  resetInsightBursts()
  for (let i = 0; i < 40; i++) assert.equal(allowInsightBurst('sess-a', 40, 10_000, 1_000), true)
  assert.equal(allowInsightBurst('sess-a', 40, 10_000, 1_000), false)
  assert.equal(allowInsightBurst('sess-a', 40, 10_000, 12_000), true)
})

test('without a device cookie the burst key is IP and user-agent, so a minted id cannot escape the limit', () => {
  resetInsightBursts()
  const noCookie = insightBurstKey({ clientIp: '203.0.113.9', userAgent: 'Mozilla/5.0 Hearts' })
  assert.match(noCookie, /^ip:203\.0\.113\.9\|ua:/)
  assert.doesNotMatch(noCookie, /d[a-z0-9]+/)
  for (let i = 0; i < 40; i++) assert.equal(allowInsightBurst(noCookie, 40, 10_000, 1_000), true)
  assert.equal(allowInsightBurst(noCookie, 40, 10_000, 1_000), false)
  const stillNoCookie = insightBurstKey({ deviceId: '', clientIp: '203.0.113.9', userAgent: 'Mozilla/5.0 Hearts' })
  assert.equal(stillNoCookie, noCookie)
  assert.equal(allowInsightBurst(stillNoCookie, 40, 10_000, 1_000), false)
})

test('insight bursts prune stale keys from the map', () => {
  resetInsightBursts()
  assert.equal(allowInsightBurst('old', 1, 10_000, 1_000), true)
  assert.equal(allowInsightBurst('old', 1, 10_000, 1_000), false)
  assert.equal(allowInsightBurst('fresh', 1, 10_000, 12_000), true)
  assert.equal(allowInsightBurst('old', 1, 10_000, 12_000), true)
})

test('angry spots are in words, not raw coordinates', () => {
  const place = angrySpotWords({ route: '/p/east-london/feed', x: 196, y: 620, vw: 390, vh: 844 })
  assert.equal(place, 'the lower middle of the feed')
  assert.doesNotMatch(place, /196/)
})

test('CTA lines take a verb and hide raw {n}', () => {
  assert.equal(actionCta("A Friday reminder before Jumu'ah"), "Watch a Friday reminder before Jumu'ah ›")
  assert.equal(actionCta('Watch a short clip for Eid'), 'Watch a short clip for Eid ›')
  assert.equal(formatSlotLabel('Sit with this for {n} min'), 'Sit with this for min')
  assert.equal(slotPlainName('feed-cta-label'), 'Feed clip CTA')
})

test('UK dates are day month year', () => {
  assert.equal(ukDate('2026-10-04'), '4 October 2026')
  assert.equal(parseUkDate('4 October 2026'), '2026-10-04')
})

test('insights collections, props and stored rows never hold a learner or device', () => {
  for (const collection of insightCollections) {
    const names = collection.fields.map((field) => field.name)
    assert.ok(!names.includes('learner'), `${collection.slug} must not have learner`)
    assert.ok(!names.includes('deviceId'), `${collection.slug} must not have deviceId`)
    assert.deepEqual(insightHoldsPerson({ fields: names }), [])
  }
  const cleaned = sanitizeProps({
    learnerId: 9,
    deviceId: 'dabc123456',
    learner: 'learner:9',
    answer: 'a typed answer',
    lane: 'patience',
    x: 12,
  })
  assert.equal(cleaned.lane, 'patience')
  assert.equal(cleaned.x, 12)
  assert.equal(cleaned.learnerId, undefined)
  assert.equal(cleaned.deviceId, undefined)
  assert.deepEqual(insightHoldsPerson(cleaned), [])
  const row = insightEventRow({
    kind: 'tap',
    route: '/p/:portal/feed',
    sessionId: 's-anon-1',
    sampled: true,
    props: { learner: 'learner:4', deviceId: 'dx' },
    at: '2026-02-06T10:00:00.000Z',
    hideCoords: true,
  })
  assert.equal(row.subject, 's-anon-1')
  assert.equal((row as { learner?: unknown }).learner, undefined)
  assert.equal((row as { deviceId?: unknown }).deviceId, undefined)
  assert.deepEqual(insightHoldsPerson(row), [])
})

test('replay collapses tap dumps and prefers a journey', () => {
  const lines = replayLines([
    { kind: 'route', route: '/p/east-london' },
    { kind: 'route', route: '/p/east-london/feed' },
    { kind: 'clip_watch', route: '/p/east-london/feed', watchPct: 72 },
    { kind: 'tap', route: '/p/east-london/feed' },
    { kind: 'tap', route: '/p/east-london/feed' },
    { kind: 'tap', route: '/p/east-london/feed' },
  ])
  assert.equal(lines[0].text, 'route · Home')
  assert.match(lines.at(-1)?.text || '', /tapped the feed · 3 times/)
  const dump = sessionReplayScore(Array.from({ length: 30 }, () => ({ kind: 'tap', route: '/p/:portal/feed' })))
  const journey = sessionReplayScore([
    { kind: 'route', route: '/p/:portal' },
    { kind: 'route', route: '/p/:portal/feed' },
    { kind: 'clip_watch', route: '/p/:portal/feed' },
    { kind: 'route', route: '/p/:portal/course/1' },
  ])
  assert.ok(journey > dump)
})
