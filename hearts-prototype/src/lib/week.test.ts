import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dateKeyInZone, fitDatesToTalks, formatLearnerDate, listDates, mondayKey, parseWeekdays, planKeepPath, planToast, talksLabel, weekStrip, weekdayList } from './week'

test('the week strip is Monday first and marks today in Toronto', () => {
  const sunday = new Date('2026-10-04T16:00:00Z')
  const days = weekStrip(sunday, 'America/Toronto')
  assert.equal(days[0].label, 'Mon')
  assert.equal(days[0].key, '2026-09-28')
  assert.equal(days[6].label, 'Sun')
  assert.equal(days.find((day) => day.today)?.key, '2026-10-04')
  assert.equal(mondayKey(sunday, 'America/Toronto'), '2026-09-28')
  assert.equal(dateKeyInZone(sunday, 'America/Toronto'), '2026-10-04')
})

test('one sitting never keeps leftover empty days, and several talks span the range', () => {
  const dates = ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19', '2026-10-21']
  const one = fitDatesToTalks(dates, 1)
  assert.deepEqual(one.dates, ['2026-10-05'])
  assert.match(one.note || '', /1 talk/)
  const three = fitDatesToTalks(dates, 3)
  assert.deepEqual(three.dates, ['2026-10-05', '2026-10-09', '2026-10-16'])
  const twelve = Array.from({ length: 12 }, (_, index) => `2026-10-${String(index + 5).padStart(2, '0')}`)
  const spread = fitDatesToTalks(twelve, 3)
  assert.deepEqual(spread.dates, [twelve[0], twelve[4], twelve[8]])
  assert.match(spread.note || '', /spaced across the span/)
})

test('the plan toast names the actual sitting dates', () => {
  assert.equal(weekdayList([1, 3, 5]), 'Mondays, Wednesdays and Fridays')
  assert.equal(formatLearnerDate('2026-10-12', 'long'), '12 October 2026')
  assert.equal(listDates(['2026-10-07', '2026-10-09']), 'Wed 7 October and Fri 9 October')
  assert.equal(planToast(1, ['2026-10-04']), 'Done. Your 1 talk is on Sun 4 October.')
  assert.equal(
    planToast(3, ['2026-10-07', '2026-10-09', '2026-10-14']),
    'Done. Your 3 talks are on Wed 7 October, Fri 9 October and Wed 14 October.',
  )
  assert.equal(talksLabel(6, 5 * 3600), '6 talks · about 5 hours')
  assert.equal(talksLabel(1, 900), '1 talk · about 15 min')
})

test('the plan form path keeps the chosen course and days', () => {
  assert.deepEqual(parseWeekdays('3,5'), [3, 5])
  assert.equal(
    planKeepPath('/p/east-london/week', { course: 12, start: '2026-10-07', end: '2026-10-16', weekdays: [3, 5], minutes: 20 }),
    '/p/east-london/week?course=12&start=2026-10-07&end=2026-10-16&days=3%2C5&minutes=20&view=new',
  )
  assert.equal(
    planKeepPath('/p/east-london/week?from=course', { course: 12, start: '2026-10-07', end: '2026-10-16', weekdays: [3, 5], minutes: 20, from: 'course' }),
    '/p/east-london/week?from=course&course=12&start=2026-10-07&end=2026-10-16&days=3%2C5&minutes=20&view=new',
  )
})
