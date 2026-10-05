import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { hostShouldShow, planFilmAdvance, playbackAction, shouldNudgePlay, stepControlBox, stepControlInside, verticalSwipe } from '../../src/lib/film-advance'

const visible = { key: '14:hors', hasPlayer: true }
const preloaded = { key: '22:hors', hasPlayer: true }
const empty = { key: null, hasPlayer: false }

test('a later clip stays on the iframe that already played', () => {
  const plan = planFilmAdvance(0, '22:hors', [visible, preloaded])
  assert.deepEqual(plan, { target: 0, action: 'load' })
  assert.equal(playbackAction(visible, '22:hors'), 'load')
})

test('the same clip still plays instead of returning early', () => {
  const plan = planFilmAdvance(0, '14:hors', [visible, preloaded])
  assert.deepEqual(plan, { target: 0, action: 'play' })
})

test('the first clip is created on the visible host', () => {
  assert.deepEqual(planFilmAdvance(0, '14:hors', [empty, empty]), { target: 0, action: 'create' })
})

test('with no warmed iframe, a preload that already holds the clip is played and any other id is loaded', () => {
  assert.deepEqual(planFilmAdvance(0, '22:hors', [empty, preloaded]), { target: 1, action: 'play' })
  assert.deepEqual(planFilmAdvance(0, '14:hors', [empty, preloaded]), { target: 1, action: 'load' })
})

test('a cued or paused visible host is nudged until it plays', () => {
  for (const state of [-1, 2, 5]) assert.equal(shouldNudgePlay(state, true, false, 0), true)
  assert.equal(shouldNudgePlay(1, true, false, 0), false)
  assert.equal(shouldNudgePlay(0, true, false, 0), false)
  assert.equal(shouldNudgePlay(5, false, false, 0), false)
  assert.equal(shouldNudgePlay(5, true, true, 0), false)
  assert.equal(shouldNudgePlay(5, true, false, 5), false)
})

test('the chosen host stays visible through a clip change, and a parked host stays hidden', () => {
  assert.equal(hostShouldShow(true, true, false), true)
  assert.equal(hostShouldShow(false, true, false), false)
  assert.equal(hostShouldShow(true, true, true), false)
  assert.equal(hostShouldShow(true, false, false), false)
})

test('swipe up is the next hors d’oeuvre and swipe down stays on the lane', () => {
  assert.equal(verticalSwipe(-80), 'next')
  assert.equal(verticalSwipe(80), 'lane')
})

test('Next and Prev sit inside a 390×844 phone and are not the clipped control', () => {
  for (const which of ['next', 'prev'] as const) {
    assert.equal(stepControlInside(which), true)
    const box = stepControlBox(which)
    assert.ok(box.left >= 0, which)
    assert.ok(box.right <= 390, which)
    assert.ok(box.top >= 0 && box.bottom <= 844, which)
  }
  assert.equal(stepControlBox('next').left, 306)
  assert.equal(stepControlBox('prev').left, 12)

  const css = readFileSync(new URL('../../src/app/(frontend)/journey.css', import.meta.url), 'utf8')
  assert.match(css, /\.j-step\.prev \{ left: 12px; \}/)
  assert.match(css, /\.j-step\.next \{ right: 12px; \}/)
  assert.match(css, /\.j-step \{[\s\S]*top: 248px;/)
  assert.match(css, /\.j-step \{[\s\S]*width: 72px;/)
  assert.match(css, /\.j-step \{[\s\S]*min-height: 48px;/)

  const source = readFileSync(new URL('../../src/components/journey/journey.tsx', import.meta.url), 'utf8')
  const hidden = source.slice(source.indexOf('className="sr-only"'), source.indexOf('className="sr-only"') + 900)
  assert.equal(hidden.includes('gesture-next'), false)
  assert.equal(hidden.includes('gesture-prev'), false)
  assert.match(source, /data-testid="gesture-next"/)
  assert.match(source, /data-testid="gesture-prev"/)
  assert.match(source, /className="j-step next"/)
})
