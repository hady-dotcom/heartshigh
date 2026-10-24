import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AFTERNOON_PLAN, demoGardenAt, demoWeekGardenGuard, demoWeekMonday, demoWeekSlots, pickLessonsByArea } from './demo-week'

test('the afternoon walk picks talks from more than one garden tree', () => {
  const picked = pickLessonsByArea([
    { id: 1, courseId: 7, title: 'His Books', door: 12 },
    { id: 2, courseId: 7, title: 'The sitting', door: 1 },
    { id: 3, courseId: 8, title: 'Ihsan', door: 16 },
    { id: 4, courseId: 8, title: 'Prayer', door: 4 },
    { id: 5, courseId: 9, title: 'The Hour', door: 18 },
    { id: 6, courseId: 9, title: 'Unplaced', door: null },
  ])
  const doors = picked.map((row) => row.door)
  assert.ok(doors.includes(12))
  assert.ok(doors.includes(1))
  assert.ok(doors.includes(16))
  assert.ok(doors.includes(4))
  assert.ok(doors.includes(18))
  assert.ok(picked.length >= 5)
})

test('demo My week spreads talks across the seven days and keeps each course id', () => {
  const monday = demoWeekMonday(new Date('2026-10-05T16:00:00Z'))
  assert.equal(monday, '2026-10-05')
  const slots = demoWeekSlots({
    monday,
    lessons: [
      { id: 1, title: 'One', courseId: 22 },
      { id: 2, title: 'Two', courseId: 22 },
      { id: 3, title: 'Three', courseId: 7 },
      { id: 4, title: 'Four', courseId: 7 },
      { id: 5, title: 'Five', courseId: 8 },
      { id: 6, title: 'Six', courseId: 8 },
      { id: 7, title: 'Seven', courseId: 9 },
    ],
  })
  assert.equal(slots.length, 7)
  assert.equal(new Set(slots.map((slot) => slot.date)).size, 7)
  assert.equal(slots[0].courseId, 22)
  assert.equal(slots[2].courseId, 7)
  assert.equal(AFTERNOON_PLAN, 'Afternoon walk week')
  assert.match(demoWeekGardenGuard({ NODE_ENV: 'production' }) || '', /production/)
  assert.equal(demoWeekGardenGuard({ NODE_ENV: 'test', DATABASE_URL: 'file:./data/hearts.db' }), null)
  const first = demoGardenAt(new Date('2026-10-05T16:00:00Z'), 0)
  const last = demoGardenAt(new Date('2026-10-05T16:00:00Z'), 6)
  assert.equal(first.slice(0, 10), '2026-10-05')
  assert.equal(last.slice(0, 10), '2026-09-29')
})
