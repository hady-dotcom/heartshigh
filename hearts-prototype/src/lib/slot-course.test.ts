import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lessonsByCourseOrder, slotCourseId, slotHref } from './slot-course'

test('a scheduled talk opens in its own course, not the plan fallback', () => {
  assert.equal(slotCourseId({ lessonCourse: 22, slotCourseId: 8, planCourseId: 8 }), 22)
  assert.equal(slotCourseId({ lessonCourse: { id: 22 }, slotCourseId: null, planCourseId: 8 }), 22)
  assert.equal(slotCourseId({ lessonCourse: null, slotCourseId: 15, planCourseId: 8 }), 15)
  assert.equal(slotCourseId({ lessonCourse: null, slotCourseId: null, planCourseId: 8 }), 8)
  assert.equal(slotHref('/p/east-london', 41, 22), '/p/east-london/course/22?part=41')
  assert.equal(slotHref('/p/east-london', 41, null), null)
})

test('a pack keeps each course together instead of interleaving by global order', () => {
  const rows = [
    { id: 1, course: 10, order: 2 },
    { id: 2, course: 11, order: 1 },
    { id: 3, course: 10, order: 1 },
    { id: 4, course: 11, order: 2 },
  ]
  assert.deepEqual(
    lessonsByCourseOrder(rows, [10, 11]).map((row) => row.id),
    [1, 3, 2, 4],
  )
})
