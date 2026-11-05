import assert from 'node:assert/strict'
import { test } from 'node:test'
import { courseIsOpen, opensOnDay } from './drip'

test('feed courses are open on day 1; the rest drip by list order', () => {
  assert.equal(courseIsOpen({ index: 5, today: 1, inFeed: true }), true)
  assert.equal(opensOnDay({ index: 5, inFeed: true }), 1)
  assert.equal(courseIsOpen({ index: 5, today: 1, inFeed: false }), false)
  assert.equal(opensOnDay({ index: 5, inFeed: false }), 6)
  assert.equal(courseIsOpen({ index: 5, today: 6, inFeed: false }), true)
})
