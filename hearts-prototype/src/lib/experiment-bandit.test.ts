import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BANDIT_CLAIM_CHANCE,
  BANDIT_FLOOR,
  BANDIT_MAX_WEEKS,
  BANDIT_WARMUP_PER_ARM,
  BANDIT_WEEK_MS,
  autoWeights,
  banditStop,
  mulberry32,
} from './experiment-bandit'

test('warm-up stays an even split until 100 learners have seen each version', () => {
  assert.equal(BANDIT_WARMUP_PER_ARM, 100)
  const early = autoWeights(
    [
      { key: 'a', exposures: 99, conversions: 90 },
      { key: 'b', exposures: 99, conversions: 1 },
    ],
    { a: 9, b: 1 },
  )
  assert.ok(Math.abs(early.a - 0.5) < 1e-9)
  assert.ok(Math.abs(early.b - 0.5) < 1e-9)
  const three = autoWeights(
    [
      { key: 'a', exposures: 10, conversions: 8 },
      { key: 'b', exposures: 10, conversions: 1 },
      { key: 'c', exposures: 4, conversions: 0 },
    ],
    { a: 1, b: 1, c: 1 },
  )
  assert.ok(Math.abs(three.a - 1 / 3) < 1e-9)
  assert.ok(Math.abs(three.b - 1 / 3) < 1e-9)
  assert.ok(Math.abs(three.c - 1 / 3) < 1e-9)
})

test('after the warm-up the bandit leans toward the leader and keeps a floor', () => {
  const late = autoWeights(
    [
      { key: 'a', exposures: 120, conversions: 80 },
      { key: 'b', exposures: 120, conversions: 20 },
    ],
    { a: 1, b: 1 },
    { rng: mulberry32(7), draws: 600 },
  )
  assert.ok(late.a > late.b)
  assert.ok(late.b >= BANDIT_FLOOR - 1e-9)
  assert.ok(Math.abs(late.a + late.b - 1) < 1e-9)
})

test('the bandit stops at 95% after the warm-up, and not before', () => {
  const options = { rng: mulberry32(4), draws: 500 }
  const warming = banditStop(
    [
      { key: 'a', exposures: 99, conversions: 90 },
      { key: 'b', exposures: 99, conversions: 2 },
    ],
    options,
  )
  assert.equal(warming.stop, false)
  const ready = banditStop(
    [
      { key: 'a', exposures: 120, conversions: 100 },
      { key: 'b', exposures: 120, conversions: 8 },
    ],
    options,
  )
  assert.equal(ready.stop, true)
  assert.equal(ready.reason, 'best')
  assert.equal(ready.leaderKey, 'a')
  assert.ok(ready.chance >= BANDIT_CLAIM_CHANCE)
})

test('the bandit stops after 4 weeks even when it is not sure', () => {
  assert.equal(BANDIT_MAX_WEEKS, 4)
  const start = Date.parse('2026-01-01T00:00:00.000Z')
  const shared = {
    rng: mulberry32(2),
    draws: 80,
    startedAt: start,
  }
  const early = banditStop(
    [
      { key: 'a', exposures: 12, conversions: 4 },
      { key: 'b', exposures: 12, conversions: 3 },
    ],
    { ...shared, now: start + BANDIT_MAX_WEEKS * BANDIT_WEEK_MS - 1 },
  )
  assert.equal(early.stop, false)
  const due = banditStop(
    [
      { key: 'a', exposures: 12, conversions: 4 },
      { key: 'b', exposures: 12, conversions: 3 },
    ],
    { ...shared, now: start + BANDIT_MAX_WEEKS * BANDIT_WEEK_MS },
  )
  assert.equal(due.stop, true)
  assert.equal(due.reason, 'time')
})
