import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'path'
import { test } from 'node:test'
import {
  BUFFER_RETRY_MS,
  bufferRetryAction,
  feedAfterEndSignals,
  pictureTapAction,
  takeEndAdvance,
} from '../../src/lib/film-advance'
import { coverAttr, playerReadout } from '../../src/lib/yt-cover'

const root = path.join(process.cwd(), 'src')
const journey = readFileSync(path.join(root, 'components/journey/journey.tsx'), 'utf8')
const journeyCss = readFileSync(path.join(root, 'app/(frontend)/journey.css'), 'utf8')

test('1: window-end and state 0 within 300ms advance once, to N+1', () => {
  const twice = takeEndAdvance({
    clipKey: '0:hors:talk',
    advancedFrom: '0:hors:talk',
    newClipPlaying: true,
    source: 'state0',
    windowHandled: true,
  })
  assert.equal(twice.take, false)

  const after = feedAfterEndSignals({
    length: 3,
    index: 0,
    signals: [
      { source: 'window', clipKey: '0', atMs: 0 },
      { source: 'state0', clipKey: '0', atMs: 180 },
      { source: 'state0', clipKey: '1', atMs: 260 },
    ],
  })
  assert.equal(after.index, 1)
  assert.equal(after.endCard, false)
  assert.notEqual(after.index, 2)
  assert.match(journey, /takeEndAdvance/)
  assert.match(journey, /runEndAdvanceRef\.current\('window'/)
  assert.match(journey, /runEndAdvanceRef\.current\('state0'/)
  const endedAt = journey.indexOf('if (state === STATE.ENDED)')
  const endedBlock = journey.slice(endedAt, endedAt + 220)
  assert.match(endedBlock, /runEndAdvanceRef\.current\('state0'/)
  assert.doesNotMatch(endedBlock, /hearts:ended/)
  const windowAt = journey.indexOf("runEndAdvanceRef.current('window'")
  const windowBlock = journey.slice(windowAt - 180, windowAt + 80)
  assert.match(windowBlock, /seen\.ended = true/)
  assert.doesNotMatch(windowBlock, /hearts:ended/)
})

test('2: the second-to-last clip ending loads the last clip and does not show the end card', () => {
  const after = feedAfterEndSignals({
    length: 3,
    index: 1,
    signals: [
      { source: 'window', clipKey: '1', atMs: 0 },
      { source: 'state0', clipKey: '1', atMs: 120 },
      { source: 'state0', clipKey: '2', atMs: 240 },
    ],
  })
  assert.equal(after.index, 2)
  assert.equal(after.endCard, false)
  assert.equal(after.lastState, 1)
  assert.notEqual(after.lastState, -1)
  assert.match(journey, /newClipPlayingRef\.current = true/)
  assert.match(journey, /newClipPlayingRef\.current = false/)
})

test('3: the debug cover word matches the painted data-cover attribute', () => {
  assert.equal(coverAttr(true), 'yes')
  assert.equal(coverAttr(false), 'no')
  assert.equal(playerReadout({ state: 1, time: 5632.8, currentTime: 5632.8, cover: true }), 'state 1 time 5632.8 cur 5632.8 cover yes')
  assert.equal(playerReadout({ state: 1, time: 5632.8, currentTime: 5632.8, cover: false }), 'state 1 time 5632.8 cur 5632.8 cover no')
  assert.match(journey, /data-cover=\{coverAttr\(showPoster\)\}/)
  assert.match(journey, /cover: showPoster/)
  assert.match(journey, /coverHoldStep/)
  assert.match(journey, /setInterval\(apply, 250\)/)
  assert.match(journeyCss, /\[data-cover='yes'\] \.j-poster/)
  assert.match(journeyCss, /\[data-cover='no'\] \.j-poster/)
  assert.match(journeyCss, /\.j-poster \{[\s\S]*z-index: 16/)
})

test('4: a tap during BUFFERING pauses, and a 6s buffer retries seek+play once', () => {
  assert.equal(pictureTapAction(1), 'pause')
  assert.equal(pictureTapAction(3), 'pause')
  assert.equal(pictureTapAction(2), 'play')
  assert.equal(pictureTapAction(5), 'play')
  assert.equal(bufferRetryAction({ bufferingForMs: 5999, state: 3, alreadyRetried: false }), 'wait')
  assert.equal(bufferRetryAction({ bufferingForMs: BUFFER_RETRY_MS, state: 3, alreadyRetried: false }), 'retry')
  assert.equal(bufferRetryAction({ bufferingForMs: 9000, state: 3, alreadyRetried: true }), 'wait')
  assert.equal(bufferRetryAction({ bufferingForMs: 9000, state: 1, alreadyRetried: false }), 'none')
  assert.match(journey, /livePictureTap/)
  assert.match(journey, /clockIsStalled/)
  assert.match(journey, /pauseWhenReadyRef/)
  assert.match(journey, /applyPauseWhenReady/)
  assert.match(journey, /endCardPlayerAction/)
  assert.match(journey, /lastTime: clockRef\.current\.time/)
  assert.match(journey, /courseCatcherTap/)
  assert.match(journey, /pictureIsTap/)
  assert.match(journey, /bufferRetryAction/)
  assert.match(journey, /seekTo\(player\.getCurrentTime\(\), true\)/)
  assert.match(journey, /if \(!commit \|\| \(vertical && pictureIsTap\(dx, dy\)\)\) \{[\s\S]*runPictureTap\(\)/)
  assert.doesNotMatch(journey, /if \(start\.moved\) resumeAfterSwipe\(\)/)
})
