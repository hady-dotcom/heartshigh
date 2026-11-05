import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseLengthInput } from './length'

test('an empty length is left unset', () => {
  assert.deepEqual(parseLengthInput(''), { ok: true, seconds: undefined })
  assert.deepEqual(parseLengthInput('   '), { ok: true, seconds: undefined })
})

test('a number is seconds, and minutes:seconds are accepted', () => {
  assert.deepEqual(parseLengthInput('8'), { ok: true, seconds: 8 })
  assert.deepEqual(parseLengthInput('90'), { ok: true, seconds: 90 })
  assert.deepEqual(parseLengthInput('1:30'), { ok: true, seconds: 90 })
  assert.deepEqual(parseLengthInput('1:02:03'), { ok: true, seconds: 3723 })
})

test('minutes and seconds stay under 60', () => {
  assert.equal(parseLengthInput('1:60').ok, false)
  assert.equal(parseLengthInput('not a time').ok, false)
})
