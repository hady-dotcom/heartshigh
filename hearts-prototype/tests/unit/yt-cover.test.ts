import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  YT_CHROME_HOLD_MS,
  YT_COVER_FADE_MS,
  YT_STATE_FALLBACK_MS,
  advanceLeavesPlayable,
  coverFallbackAction,
  coverHoldKey,
  coverHoldMsLeft,
  coverHoldShouldRestart,
  coverShouldHold,
  filmCoverVisible,
  filmCoverKey,
  filmIframeCrop,
  landscapeThumb,
  pauseMarkVisible,
  playerReadout,
  playingConfirmed,
  ytDebugOn,
} from '../../src/lib/yt-cover'

test('the cover holds for 4.5s of confirmed PLAYING, then lifts', () => {
  assert.equal(YT_CHROME_HOLD_MS, 4500)
  assert.equal(YT_COVER_FADE_MS, 250)
  assert.equal(coverShouldHold(0), true)
  assert.equal(coverShouldHold(YT_CHROME_HOLD_MS - 1), true)
  assert.equal(coverShouldHold(YT_CHROME_HOLD_MS), false)
  assert.equal(filmCoverVisible({ playing: true, playingForMs: 400, paused: false, ended: false }), true)
  assert.equal(filmCoverVisible({ playing: true, playingForMs: YT_CHROME_HOLD_MS, paused: false, ended: false }), false)
})

test('start, resume, pause and end of the cover state machine', () => {
  assert.equal(filmCoverVisible({ playing: false, playingForMs: 0, paused: false, ended: false }), true, 'start')
  assert.equal(filmCoverVisible({ playing: true, playingForMs: 500, paused: false, ended: false }), true, 'start hold')
  assert.equal(filmCoverVisible({ playing: true, playingForMs: 0, paused: false, ended: false }), true, 'resume hold')
  assert.equal(filmCoverVisible({ playing: false, playingForMs: 4000, paused: true, ended: false }), true, 'pause')
  assert.equal(filmCoverVisible({ playing: false, playingForMs: 0, paused: false, ended: true }), true, 'end')
  assert.equal(filmCoverVisible({ playing: true, playingForMs: 4000, paused: false, ended: false, timeAdvancing: false }), true, 'clock stuck')
  assert.equal(pauseMarkVisible({ paused: true, ended: false, userPaused: true }), true)
  assert.equal(pauseMarkVisible({ paused: true, ended: true, userPaused: true }), false)
  assert.equal(pauseMarkVisible({ paused: false, ended: false, userPaused: false }), false)
})

test('stuck fallback: wait, treat a silent PLAYING poll, then retry', () => {
  assert.equal(playingConfirmed(1, 12.4, 12), true)
  assert.equal(playingConfirmed(1, 12.01, 12), false)
  assert.equal(playingConfirmed(2, 12.5, 12), false)
  assert.equal(coverFallbackAction({ waitedMs: 1000, eventPlaying: false, polledState: -1, polledTime: 0 }), 'wait')
  assert.equal(coverFallbackAction({ waitedMs: 2000, eventPlaying: false, polledState: 1, polledTime: 14, start: 12 }), 'treat-playing')
  assert.equal(coverFallbackAction({ waitedMs: YT_STATE_FALLBACK_MS, eventPlaying: false, polledState: 5, polledTime: 12, start: 12 }), 'retry')
  assert.equal(coverFallbackAction({ waitedMs: YT_STATE_FALLBACK_MS, eventPlaying: false, polledState: 1, polledTime: 12, start: 12 }), 'treat-playing')
})

test('landscape thumbs and ?debug=yt', () => {
  assert.equal(landscapeThumb('NIR88RRpat4'), 'https://i.ytimg.com/vi/NIR88RRpat4/hqdefault.jpg')
  assert.equal(landscapeThumb('bad'), null)
  assert.equal(ytDebugOn('?debug=yt'), true)
  assert.equal(ytDebugOn('clip=1&debug=yt'), true)
  assert.equal(ytDebugOn('?debug=off'), false)
})

test('the hold restarts on buffering or any other state, and the frame is uncropped', () => {
  assert.equal(coverHoldShouldRestart(3, 1), true)
  assert.equal(coverHoldShouldRestart(2, 1), true)
  assert.equal(coverHoldShouldRestart(1, 3), true)
  assert.equal(coverHoldShouldRestart(1, 1, true), false)
  assert.equal(coverHoldShouldRestart(1, 1, false), true)
  const crop = filmIframeCrop()
  assert.equal(crop.heightPct, 100)
  assert.equal(crop.topPct, 0)
  assert.equal(filmCoverKey({ cutId: 12, youtubeId: 'FAxIZIqwfd8' }), '12:FAxIZIqwfd8')
  assert.equal(filmCoverKey({ cutId: 1, youtubeId: null }), '')
  assert.equal(playerReadout({ state: 1, time: 60.1, currentTime: 60.1, cover: false }), 'state 1 time 60.1 cur 60.1 cover no')
  assert.equal(advanceLeavesPlayable({ userPaused: false, boardOpen: false, swallowUntil: 10, now: 10 }), true)
  assert.equal(advanceLeavesPlayable({ userPaused: true, boardOpen: false, swallowUntil: 0, now: 20 }), false)
  assert.equal(coverHoldMsLeft(0, 8000), YT_CHROME_HOLD_MS)
  assert.equal(coverHoldMsLeft(1000, 2500), 3000)
  assert.equal(coverHoldKey(3, 'hors'), '3:hors')
  assert.notEqual(coverHoldKey(2, 'hors'), coverHoldKey(3, 'hors'))
})
