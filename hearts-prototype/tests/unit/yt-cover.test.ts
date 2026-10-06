import assert from 'node:assert/strict'
import { test } from 'node:test'
import { YT_CHROME_HOLD_MS, coverShouldHold, filmCoverVisible, pauseMarkVisible } from '../../src/lib/yt-cover'

test('the cover holds until YouTube has been PLAYING past its chrome fade', () => {
  assert.equal(coverShouldHold(0), true)
  assert.equal(coverShouldHold(YT_CHROME_HOLD_MS - 1), true)
  assert.equal(coverShouldHold(YT_CHROME_HOLD_MS), false)
  assert.equal(filmCoverVisible({ playing: true, playingForMs: 400, paused: false, ended: false }), true)
  assert.equal(filmCoverVisible({ playing: true, playingForMs: YT_CHROME_HOLD_MS, paused: false, ended: false }), false)
})

test('pause and the end of a clip keep the app cover up, and ended never shows a pause mark', () => {
  assert.equal(filmCoverVisible({ playing: false, playingForMs: 0, paused: true, ended: false }), true)
  assert.equal(filmCoverVisible({ playing: false, playingForMs: 0, paused: false, ended: true }), true)
  assert.equal(pauseMarkVisible({ paused: true, ended: false, userPaused: true }), true)
  assert.equal(pauseMarkVisible({ paused: true, ended: true, userPaused: true }), false)
  assert.equal(pauseMarkVisible({ paused: false, ended: false, userPaused: false }), false)
})
