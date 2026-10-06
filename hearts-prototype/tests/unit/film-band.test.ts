import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filmBandHeight, PORTRAIT_BAND_MAX } from '../../src/lib/framing/layout'

test('a landscape talk stays 16:9; a portrait talk may grow the band up to 60% of the viewport', () => {
  assert.equal(filmBandHeight(390, 844, false), 390 * 9 / 16)
  const tall = filmBandHeight(390, 844, true)
  assert.ok(tall > 390 * 9 / 16)
  assert.ok(tall <= 844 * PORTRAIT_BAND_MAX + 0.01)
  assert.ok(tall <= 390 * 16 / 9 + 0.01)
})
