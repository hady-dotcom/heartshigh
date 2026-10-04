import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allowInsightBurst, angrySpotWords, isAnswerScreen, isPrivateLane, replayLines, resetInsightBursts, sessionReplayScore } from './insight-events'
import { actionCta, parseUkDate, ukDate } from './calendar-context'
import { formatSlotLabel, slotPlainName } from './experiment-slots'

test('opening question routes are answer screens', () => {
  assert.equal(isAnswerScreen('/p/east-london/start'), true)
  assert.equal(isAnswerScreen('/p/east-london/welcome'), true)
  assert.equal(isAnswerScreen('/p/east-london/placing'), true)
  assert.equal(isAnswerScreen('/p/east-london/feed'), false)
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

test('angry spots are in words, not raw coordinates', () => {
  const place = angrySpotWords({ route: '/p/east-london/feed', x: 196, y: 620, vw: 390, vh: 844 })
  assert.match(place, /feed|middle|lower/i)
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
