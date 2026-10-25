import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calloutSecond, courseHomeOf, filmLabel, hasHeartsWording, sceneUrlOf, showHeartsMark, supportNoteOf } from '../../src/lib/portal-look'

test('a portal with no look stored stays plain', () => {
  assert.equal(courseHomeOf(null), 'cards')
  assert.equal(courseHomeOf({}), 'cards')
  assert.equal(showHeartsMark({}), false)
  assert.equal(supportNoteOf({}), '')
  assert.equal(sceneUrlOf({}), '')
  assert.equal(sceneUrlOf({ sceneKey: 'plain' }), '')
})

test('HEARTS look is explicit data, and course cards stay the default even then', () => {
  const hearts = { sceneKey: 'courtyard', courseHome: 'cards', supportNote: 'This has been powered by donations.', markKind: 'hearts' }
  assert.equal(sceneUrlOf(hearts), '/theme/evening-courtyard.jpg')
  assert.equal(courseHomeOf(hearts), 'cards')
  assert.equal(showHeartsMark(hearts), true)
  assert.equal(supportNoteOf(hearts), 'This has been powered by donations.')
  assert.equal(courseHomeOf({ courseHome: 'garden' }), 'garden')
})

test('a callout past the film is pulled to 80 percent, and film numbers follow the visible list', () => {
  assert.equal(calloutSecond(171, 60), 48)
  assert.equal(calloutSecond(20, 60), 20)
  assert.equal(calloutSecond(171, 0), 171)
  assert.equal(filmLabel(0, 'Why we started'), '1. Why we started')
  assert.equal(filmLabel(0, 'Home Learning Introduction 2: How To Use This Course'), '1. Home Learning Introduction 2: How To Use This Course')
  assert.equal(filmLabel(1, 'Introduction 2'), '2. Introduction 2')
})

test('a fresh portal sentence can be checked for HEARTS wording', () => {
  assert.equal(hasHeartsWording('Welcome to North House.'), false)
  assert.equal(hasHeartsWording('The hadith of Jibril'), true)
  assert.equal(hasHeartsWording('HEARTS'), true)
})
