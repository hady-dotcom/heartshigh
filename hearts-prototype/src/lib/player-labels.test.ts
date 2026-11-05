import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lastPartCopy, playerPartLabel, resolvePartIndex } from './player-labels'

test('a one-talk course does not say Part 1 or last part of this course', () => {
  assert.equal(playerPartLabel({ index: 1, total: 1, name: 'Ar-Rabb', courseTitle: 'The Names Class 19' }), 'Ar-Rabb')
  assert.equal(playerPartLabel({ index: 1, total: 1, name: 'The Names Class 19 · Part 1', courseTitle: 'The Names Class 19' }), 'The Names Class 19')
  assert.equal(lastPartCopy(1), 'This is the whole talk.')
})

test('a multi-part course names the part and the last-part line', () => {
  assert.equal(playerPartLabel({ index: 2, total: 4, name: 'Session 6', courseTitle: 'How to Live' }), 'Part 2 of 4 · Session 6')
  assert.equal(lastPartCopy(4), 'This is the last part of this course.')
})

test('part query prefers a lesson id, then a 1-based index', () => {
  const lessons = [{ id: 10 }, { id: 20 }, { id: 30 }]
  assert.equal(resolvePartIndex(lessons, '20'), 1)
  assert.equal(resolvePartIndex(lessons, '2'), 1)
  assert.equal(resolvePartIndex(lessons, '99'), 0)
})
