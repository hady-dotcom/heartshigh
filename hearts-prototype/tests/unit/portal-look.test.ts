import assert from 'node:assert/strict'
import { test } from 'node:test'
import { accentOf, calloutSecond, courseHomeOf, filmLabel, fontPairOf, hasHeartsWording, sceneCssOf, sceneKeyOf, sceneUrlOf, shellOf, showHeartsMark, shownCalloutSecond, shownSupportNote, supportNoteOf } from '../../src/lib/portal-look'

test('a portal with no look stored stays plain and white', () => {
  assert.equal(courseHomeOf(null), 'cards')
  assert.equal(courseHomeOf({}), 'cards')
  assert.equal(showHeartsMark({}), false)
  assert.equal(supportNoteOf({}), '')
  assert.equal(shownSupportNote({}), '')
  assert.equal(shownSupportNote(null), '')
  assert.equal(shownSupportNote({ shell: 'hearts' }), 'This has been powered by donations.')
  assert.equal(shownSupportNote({ shell: 'hearts', supportNote: null }), 'This has been powered by donations.')
  assert.equal(shownSupportNote({ shell: 'hearts', supportNote: '' }), '')
  assert.equal(shownSupportNote({ supportNote: 'Thanks to the team.' }), 'Thanks to the team.')
  assert.equal(sceneUrlOf({}), '')
  assert.equal(sceneUrlOf({ sceneKey: 'plain' }), '')
  assert.equal(sceneKeyOf({}), 'plain')
  assert.equal(sceneKeyOf({ shell: 'hearts' }), 'courtyard')
  assert.equal(sceneCssOf({}), null)
  assert.equal(sceneCssOf({ shell: 'hearts' }), null)
  assert.equal(sceneCssOf({ shell: 'hearts', sceneKey: 'plain' }), 'none')
  assert.equal(sceneCssOf({ sceneKey: 'kitchen' }), 'url("/theme/scenes/kitchen.jpg")')
  assert.equal(sceneUrlOf({ sceneKey: 'upload', sceneUrl: 'https://cdn.example/a.jpg' }), 'https://cdn.example/a.jpg')
  assert.equal(sceneUrlOf({ sceneKey: 'upload', sceneUrl: 'javascript:alert(1)' }), '')
  assert.equal(shellOf({}), 'modern')
  assert.equal(shellOf(null), 'modern')
  assert.equal(fontPairOf({}), 'system')
  assert.equal(accentOf({}), '#2563EB')
})

test('HEARTS look is explicit data, and course cards stay the default even then', () => {
  const hearts = { sceneKey: 'courtyard', courseHome: 'cards', supportNote: 'This has been powered by donations.', markKind: 'hearts', shell: 'hearts' }
  assert.equal(sceneUrlOf(hearts), '/theme/evening-courtyard.jpg')
  assert.equal(courseHomeOf(hearts), 'cards')
  assert.equal(showHeartsMark(hearts), true)
  assert.equal(supportNoteOf(hearts), 'This has been powered by donations.')
  assert.equal(shellOf(hearts), 'hearts')
  assert.equal(courseHomeOf({ courseHome: 'garden' }), 'garden')
  assert.equal(fontPairOf({ fontPair: 'bricolage' }), 'bricolage')
  assert.equal(accentOf({ accent: '#2563EB' }), '#2563EB')
})

test('a callout past the film is pulled to 80 percent, and film numbers follow the visible list', () => {
  assert.equal(calloutSecond(171, 60), 48)
  assert.equal(calloutSecond(20, 60), 20)
  assert.equal(calloutSecond(171, 0), 171)
  assert.equal(shownCalloutSecond(227, 230, true), 227)
  assert.equal(shownCalloutSecond(135, 168, true), 135)
  assert.equal(shownCalloutSecond(227, 230, false), 184)
  assert.equal(filmLabel(0, 'Why we started'), '1. Why we started')
  assert.equal(filmLabel(0, 'Home Learning Introduction 2: How To Use This Course'), '1. Home Learning Introduction 2: How To Use This Course')
  assert.equal(filmLabel(1, 'Introduction 2'), '2. Introduction 2')
})

test('a fresh portal sentence can be checked for HEARTS wording', () => {
  assert.equal(hasHeartsWording('Welcome to North House.'), false)
  assert.equal(hasHeartsWording('The hadith of Jibril'), true)
  assert.equal(hasHeartsWording('HEARTS'), true)
})
