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
  assert.match(courseScreen, /lessons\.map\(\(row, index\)/)
  assert.equal(courseScreen.includes('courseDoors('), false)
  assert.equal(courseScreen.includes('groupByDoor('), false)
  assert.match(courseScreen, /data-testid="part-week"/)
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
  assert.match(player, /data-testid="lecture-speed"/)
  assert.match(player, /nextPlaybackRate/)
  assert.equal(player.includes('type="range"'), false)
  const pauseAt = player.indexOf('const pause = () => {')
  const pauseFn = player.slice(pauseAt, player.indexOf('const timer = window.setInterval', pauseAt))
  assert.equal(pauseFn.includes('.mute('), false)
  assert.match(pauseFn, /pauseKeepingSound/)
  assert.match(courseScreen, /className="part-row"/)
  assert.match(courseScreen, /className="part-status"/)
  assert.equal(courseScreen.includes('var(--purple)'), false)
  const css = readFileSync(new URL('../../src/app/(frontend)/app.css', import.meta.url), 'utf8')
  assert.match(css, /\.part-row \{[\s\S]*border-radius: 18px;/)
  assert.match(css, /\.part-status \{[\s\S]*background: #d4a84b;[\s\S]*color: #1a1408;/)
})
