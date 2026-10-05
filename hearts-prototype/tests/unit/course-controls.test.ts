import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { coursePlayVisible } from '../../src/lib/course-controls'
import { helpFor } from '../../src/lib/page-help'

const courseScreen = readFileSync(new URL('../../src/screens/app/course.tsx', import.meta.url), 'utf8')
const player = readFileSync(new URL('../../src/components/app/course-player.tsx', import.meta.url), 'utf8')

test('the course parts list does not offer Ready for more? jumps', () => {
  assert.equal(courseScreen.includes('course-appetiser'), false)
  assert.equal(courseScreen.includes('Ready for more?'), false)
  assert.equal(courseScreen.includes('talk-tiers'), false)
  assert.match(courseScreen, /data-testid="part-link"/)
  assert.match(courseScreen, /Parts of this course/)
})

test('play and pause stay on the lecture while it is playing', () => {
  assert.equal(coursePlayVisible({ loading: false, questionOpen: false }), true)
  assert.equal(coursePlayVisible({ loading: true, questionOpen: false }), false)
  assert.equal(coursePlayVisible({ loading: false, questionOpen: true }), false)
  assert.match(player, /coursePlayVisible/)
  assert.match(player, /data-testid="player-play"/)
  assert.doesNotMatch(player, /!filmed \|\| !playing/)
  assert.equal(player.includes('skip-back'), false)
  assert.equal(player.includes('skip-forward'), false)
  assert.equal(player.includes('Back 10 s'), false)
  assert.equal(player.includes('Forward 10 s'), false)
  assert.equal(player.includes('gesture-next'), false)
  assert.match(helpFor('course').body.join(' '), /Play and pause stay on the film/)
})
