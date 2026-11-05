import assert from 'node:assert/strict'
import { test } from 'node:test'
import { experimentAuditLine } from './experiment-slots'
import { SAFETY_MIN_EXPOSURES, SAFETY_RATE_GAP, harmRate, normaliseSafetyMetric, safetyGuard } from './experiment-guard'

const quiet = { exposures: 80, harms: 2 }
const worse = { exposures: 80, harms: 10 }

test('the safety guard stays quiet on a thin sample', () => {
  const thin = safetyGuard({ exposures: SAFETY_MIN_EXPOSURES - 1, harms: 8 }, { exposures: 80, harms: 20 })
  assert.equal(thin.dropped, false)
  const otherThin = safetyGuard(quiet, { exposures: 10, harms: 8 })
  assert.equal(otherThin.dropped, false)
})

test('the safety guard trips when care alerts or drop-offs rise above the control', () => {
  const held = safetyGuard(quiet, { exposures: 80, harms: 2 })
  assert.equal(held.dropped, false)
  assert.equal(harmRate(quiet), 2 / 80)
  const safer = safetyGuard(worse, quiet)
  assert.equal(safer.dropped, false)
  const dropped = safetyGuard(quiet, worse)
  assert.equal(dropped.dropped, true)
  assert.ok(dropped.currentRate > dropped.baselineRate + SAFETY_RATE_GAP)
  const names = { slot: 'feed-cta-label', variants: [] }
  assert.equal(experimentAuditLine('experiment.safety', {}, names), 'Paused: the safety metric dropped')
  assert.equal(experimentAuditLine('experiment.bandit', { reason: 'time' }, names), 'Stopped: four weeks are up')
  assert.equal(experimentAuditLine('experiment.bandit', { reason: 'best' }, names), 'Stopped: one version is likely best')
})

test('safety names map to care alerts or drop-offs', () => {
  assert.equal(normaliseSafetyMetric('care alerts'), 'care_alert')
  assert.equal(normaliseSafetyMetric('drop-offs'), 'drop_off')
  assert.equal(normaliseSafetyMetric('scripture'), null)
})
