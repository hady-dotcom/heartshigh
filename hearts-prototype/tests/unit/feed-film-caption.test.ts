import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { feedFilmCaption } from '../../src/lib/spoken-caption'
import { nextPlaybackRate } from '../../src/lib/playback-rate'

const ibn = "Beautiful phrases that have been crafted and written by none other than Ibn Ata'illah al-"

test('a hook-length quote with no following cue stays off the film', () => {
  const line = { at: 12, text: ibn }
  assert.equal(feedFilmCaption(line, [line], [], [ibn], 40), '')
  assert.equal(feedFilmCaption({ at: 12, text: 'A short hook.', role: 'hook' }, [], [], []), '')
})

test('a short timed line still shows', () => {
  const lines = [
    { at: 10, text: 'The heart keeps count.' },
    { at: 14, text: 'Then it rests.' },
  ]
  assert.equal(feedFilmCaption(lines[0], lines, ['Noticing gifts'], []), 'The heart keeps count.')
  assert.equal(feedFilmCaption(lines[1], lines, [], [], 18), 'Then it rests.')
})

test('a line that is the extract hook stays off even when it is short', () => {
  const line = { at: 4, end: 7, text: 'Notice the gift.' }
  assert.equal(feedFilmCaption(line, [line], [], ['Notice the gift.']), '')
})

test('playback rates reach 2× and return to 1×', () => {
  assert.equal(nextPlaybackRate(1), 1.25)
  assert.equal(nextPlaybackRate(1.25), 1.5)
  assert.equal(nextPlaybackRate(1.5), 2)
  assert.equal(nextPlaybackRate(2), 1)
})

test('the feed pause tap does not mute, and the question handoff turns sound on first', () => {
  const journey = readFileSync(new URL('../../src/components/journey/journey.tsx', import.meta.url), 'utf8')
  const tap = journey.slice(journey.indexOf('const tapPicture'), journey.indexOf('const pauseForSwipe'))
  assert.match(tap, /courseCatcherTap/)
  assert.equal(tap.includes('mute('), false)
  const handOff = journey.slice(journey.indexOf('const handOff'), journey.indexOf('const justShow'))
  const beforeAwait = handOff.slice(0, handOff.indexOf('await '))
  assert.match(beforeAwait, /soundOn\(/)
  assert.match(journey, /className={`caption j-caption-plate/)
  assert.match(journey, /feedFilmCaption\(/)
})
