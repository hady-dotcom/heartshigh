import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { PLAY_NUDGE_FOR_MS, hostShouldShow, planFilmAdvance, playbackAction, prepareIsCurrent, shouldNudgePlay, verticalSwipe } from '../../src/lib/film-advance'

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

test('a cued film is asked to play for several seconds, not one quick burst', () => {
  for (const state of [-1, 2, 5]) assert.equal(shouldNudgePlay(state, true, false, 0), true)
  assert.equal(shouldNudgePlay(5, true, false, PLAY_NUDGE_FOR_MS - 1), true)
  assert.equal(shouldNudgePlay(1, true, false, 0), false)
  assert.equal(shouldNudgePlay(3, true, false, 0), false)
  assert.equal(shouldNudgePlay(0, true, false, 0), false)
  assert.equal(shouldNudgePlay(5, false, false, 0), false)
  assert.equal(shouldNudgePlay(5, true, true, 0), false)
  assert.equal(shouldNudgePlay(5, true, false, PLAY_NUDGE_FOR_MS), false)
})

test('an older prepare must not load over the clip just stepped to', () => {
  assert.equal(prepareIsCurrent(4, 4), true)
  assert.equal(prepareIsCurrent(3, 4), false)
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

test('the film has no Prev/Next chrome, and the ladder stays a small text row', () => {
  const css = readFileSync(new URL('../../src/app/(frontend)/journey.css', import.meta.url), 'utf8')
  const ladderAt = css.indexOf('.j-chrome .clip-foot .j-level-choices {')
  const ladder = css.slice(ladderAt, css.indexOf('.journey.phase-feed.overlay', ladderAt))
  assert.equal(css.includes('.j-step'), false)
  assert.ok(ladderAt >= 0, 'the ladder is a child of the lower control stack')
  assert.match(ladder, /position:\s*static/)
  assert.equal(ladder.includes('position: absolute'), false)
  assert.equal(ladder.includes('position: relative'), false)
  assert.equal(ladder.includes('bottom:'), false)
  assert.equal(ladder.includes('min-height: 44px'), false)
  assert.match(ladder, /font-size:\s*12px/)
  assert.match(ladder, /width:\s*max-content/)
  assert.equal(css.includes('bottom: calc(22% + var(--safe-bottom))'), false)
  assert.equal(css.includes("data-mode='appetiser']:not(.strict):not([data-words-in-picture='yes']) .j-level-choices"), false)
  assert.equal(css.includes('min(46vw, 188px)'), false)
  const source = readFileSync(new URL('../../src/components/journey/journey.tsx', import.meta.url), 'utf8')
  assert.equal(source.includes('className="j-step'), false)
  assert.equal(source.includes('Back 10 s'), false)
  assert.equal(source.includes('Forward 10 s'), false)
  assert.equal(source.includes('skip-back'), false)
  assert.equal(source.includes('skip-forward'), false)
  const footAt = source.indexOf('className="clip-foot j-credits"')
  const foot = source.slice(footAt, footAt + 4500)
  const steps = foot.indexOf('data-testid="level-steps"')
  const controls = foot.indexOf('data-testid="ready-controls"')
  const speed = foot.indexOf('data-testid="speed"')
  const talk = foot.indexOf('data-testid="learn-more"')
  assert.ok(footAt >= 0 && steps >= 0 && steps < controls, 'the ladder is the first control in the lower stack')
  assert.ok(steps < speed && steps < talk, 'the ladder comes before the extract speed chip and the talk button')
  const lecture = foot.slice(foot.indexOf('data-testid="level-lecture"'), foot.indexOf('data-testid="level-lecture"') + 280)
  assert.match(lecture, /onPointerUp=\{[^}]*requestTalk\(\)/)
  const hidden = source.slice(source.indexOf('className="sr-only"'), source.indexOf('className="sr-only"') + 1200)
  assert.match(hidden, /data-testid="gesture-next"/)
  assert.match(hidden, /aria-hidden="true"/)
})
