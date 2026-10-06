import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { BUFFER_RETRY_MS, PLAY_NUDGE_FOR_MS, STALL_MS, bufferRetryAction, clockIsStalled, endCardPlayerAction, endedEventIsCurrent, feedAfterEndSignals, horsWindowEnded, hostShouldShow, keepVisiblePaused, livePictureTap, pictureIsTap, pictureSwipeCommit, pictureTapAction, planFilmAdvance, playbackAction, playbackAdvancing, prepareIsCurrent, shouldNudgePlay, showLaneEndNow, stallThenTap, swapThenEarlyTap, takeEndAdvance, verticalSwipe } from '../../src/lib/film-advance'

const visible = { key: '14:hors', hasPlayer: true }
const preloaded = { key: '22:hors', hasPlayer: true }
const empty = { key: null, hasPlayer: false }

test('a later clip plays the host that already holds it at its in-point', () => {
  const plan = planFilmAdvance(0, '22:hors', [visible, preloaded])
  assert.deepEqual(plan, { target: 1, action: 'play' })
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

test('a leftover ended event does not hide the last clip, and a tap never skips', () => {
  assert.equal(endedEventIsCurrent({ watchKey: '9:hors:talk', eventKey: '8:hors:talk', watchEnded: false, playerState: -1 }), false)
  assert.equal(endedEventIsCurrent({ watchKey: '9:hors:talk', eventKey: '8:hors', watchEnded: false, playerState: 0 }), false)
  assert.equal(endedEventIsCurrent({ watchKey: '9:hors:talk', eventKey: '9:hors:talk', watchEnded: true, playerState: 2 }), true)
  assert.equal(endedEventIsCurrent({ watchKey: '9:hors:talk', eventKey: '9:hors', watchEnded: false, playerState: 0 }), true)
  assert.equal(endedEventIsCurrent({ watchKey: '9:hors:talk', watchEnded: false, playerState: 0 }), false)
  assert.equal(horsWindowEnded(0, 0, 16), false)
  assert.equal(horsWindowEnded(312, 0, 16), false)
  assert.equal(horsWindowEnded(16.2, 0, 16), true)
  assert.equal(showLaneEndNow({ thisClipEnded: false, nextIndex: null }), false)
  assert.equal(showLaneEndNow({ thisClipEnded: true, nextIndex: null }), true)
  assert.equal(showLaneEndNow({ thisClipEnded: true, nextIndex: 4 }), false)
  assert.equal(hostShouldShow(true, true, false), true, 'the last clip stays visible until it ends')
  assert.equal(pictureSwipeCommit(0, 12), false)
  assert.equal(pictureSwipeCommit(0, 39), false)
  assert.equal(pictureSwipeCommit(0, 40), true)
  assert.equal(pictureSwipeCommit(80, 12), false)
  assert.equal(pictureIsTap(0, 9), true)
  assert.equal(pictureIsTap(2, 6), true)
  assert.equal(pictureIsTap(0, 40), false)
})

test('window-end and state 0 for one clip step once', () => {
  const first = takeEndAdvance({ clipKey: 'n', advancedFrom: null, newClipPlaying: true, source: 'window', windowHandled: false })
  assert.equal(first.take, true)
  const again = takeEndAdvance({ clipKey: 'n', advancedFrom: first.advancedFrom, newClipPlaying: false, source: 'state0', windowHandled: true })
  assert.equal(again.take, false)
  const beforePlay = takeEndAdvance({ clipKey: 'n+1', advancedFrom: first.advancedFrom, newClipPlaying: false, source: 'state0', windowHandled: false })
  assert.equal(beforePlay.take, false)
  const dual = feedAfterEndSignals({ length: 4, index: 1, signals: ['window', 'state0'] })
  assert.equal(dual.index, 2)
  assert.equal(pictureTapAction(3), 'pause')
  assert.equal(bufferRetryAction({ bufferingForMs: BUFFER_RETRY_MS, state: 3, alreadyRetried: false }), 'retry')
})

test('a stall then the first real tap pauses once, and a stall tap pauses when cur moves', () => {
  assert.equal(STALL_MS, 500)
  assert.equal(clockIsStalled({ state: 1, currentTime: 5628.4, lastTime: 5628.4, lastSeenAt: 0, now: 400 }), false)
  assert.equal(clockIsStalled({ state: 1, currentTime: 5628.4, lastTime: 5628.4, lastSeenAt: 100, now: 700 }), true)
  assert.equal(clockIsStalled({ state: 1, currentTime: 5628.4, lastTime: -1, lastSeenAt: 0, now: 900 }), false)
  assert.equal(playbackAdvancing({ state: 1, currentTime: 5628.4, lastTime: 5628.4 }), false)
  assert.equal(livePictureTap({ state: 1, stalled: true }), 'pause')
  assert.equal(livePictureTap({ state: 1, stalled: false }), 'pause')
  assert.equal(livePictureTap({ state: 2, stalled: false }), 'play')
  assert.equal(keepVisiblePaused({ userPaused: true, liveState: 1 }), true)
  assert.equal(keepVisiblePaused({ userPaused: true, liveState: 2 }), false)

  const firstReal = stallThenTap([
    { state: 1, cur: 5628.4, atMs: 0 },
    { state: 1, cur: 5628.4, atMs: 800 },
    { state: 1, cur: 5628.7, atMs: 9000 },
    { state: 1, cur: 5629.1, atMs: 9250, tap: true },
  ])
  assert.equal(firstReal.paused, true)
  assert.equal(firstReal.taps, 1)
  assert.equal(firstReal.pauseApplies, 1)
  assert.equal(firstReal.playApplies, 0)

  const duringStall = stallThenTap([
    { state: 1, cur: 4969.0, atMs: 0 },
    { state: 1, cur: 4969.0, atMs: 800, tap: true },
    { state: 2, cur: 4969.0, atMs: 2000 },
    { state: 2, cur: 4969.0, atMs: 9000 },
  ])
  assert.equal(duringStall.paused, true)
  assert.equal(duringStall.pauseApplies, 1)
  assert.equal(duringStall.playApplies, 0)

  const afterPause = stallThenTap([
    { state: 1, cur: 4969.0, atMs: 0 },
    { state: 1, cur: 4969.0, atMs: 800, tap: true },
    { state: 2, cur: 4969.4, atMs: 9250, tap: true },
  ])
  assert.equal(afterPause.pauseApplies, 1)
  assert.equal(afterPause.playApplies, 1)
  assert.equal(afterPause.paused, false)

  assert.equal(endCardPlayerAction({ endCard: true, state: 1 }), 'pause')
  assert.equal(endCardPlayerAction({ endCard: true, state: 3 }), 'pause')
  assert.equal(endCardPlayerAction({ endCard: true, state: -1 }), 'pause')
  assert.equal(endCardPlayerAction({ endCard: true, state: 2 }), 'none')
  assert.equal(endCardPlayerAction({ endCard: true, state: 0 }), 'none')
  assert.equal(endCardPlayerAction({ endCard: false, state: 1 }), 'none')
})

test('a swap onto the hidden host then a tap within 1s pauses the visible host and shows the icon', () => {
  const early = swapThenEarlyTap({ tapAtMs: 800, start: 254.7 })
  assert.equal(early.visible, 1)
  assert.equal(early.swapped, true)
  assert.equal(early.readoutHost, 1)
  assert.equal(early.state, 2)
  assert.equal(early.icon, true)
  assert.equal(early.cover, true)
  const atAdvance = swapThenEarlyTap({ tapAtMs: 0, start: 301.8 })
  assert.equal(atAdvance.visible, 1)
  assert.equal(atAdvance.state, 2)
  assert.equal(atAdvance.icon, true)
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
  assert.match(ladder, /flex-direction:\s*row/)
  assert.match(ladder, /width:\s*100%/)
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
