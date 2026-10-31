import assert from 'node:assert/strict'
import { test } from 'node:test'

function lum([r, g, b]: number[]) {
  const c = [r, g, b].map((value) => {
    const s = value / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function contrast(fg: [number, number, number], bg: [number, number, number]) {
  const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

test('Home Your plan cream on teal meets AA', () => {
  const cream: [number, number, number] = [241, 228, 198]
  const teal: [number, number, number] = [15, 46, 44]
  assert.ok(contrast(cream, teal) >= 4.5, `cream on teal is ${contrast(cream, teal).toFixed(2)}:1`)
})
