import assert from 'node:assert/strict'
import test from 'node:test'
import { applyDrawnTo, countsTowardProgress, harvestInWindow, keepForProgress, shortFormEffect } from './progress'
import type { HarvestHit } from './harvest'

const hit = (timestamp: string): HarvestHit => ({ kind: 'quran', text: 'Allah says', reference: '', timestamp, seconds: 0, context: '' })

test('hors d\'oeuvres and appetisers never count toward course completion or the grow page', () => {
  for (const level of ['hors', 'appetiser'] as const) {
    assert.equal(countsTowardProgress({ level, inCourse: true, event: 'watch' }), false)
    assert.equal(countsTowardProgress({ level, inCourse: true, event: 'question' }), false)
    assert.equal(countsTowardProgress({ level, inCourse: false, event: 'watch' }), false)
    const effect = shortFormEffect(level)
    assert.equal(effect.harvest, true)
    assert.equal(effect.drawnTo, true)
    assert.equal(effect.completion, false)
    assert.equal(effect.grow, false)
  }
})

test('only a full talk inside a course, and the questions on that talk, count', () => {
  assert.equal(countsTowardProgress({ level: 'talk', inCourse: true, event: 'watch' }), true)
  assert.equal(countsTowardProgress({ level: 'talk', inCourse: true, event: 'question' }), true)
  assert.equal(countsTowardProgress({ level: 'talk', inCourse: false, event: 'watch' }), false)
  assert.equal(countsTowardProgress({ level: 'talk', inCourse: false, event: 'question' }), false)
  assert.equal(countsTowardProgress({ level: 'talk', inCourse: false, event: 'watch', viaLive: true }), false)
  assert.deepEqual(shortFormEffect('talk'), { harvest: false, drawnTo: false, completion: false, grow: false })
})

test('grow rows drop short clips and talks that are not in a course', () => {
  const rows = [
    { id: 1, sourceLevel: 'hors', inCourse: true },
    { id: 2, sourceLevel: 'appetiser', inCourse: true },
    { id: 3, sourceLevel: 'talk', inCourse: false },
    { id: 4, sourceLevel: 'talk', inCourse: true },
    { id: 5, sourceLevel: undefined, inCourse: true },
  ]
  assert.deepEqual(keepForProgress(rows, 'watch').map((row) => row.id), [4, 5])
  assert.deepEqual(keepForProgress(rows, 'question').map((row) => row.id), [4, 5])
})

test('browsing records who the learner lingers on and learns more from', () => {
  const once = applyDrawnTo([], 'latif', 'linger')
  assert.deepEqual(once, [{ speakerSlug: 'latif', linger: 1, learnMore: 0 }])
  const again = applyDrawnTo(once, 'latif', 'learn-more')
  assert.deepEqual(again, [{ speakerSlug: 'latif', linger: 1, learnMore: 1 }])
  const other = applyDrawnTo(again, 'hani', 'learn-more')
  assert.equal(other.length, 2)
  assert.equal(other[0].learnMore, 1)
  assert.deepEqual(other[1], { speakerSlug: 'hani', linger: 0, learnMore: 1 })
})

test('a short clip harvests only the quotes inside its own window', () => {
  const hits = [hit('0:10'), hit('1:40'), hit('12:00')]
  assert.deepEqual(harvestInWindow(hits, 0, 30).map((row) => row.timestamp), ['0:10'])
  assert.deepEqual(harvestInWindow(hits, 90, 180).map((row) => row.timestamp), ['1:40'])
  assert.deepEqual(harvestInWindow(hits, 20, 20), [])
})
