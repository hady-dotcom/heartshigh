import assert from 'node:assert/strict'
import { test } from 'node:test'
import { angryFromLatest, detectAngryTaps, heatmapGrid, sameSpot } from './insight-taps'

test('three taps in the same spot within 1.5 s are an angry burst', () => {
  const taps = [
    { x: 120, y: 400, at: 1000 },
    { x: 122, y: 398, at: 1400 },
    { x: 118, y: 403, at: 1900 },
  ]
  const bursts = detectAngryTaps(taps)
  assert.equal(bursts.length, 1)
  assert.equal(bursts[0].count, 3)
  assert.ok(sameSpot(bursts[0], { x: 120, y: 400 }))
})

test('taps more than 1.5 s apart are not angry', () => {
  const taps = [
    { x: 10, y: 10, at: 0 },
    { x: 10, y: 10, at: 800 },
    { x: 10, y: 10, at: 2000 },
  ]
  assert.equal(detectAngryTaps(taps).length, 0)
})

test('taps in different spots are not angry', () => {
  const taps = [
    { x: 10, y: 10, at: 0 },
    { x: 200, y: 10, at: 200 },
    { x: 10, y: 400, at: 400 },
  ]
  assert.equal(detectAngryTaps(taps).length, 0)
})

test('a fourth tap in the same burst is not reported twice', () => {
  const history = [
    { x: 50, y: 50, at: 0 },
    { x: 50, y: 50, at: 200 },
  ]
  const third = angryFromLatest(history, { x: 50, y: 50, at: 400 })
  assert.ok(third)
  assert.equal(third!.count, 3)
  const fourth = angryFromLatest([...history, { x: 50, y: 50, at: 400 }], { x: 50, y: 50, at: 600 })
  assert.equal(fourth, null)
})

test('heatmap bins taps into a grid', () => {
  const cells = heatmapGrid(
    [
      { x: 10, y: 10, vw: 100, vh: 100 },
      { x: 12, y: 11, vw: 100, vh: 100 },
      { x: 90, y: 90, vw: 100, vh: 100 },
    ],
    10,
    10,
  )
  assert.equal(cells.length, 2)
  const hot = cells.find((cell) => cell.n === 2)
  assert.ok(hot)
})
