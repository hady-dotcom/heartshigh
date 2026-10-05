import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assignByHash, assignmentBucket, pickWeighted, splitSubjects, subjectForVariant, subjectKey } from '../../src/lib/experiment-assign'
import { applyFloor, autoWeights, BANDIT_FLOOR, BANDIT_MIN_TRAFFIC, chanceOfBeingBest, conversionRate, mulberry32, remainingLearners, verdictFor } from '../../src/lib/experiment-bandit'
import { mockWording } from '../../src/lib/experiment-copy'
import {
  EXPERIMENT_SLOTS,
  FIRST_WEEK_MS,
  MAX_EXPERIMENT_VARIANTS,
  draftsToAdd,
  experimentAuditLine,
  fallbackPayload,
  formatSlotLabel,
  isTestableSlot,
  payloadProblems,
  remainingVariantSlots,
  slotKeys,
  slotOf,
  usualWords,
  variantCopy,
  withinFirstWeek,
} from '../../src/lib/experiment-slots'
import { experimentDraftProblems as experimentProblems } from '../../src/lib/experiment-slots'

const rows = [
  { key: 'a', weight: 1 },
  { key: 'b', weight: 1 },
  { key: 'c', weight: 2 },
]

test('assignment is sticky for the same learner and experiment', () => {
  const first = assignByHash('feed-cta-label', subjectKey('learner', 7), rows)
  for (let n = 0; n < 40; n++) {
    assert.equal(assignByHash('feed-cta-label', subjectKey('learner', 7), rows), first)
  }
  assert.notEqual(assignByHash('feed-cta-label', subjectKey('learner', 8), rows), null)
})

test('assignment follows weights and stays inside 0..9999', () => {
  const bucket = assignmentBucket('demo', 'learner:1')
  assert.ok(bucket >= 0 && bucket < 10_000)
  assert.equal(pickWeighted(rows, 0), 'a')
  assert.equal(pickWeighted(rows, 2499), 'a')
  assert.equal(pickWeighted(rows, 2500), 'b')
  assert.equal(pickWeighted(rows, 4999), 'b')
  assert.equal(pickWeighted(rows, 5000), 'c')
  assert.equal(pickWeighted(rows, 9999), 'c')
  const heavy = [{ key: 'only', weight: 5 }, { key: 'none', weight: 0 }]
  assert.equal(pickWeighted(heavy, 1), 'only')
  assert.equal(pickWeighted(heavy, 9999), 'only')
})

test('two subjects can be found that land on different versions', () => {
  const found = splitSubjects('split-me', [{ key: 'alpha', weight: 1 }, { key: 'beta', weight: 1 }], 2)
  assert.equal(found.length, 2)
  const a = assignByHash('split-me', found[0], [{ key: 'alpha', weight: 1 }, { key: 'beta', weight: 1 }])
  const b = assignByHash('split-me', found[1], [{ key: 'alpha', weight: 1 }, { key: 'beta', weight: 1 }])
  assert.notEqual(a, b)
  assert.equal(assignByHash('x', subjectForVariant('x', rows, 'c')!, rows), 'c')
})

test('bandit keeps a 10% floor and does not shift before the minimum traffic', () => {
  const arms = [
    { key: 'a', exposures: 10, conversions: 8 },
    { key: 'b', exposures: 10, conversions: 1 },
  ]
  const early = autoWeights(arms, { a: 1, b: 1 }, { minTraffic: BANDIT_MIN_TRAFFIC })
  assert.ok(Math.abs(early.a - 0.5) < 1e-9)
  assert.ok(Math.abs(early.b - 0.5) < 1e-9)
  const late = autoWeights(
    [
      { key: 'a', exposures: 80, conversions: 40 },
      { key: 'b', exposures: 80, conversions: 8 },
    ],
    { a: 1, b: 1 },
    { minTraffic: 40, floor: BANDIT_FLOOR, rng: mulberry32(7), draws: 800 },
  )
  assert.ok(late.a >= BANDIT_FLOOR - 1e-9)
  assert.ok(late.b >= BANDIT_FLOOR - 1e-9)
  assert.ok(late.a > late.b)
  const floored = applyFloor({ a: 0.99, b: 0.01 }, ['a', 'b'], 0.1)
  assert.ok(floored.b >= 0.1 - 1e-9)
  assert.ok(Math.abs(floored.a + floored.b - 1) < 1e-9)
})

test('bandit never names a winner on a small sample', () => {
  const thin = verdictFor(
    [
      { key: 'a', label: 'Version A', exposures: 12, conversions: 10 },
      { key: 'b', label: 'Version B', exposures: 11, conversions: 1 },
    ],
    { rng: mulberry32(3), draws: 600 },
  )
  assert.equal(thin.claimed, false)
  assert.match(thin.text, /Too soon/)
  assert.doesNotMatch(thin.text, /treat it as the winner/)
  const ahead = verdictFor(
    [
      { key: 'a', label: 'Version A', exposures: 80, conversions: 20 },
      { key: 'b', label: 'Version B', exposures: 80, conversions: 48 },
    ],
    { rng: mulberry32(11), draws: 800 },
  )
  assert.equal(ahead.claimed, false)
  assert.match(ahead.text, /ahead/)
  assert.match(ahead.text, /likely better/)
  assert.match(ahead.text, /more/)
  const chance = chanceOfBeingBest(
    [
      { key: 'a', exposures: 80, conversions: 20 },
      { key: 'b', exposures: 80, conversions: 48 },
    ],
    { rng: mulberry32(11), draws: 800 },
  )
  assert.ok(chance.b > chance.a)
  assert.ok(remainingLearners(
    [
      { key: 'a', exposures: 80, conversions: 20 },
      { key: 'b', exposures: 80, conversions: 48 },
    ],
    chance,
  ) > 0)
  assert.equal(conversionRate(10, 3), 0.3)
})

test('slot whitelist refuses scripture, questions and unknown keys', () => {
  assert.deepEqual(slotKeys(), ['feed-cta-label', 'full-talk-cta-label', 'wide-video-framing', 'lanes-tab-label'])
  assert.equal(isTestableSlot('feed-cta-label'), true)
  assert.equal(isTestableSlot('quran-ayah'), false)
  assert.equal(slotOf('wide-video-framing')?.wired, false)
  assert.equal(slotOf('lanes-tab-label')?.wired, true)
  assert.deepEqual(fallbackPayload('feed-cta-label'), { label: 'Watch the 3-minute version' })
  assert.deepEqual(fallbackPayload('lanes-tab-label'), { label: 'Lanes' })
  assert.deepEqual(payloadProblems('lanes-tab-label', { label: 'Explore' }), [])
  assert.match(payloadProblems('sheikh-words', { label: 'x' })[0], /not on the testable list/)
  assert.match(payloadProblems('feed-cta-label', { quran: '1:1', label: 'Ready?' })[0], /not allowed/)
  assert.match(payloadProblems('feed-cta-label', { label: '<b>Ready</b>' })[0], /plain text/)
  assert.deepEqual(payloadProblems('feed-cta-label', { label: 'Ready for more?' }), [])
  assert.deepEqual(payloadProblems('wide-video-framing', { framing: 'split' }), [])
  assert.match(payloadProblems('wide-video-framing', { framing: 'zoom' })[0], /split or face-crop/)
  assert.equal(formatSlotLabel('Watch the whole talk ({n} min)', 12), 'Watch the whole talk (12 min)')
  assert.equal(formatSlotLabel('Watch the whole talk (N min)', 9), 'Watch the whole talk (9 min)')
})

test('experiment drafts are refused when they leave the whitelist', () => {
  const ok = experimentProblems({
    key: 'feed-cta-label',
    name: 'Feed clip CTA',
    slot: 'feed-cta-label',
    primaryMetric: 'clip_cta_tap',
    variants: [
      { key: 'ready', label: 'Ready for more?', payload: { label: 'Ready for more?' }, weight: 1, approved: true, source: 'staff' },
      { key: 'more', label: 'Hear more of this', payload: { label: 'Hear more of this' }, weight: 1, approved: true, source: 'staff' },
    ],
  })
  assert.deepEqual(ok, [])
  const bad = experimentProblems({
    key: 'talk-text',
    name: 'Rewrite the sheikh',
    slot: 'talk-transcript',
    primaryMetric: 'clip_cta_tap',
    variants: [
      { key: 'a', label: 'A', payload: { transcript: 'changed' }, weight: 1, approved: true, source: 'staff' },
      { key: 'b', label: 'B', payload: { transcript: 'other' }, weight: 1, approved: true, source: 'staff' },
    ],
  })
  assert.ok(bad.some((row) => /testable list/.test(row)))
})

test('mock AI wording stays on the copy slots and passes the checks', () => {
  const drafts = mockWording('feed-cta-label', 4)
  assert.equal(drafts.length, 4)
  for (const draft of drafts) {
    assert.deepEqual(payloadProblems('feed-cta-label', draft.payload), [])
    assert.equal(draft.source, 'mock')
  }
  assert.deepEqual(mockWording('wide-video-framing'), [])
  const tab = mockWording('lanes-tab-label', 4)
  assert.equal(tab.length, 4)
  assert.equal(tab[0].payload.label, 'Explore')
  assert.ok(EXPERIMENT_SLOTS.every((slot) => slot.kind === 'copy' || slot.kind === 'layout'))
})

test('lanes course starts only count in the first week after assignment', () => {
  const assigned = new Date('2026-10-01T00:00:00.000Z')
  assert.equal(withinFirstWeek(assigned, new Date('2026-10-01T00:00:00.000Z')), true)
  assert.equal(withinFirstWeek(assigned, new Date(assigned.getTime() + FIRST_WEEK_MS)), true)
  assert.equal(withinFirstWeek(assigned, new Date(assigned.getTime() + FIRST_WEEK_MS + 1)), false)
  assert.equal(withinFirstWeek(assigned, new Date('2026-09-30T23:59:59.000Z')), false)
  assert.equal(withinFirstWeek(null, assigned), false)
})

test('versions table copy is the plain words, not JSON', () => {
  assert.equal(variantCopy({ label: 'Explore' }, 'Lanes'), 'Explore')
  assert.equal(variantCopy({ framing: 'face-crop' }, 'split'), 'face-crop')
  assert.equal(variantCopy({ label: '{"label":"Explore"}' }, 'Lanes'), '{"label":"Explore"}')
  assert.equal(variantCopy(null, 'Lanes'), 'Lanes')
})

test('seven versions are allowed and a ninth is refused', () => {
  const seven = Array.from({ length: 7 }, (_, index) => ({
    key: `v${index + 1}`,
    label: `Line ${index + 1}`,
    payload: { label: `Line ${index + 1}` },
    weight: 1,
  }))
  assert.deepEqual(experimentProblems({
    key: 'feed-cta-label',
    name: 'Seven versions',
    slot: 'feed-cta-label',
    primaryMetric: 'clip_cta_tap',
    variants: seven,
  }), [])
  const eight = [...seven, { key: 'v8', label: 'Line 8', payload: { label: 'Line 8' }, weight: 1 }]
  assert.deepEqual(experimentProblems({
    key: 'feed-cta-label',
    name: 'Eight versions',
    slot: 'feed-cta-label',
    primaryMetric: 'clip_cta_tap',
    variants: eight,
  }), [])
  const nine = [...eight, { key: 'v9', label: 'Line 9', payload: { label: 'Line 9' }, weight: 1 }]
  assert.ok(experimentProblems({
    key: 'feed-cta-label',
    name: 'Nine versions',
    slot: 'feed-cta-label',
    primaryMetric: 'clip_cta_tap',
    variants: nine,
  }).some((row) => /eight versions/.test(row)))
  assert.equal(MAX_EXPERIMENT_VARIANTS, 8)
  assert.equal(remainingVariantSlots(seven), 1)
  assert.equal(draftsToAdd(7, 4), 1)
  assert.equal(draftsToAdd(3, 4), 4)
  assert.equal(draftsToAdd(8, 4), 0)
})

test('kill and start history lines are written in words', () => {
  const lanes = {
    slot: 'lanes-tab-label',
    variants: [
      { key: 'lanes', label: 'Lanes', payload: { label: 'Lanes' } },
      { key: 'explore', label: 'Explore', payload: { label: 'Explore' } },
    ],
  }
  assert.equal(usualWords(lanes), 'Lanes')
  assert.equal(experimentAuditLine('experiment.start', {}, lanes), 'Test started')
  assert.equal(experimentAuditLine('experiment.kill', { off: true }, lanes), 'Kill switch on: everyone back to Lanes')
  assert.equal(experimentAuditLine('experiment.kill', {}, { slot: 'feed-cta-label', variants: [] }), 'Kill switch on: everyone back to Watch the 3-minute version')
})

test('lanes tab draft is a valid experiment on the whitelist', () => {
  assert.deepEqual(experimentProblems({
    key: 'lanes-tab-label',
    name: 'Lanes tab label',
    slot: 'lanes-tab-label',
    primaryMetric: 'lanes_tab_tap',
    secondaryMetrics: ['lanes_course_start'],
    variants: [
      { key: 'lanes', label: 'Lanes', payload: { label: 'Lanes' }, weight: 1 },
      { key: 'explore', label: 'Explore', payload: { label: 'Explore' }, weight: 1 },
    ],
  }), [])
})
