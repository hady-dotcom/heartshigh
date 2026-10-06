import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BOARD_ARM_MS, boardClickAllowed, boardShouldClose, boardShouldOpen, isDragEnd, pointerTravel } from '../../src/lib/board-gestures'

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
  assert.equal(boardShouldOpen(-21), true)
  assert.equal(boardShouldOpen(-8), false)
})
