import assert from 'node:assert/strict'
import { test } from 'node:test'
import { overMinutesNote, planAcrossDays, splitEvenly, spreadIndices, studyDates } from './schedule'

test('splits a pack evenly across Wednesday and Friday only', () => {
  const dates = studyDates('2026-10-07', '2026-10-16', [3, 5])
  assert.deepEqual(dates, ['2026-10-07', '2026-10-09', '2026-10-14', '2026-10-16'])
  const items = ['a', 'b', 'c', 'd', 'e', 'f']
  const slots = splitEvenly(items, dates)
  assert.deepEqual(
    slots.map((slot) => slot.items),
    [
      ['a', 'b'],
      ['c', 'd'],
      ['e'],
      ['f'],
    ],
  )
  const used = new Set(slots.filter((slot) => slot.items.length).map((slot) => slot.date))
  for (const date of used) assert.ok(dates.includes(date))
})

test('balanced split V=10 D=4 is 3,3,2,2 and never the old 3,3,3,1', () => {
  const dates = ['d1', 'd2', 'd3', 'd4']
  const items = Array.from({ length: 10 }, (_, index) => index + 1)
  const counts = splitEvenly(items, dates).map((slot) => slot.items.length)
  assert.deepEqual(counts, [3, 3, 2, 2])
  assert.deepEqual(splitEvenly(items, dates).flatMap((slot) => slot.items), items)
})

test('balanced split V=8 D=4 is 2,2,2,2 and never the old 3,3,2,0', () => {
  const dates = ['d1', 'd2', 'd3', 'd4']
  const items = Array.from({ length: 8 }, (_, index) => index + 1)
  const counts = splitEvenly(items, dates).map((slot) => slot.items.length)
  assert.deepEqual(counts, [2, 2, 2, 2])
})

test('V=3 D=12 lands on days 1, 5 and 9', () => {
  assert.deepEqual(spreadIndices(3, 12), [0, 4, 8])
  const dates = Array.from({ length: 12 }, (_, index) => `d${index + 1}`)
  const planned = planAcrossDays(['a', 'b', 'c'], dates)
  assert.deepEqual(planned.slots.map((slot) => slot.date), ['d1', 'd5', 'd9'])
  assert.match(planned.note || '', /spaced across the span/)
})

test('V=1 D=8 offers one date, never a spread sitting', () => {
  const dates = Array.from({ length: 8 }, (_, index) => `d${index + 1}`)
  const planned = planAcrossDays(['only'], dates)
  assert.deepEqual(planned.slots.map((slot) => slot.date), ['d1'])
  assert.match(planned.note || '', /1 talk/)
})

test('a talk longer than the day is named, not silently crushed', () => {
  assert.match(overMinutesNote([39], 20) || '', /39 minutes/)
  assert.equal(overMinutesNote([15], 20), null)
})

test('rejects an empty weekday set and a range with no matching days', () => {
  assert.throws(() => studyDates('2026-10-07', '2026-10-09', []), /at least one day/)
  assert.throws(() => studyDates('2026-10-07', '2026-10-08', [0]), /None of those weekdays/)
})
