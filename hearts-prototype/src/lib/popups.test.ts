import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PopupWatcher, timestampTrigger, type PopupPoint } from './popups'
import { TRENDS_MIN, trendsFrom } from './trends'

const point = (id: number, atSecond: number): PopupPoint => ({ id, number: id, triggerType: 'timestamp', atSecond, prompt: `Q${id}`, kind: 'reflection', options: [], state: 'open', unlocksAt: null, answered: false, lessonId: 1 })

test('a timestamp question fires once as playback crosses it, with 0.3 s of lead', () => {
  const watcher = new PopupWatcher([point(1, 10), point(2, 20)])
  watcher.startViewing('v1', 0)
  assert.deepEqual(watcher.tick(9.5).map((row) => row.id), [])
  assert.deepEqual(watcher.tick(9.75).map((row) => row.id), [1])
  assert.deepEqual(watcher.tick(10.5).map((row) => row.id), [])
})

test('a forward seek across two questions shows both, in order', () => {
  const watcher = new PopupWatcher([point(2, 30), point(1, 12)])
  watcher.startViewing('v1', 0)
  assert.deepEqual(watcher.tick(45).map((row) => row.id), [1, 2])
})

test('seeking back in the same viewing does not fire again; a new viewing does', () => {
  const watcher = new PopupWatcher([point(1, 10)])
  watcher.startViewing('v1', 0)
  assert.equal(watcher.tick(10).length, 1)
  watcher.seek(2)
  assert.equal(watcher.tick(11).length, 0)
  watcher.startViewing('v2', 0)
  assert.equal(watcher.tick(11).length, 1)
})

test('the trigger ignores a backward tick', () => {
  assert.deepEqual(timestampTrigger.due([point(1, 10)], { prev: 20, now: 5, viewingId: 'v' }, new Set()), [])
})

test(`trends hold back any week with fewer than ${TRENDS_MIN} people`, () => {
  const rows = (n: number, week: string) => Array.from({ length: n }, () => ({ portal: 1, isoWeek: week, doorKey: 'company', laneTop2: ['trust'], scenePasses: ['money'] }))
  const result = trendsFrom([...rows(TRENDS_MIN - 1, '2026-W39'), ...rows(TRENDS_MIN, '2026-W40')])
  const early = result.find((row) => row.week === '2026-W39')!
  const later = result.find((row) => row.week === '2026-W40')!
  assert.equal(early.shown, false)
  assert.equal(later.shown, true)
  if (later.shown) assert.deepEqual(later.doors, [['company', TRENDS_MIN]])
  assert.equal(trendsFrom(rows(TRENDS_MIN, '2026-W40'), 2).length, 0)
})
