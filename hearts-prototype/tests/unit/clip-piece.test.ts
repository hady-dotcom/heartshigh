import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appetiserSpans, piecePoint } from '../../src/lib/clip-piece'

test('a clip with no appetiser does not throw when the player reads its spans', () => {
  assert.deepEqual(appetiserSpans(null), [])
  assert.deepEqual(appetiserSpans({ appetiser: null }), [])
  assert.deepEqual(appetiserSpans({ appetiser: { start: 10, end: 28 } }), [])
  assert.deepEqual(appetiserSpans({ appetiser: { spans: [{ start: 10, end: 40 }, { start: 80, end: 100 }] } }).length, 2)
  assert.equal(piecePoint(null, 'start'), 0)
  assert.equal(piecePoint({ start: 12, end: 30 }, 'end'), 30)
})
