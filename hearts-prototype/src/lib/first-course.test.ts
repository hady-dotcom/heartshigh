import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isGentleOpening, libraryStartNote, pickGentleFirstCourse, seriesPartNumber } from './first-course'

test('a later session or part is not a gentle opening', () => {
  assert.equal(seriesPartNumber('How to Live Like the Prophet, Session 6'), 6)
  assert.equal(isGentleOpening('How to Live Like the Prophet, Session 6'), false)
  assert.equal(isGentleOpening('Al-Fatihah, part 1'), true)
  assert.equal(isGentleOpening('A talk on mahr and marriage'), false)
})

test('the first course walks back to part 1 of the matched series', () => {
  const courses = [
    {
      courseId: 10,
      courseTitle: 'How to Live Like the Prophet',
      lessons: [
        { id: 1, title: 'How to Live Like the Prophet, Session 1', order: 1 },
        { id: 6, title: 'How to Live Like the Prophet, Session 6', order: 6 },
      ],
    },
    {
      courseId: 20,
      courseTitle: 'Al-Fatihah',
      lessons: [{ id: 9, title: 'Al-Fatihah, part 1', order: 1 }],
    },
  ]
  const pick = pickGentleFirstCourse(6, courses)
  assert.equal(pick?.courseId, 10)
  assert.equal(pick?.lessonId, 1)
  assert.match(pick?.reason || '', /part 1/i)
})

test('a marriage sitting is skipped when another part 1 is in the list', () => {
  const courses = [
    {
      courseId: 10,
      courseTitle: 'Nikah and mahr',
      lessons: [{ id: 6, title: 'Session 1: The mahr', order: 1 }],
    },
    {
      courseId: 20,
      courseTitle: 'Al-Fatihah',
      lessons: [{ id: 9, title: 'Al-Fatihah, part 1', order: 1 }],
    },
  ]
  const pick = pickGentleFirstCourse(6, courses)
  assert.equal(pick?.courseId, 20)
  assert.equal(pick?.lessonId, 9)
})

test('the library-start line names the earliest numbered sitting', () => {
  assert.equal(libraryStartNote(['Lesson 3', 'Lesson 4']), 'Our library starts this course at Lesson 3.')
  assert.equal(libraryStartNote(['Lesson 1', 'Lesson 2']), null)
})
