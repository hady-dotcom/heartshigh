import assert from 'node:assert/strict'
import { test } from 'node:test'
import { placeDots } from './timeline-dots'

test('marks stay on the line and inside the track', () => {
  const placed = placeDots(
    [
      { id: 1, second: 10 },
      { id: 2, second: 12 },
      { id: 3, second: 590 },
      { id: 4, second: 600 },
    ],
    600,
    200,
  )
  assert.ok(placed.every((dot) => dot.lift === 0))
  assert.ok(placed.every((dot) => dot.left >= 0 && dot.left <= 100))
  assert.ok(placed[placed.length - 1].left <= 100)
})
