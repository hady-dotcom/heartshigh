import assert from 'node:assert/strict'
import { test } from 'node:test'
import { splitEvenly, studyDates } from './schedule'

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

test('rejects an empty weekday set and a range with no matching days', () => {
  assert.throws(() => studyDates('2026-10-07', '2026-10-09', []), /at least one day/)
  assert.throws(() => studyDates('2026-10-07', '2026-10-08', [0]), /None of those weekdays/)
})
