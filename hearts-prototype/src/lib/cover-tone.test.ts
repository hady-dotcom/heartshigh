import assert from 'node:assert/strict'
import test from 'node:test'
import { toneFromRgb } from './cover-tone'

test('a warm photograph becomes a soft wash and a deep button, not a neon green', () => {
  const paint = toneFromRgb(138, 110, 64)
  const wash = paint.wash.match(/hsl\((\d+) (\d+)% (\d+)%\)/)
  const tone = paint.tone.match(/hsl\((\d+) (\d+)% (\d+)%\)/)
  assert.ok(wash && tone)
  const hue = Number(tone?.[1])
  const sat = Number(tone?.[2])
  const light = Number(tone?.[3])
  assert.ok(hue > 20 && hue < 55, paint.tone)
  assert.ok(sat <= 42, paint.tone)
  assert.ok(light <= 38, paint.tone)
  assert.equal(Number(wash?.[3]) > 80, true)
})
