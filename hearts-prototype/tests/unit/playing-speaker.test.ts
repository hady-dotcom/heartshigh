import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { laneCardSpeaker } from '../../src/lib/lanes'
import { playingSpeaker } from '../../src/lib/playing-speaker'

test('the board names the playing lesson, or nothing when that lesson has no speaker', () => {
  assert.equal(playingSpeaker('Suleiman Hani'), 'Suleiman Hani')
  assert.equal(playingSpeaker('  Amjad Tarsin  '), 'Amjad Tarsin')
  assert.equal(playingSpeaker(''), '')
  assert.equal(playingSpeaker(null), '')
  assert.equal(playingSpeaker('The speaker'), '')
  const opening = readFileSync(new URL('../../src/server/opening.ts', import.meta.url), 'utf8')
  assert.match(opening, /playingSpeaker\(lesson\.speaker\)/)
  assert.doesNotMatch(opening, /lesson\.speaker \|\| course\.speaker/)
})

test('a lane card names a speaker only when every playable clip shares one', () => {
  assert.equal(laneCardSpeaker([{ speaker: 'Suleiman Hani' }, { speaker: 'Suleiman Hani' }]), 'Suleiman Hani')
  assert.equal(laneCardSpeaker([{ speaker: 'Suleiman Hani' }, { speaker: 'Amjad Tarsin' }]), '')
  assert.equal(laneCardSpeaker([{ speaker: 'The speaker' }, { speaker: '' }]), '')
})
