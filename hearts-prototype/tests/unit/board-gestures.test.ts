import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BOARD_ARM_MS, PICTURE_SWALLOW_MS, boardClickAllowed, boardShouldClose, boardShouldOpen, isDragEnd, moreAfterAdvanceThenScrim, pictureTapIgnored, pointerTravel } from '../../src/lib/board-gestures'

test('a click that ends a More drag is ignored', () => {
  assert.equal(isDragEnd(0), false)
  assert.equal(isDragEnd(7), false)
  assert.equal(isDragEnd(8), true)
  assert.equal(pointerTravel({ x: 10, y: 200 }, { x: 12, y: 120 }) > 8, true)
})

test('sheet buttons wait until the drawer has settled', () => {
  assert.equal(boardClickAllowed({ openedAt: 1000, now: 1100, travel: 0 }), false)
  assert.equal(boardClickAllowed({ openedAt: 1000, now: 1000 + BOARD_ARM_MS, travel: 0 }), true)
  assert.equal(boardClickAllowed({ openedAt: 1000, now: 2000, travel: 24 }), false)
})

test('a short drag-down closes the More sheet', () => {
  assert.equal(boardShouldClose(12), false)
  assert.equal(boardShouldClose(21), true)
  assert.equal(boardShouldClose(12, 0.4), true)
  assert.equal(boardShouldClose(7, 1), false)
  assert.equal(boardShouldOpen(-21), true)
  assert.equal(boardShouldOpen(-8), false)
  assert.equal(boardShouldOpen(-12, -0.4), true)
})

test('advance, open More, close on the scrim: the film stays playing', () => {
  const swallowUntil = 1000
  const after = moreAfterAdvanceThenScrim({
    userPausedAfterAdvance: false,
    boardOpen: false,
    leftoverTapAt: swallowUntil - 10,
    swallowUntil,
    playerState: 1,
  })
  assert.equal(after.playing, true)
  assert.equal(after.pictureIgnored, true)
  assert.equal(after.userPaused, false)
  assert.equal(pictureTapIgnored({ boardOpen: true, swallowUntil: 0, now: 50 }), true)
  assert.equal(pictureTapIgnored({ boardOpen: false, swallowUntil: 0, now: 50 }), false)
  assert.equal(PICTURE_SWALLOW_MS, 480)
})
