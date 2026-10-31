import assert from 'node:assert/strict'
import { test } from 'node:test'
import { activeRole, kineticLines, kineticWindow } from '../../src/lib/kinetic-lines'

const lines = kineticLines({
  hook: 'This is so beautiful.',
  turn: 'Never let a sin become so big.',
  land: 'Expect good from God.',
  hookAt: 10,
  turnAt: 24,
  landAt: 40,
  appetiserStart: 8,
  appetiserEnd: 70,
})

test('the three lines keep their own times', () => {
  assert.deepEqual(lines.map((line) => [line.role, line.at]), [['hook', 10], ['turn', 24], ['land', 40]])
  assert.equal(lines[0].text, 'This is so beautiful.')
})

test('only the line being said is up', () => {
  assert.equal(activeRole(lines, 10), 'hook')
  assert.equal(activeRole(lines, 23.9), 'hook')
  assert.equal(activeRole(lines, 24), 'turn')
  assert.equal(activeRole(lines, 39.9), 'turn')
  assert.equal(activeRole(lines, 40), 'land')
  assert.equal(activeRole(lines, 68), 'land')
})

test('missing times are laid across the appetiser', () => {
  const spread = kineticLines({ hook: 'H', turn: 'T', land: 'L', appetiserStart: 0, appetiserEnd: 40 })
  assert.equal(spread[0].at, 0)
  assert.equal(spread[2].at, 30)
  assert.ok(spread[1].at > spread[0].at && spread[1].at < spread[2].at)
  const window = kineticWindow(spread, 40)
  assert.equal(window.start, 0)
  assert.ok(window.end >= 40)
})
