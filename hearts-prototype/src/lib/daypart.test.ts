import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FALLBACK_ASR_MINUTES, FALLBACK_FAJR_MINUTES, readPin, resolveTheme, themeBootScript } from './daypart'

function at(hours: number, minutes = 0) {
  return new Date(2026, 5, 21, hours, minutes, 0)
}

test('evening is the only theme, at any hour', () => {
  assert.equal(resolveTheme(at(5, 0)), 'evening')
  assert.equal(resolveTheme(at(10, 0)), 'evening')
  assert.equal(resolveTheme(at(16, 0)), 'evening')
  assert.equal(resolveTheme(at(21), 'dawn'), 'evening')
  assert.equal(resolveTheme(at(10), 'auto', { fajr: 4 * 60, asr: 15 * 60 }), 'evening')
  assert.equal(FALLBACK_FAJR_MINUTES, 300)
  assert.equal(FALLBACK_ASR_MINUTES, 960)
})

test('a stored dawn pin is ignored', () => {
  assert.equal(readPin('dawn'), 'auto')
  assert.equal(readPin('evening'), 'evening')
  assert.equal(readPin(null), 'auto')
})

test('the boot script always sets evening and clears dawn', () => {
  const script = themeBootScript()
  assert.match(script, /hearts\.theme/)
  assert.match(script, /dataset\.theme='evening'/)
  assert.match(script, /removeItem/)
})
