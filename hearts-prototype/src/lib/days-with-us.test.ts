import assert from 'node:assert/strict'
import { test } from 'node:test'
import { daysWithUs, daysWithUsLabel } from './days-with-us'

const DAY = 86_400_000

test('Home and Me share one day count from the join moment', () => {
  const now = Date.parse('2026-10-04T20:00:00-04:00')
  assert.equal(daysWithUs('2026-10-04T09:00:00-04:00', now), 1)
  assert.equal(daysWithUs('2026-10-02T20:00:00-04:00', now), 3)
  assert.equal(daysWithUs('2026-10-01T20:00:00-04:00', now), 4)
  assert.equal(daysWithUs(null, now), 1)
  assert.equal(daysWithUsLabel(1), '1 day with us so far')
  assert.equal(daysWithUsLabel(4), '4 days with us so far')
  const joined = '2026-10-02T12:00:00-04:00'
  assert.equal(daysWithUsLabel(daysWithUs(joined, now)), `${daysWithUs(joined, now)} days with us so far`)
})
