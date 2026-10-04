import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FALLBACK_ASR_MINUTES, FALLBACK_FAJR_MINUTES, readPin, resolveTheme, themeBootScript } from './daypart'

function at(hours: number, minutes = 0) {
  return new Date(2026, 5, 21, hours, minutes, 0)
}

test('dawn runs from the Fajr stand-in until late afternoon', () => {
  assert.equal(resolveTheme(at(4, 59)), 'evening')
  assert.equal(resolveTheme(at(5, 0)), 'dawn')
  assert.equal(resolveTheme(at(12, 30)), 'dawn')
  assert.equal(resolveTheme(at(15, 59)), 'dawn')
  assert.equal(resolveTheme(at(16, 0)), 'evening')
  assert.equal(resolveTheme(at(23, 10)), 'evening')
  assert.equal(FALLBACK_FAJR_MINUTES, 300)
  assert.equal(FALLBACK_ASR_MINUTES, 960)
})

test('a pin wins over the clock, and auto follows it', () => {
  assert.equal(resolveTheme(at(10), 'evening'), 'evening')
  assert.equal(resolveTheme(at(21), 'dawn'), 'dawn')
  assert.equal(resolveTheme(at(21), 'auto'), 'evening')
})

test('prayer marks can move the window, and a broken pair falls back', () => {
  assert.equal(resolveTheme(at(4, 30), 'auto', { fajr: 4 * 60, asr: 15 * 60 + 30 }), 'dawn')
  assert.equal(resolveTheme(at(15, 30), 'auto', { fajr: 4 * 60, asr: 15 * 60 + 30 }), 'evening')
  assert.equal(resolveTheme(at(3, 0), 'auto', { fajr: 4 * 60, asr: 15 * 60 }), 'evening')
  assert.equal(resolveTheme(at(6), 'auto', { fajr: -1, asr: 99 * 60 }), 'dawn')
  assert.equal(resolveTheme(at(10), 'auto', { fajr: 18 * 60, asr: 6 * 60 }), 'dawn')
  assert.equal(resolveTheme(at(10), 'evening', { fajr: 4 * 60, asr: 15 * 60 }), 'evening')
})

test('stored pins accept plain words and JSON', () => {
  assert.equal(readPin(null), 'auto')
  assert.equal(readPin(''), 'auto')
  assert.equal(readPin('dawn'), 'dawn')
  assert.equal(readPin('"evening"'), 'evening')
  assert.equal(readPin('{"nope":1}'), 'auto')
  assert.equal(readPin('midnight'), 'auto')
})

test('the boot script uses the same key and the same fallback minutes', () => {
  const script = themeBootScript()
  assert.match(script, /hearts\.theme/)
  assert.match(script, new RegExp(String(FALLBACK_FAJR_MINUTES)))
  assert.match(script, new RegExp(String(FALLBACK_ASR_MINUTES)))
  assert.match(script, /dataset\.theme/)
})
