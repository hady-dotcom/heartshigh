import assert from 'node:assert/strict'
import { test } from 'node:test'
import { firstCourseVerdict, isGentleOpening, libraryStartNote, pickGentleFirstCourse, seriesPartNumber } from './first-course'

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
        { id: 1, title: 'How to Live Like the Prophet, Session 1', order: 1, durationSeconds: 3600 },
        { id: 6, title: 'How to Live Like the Prophet, Session 6', order: 6, durationSeconds: 10000 },
      ],
    },
    {
      courseId: 20,
      courseTitle: 'Al-Fatihah',
      lessons: [{ id: 9, title: 'Al-Fatihah, part 1', order: 1, durationSeconds: 2400 }],
    },
  ]
  const pick = pickGentleFirstCourse(6, courses)
  assert.equal(pick?.courseId, 10)
  assert.equal(pick?.lessonId, 1)
  assert.match(pick?.reason || '', /earliest full talk|part 1/i)
})

test('a long Session 6 stays when it is the earliest sitting in the library', () => {
  const courses = [
    {
      courseId: 10,
      courseTitle: 'How to Live Like the Prophet',
      lessons: [{ id: 6, title: 'How to Live Like the Prophet, Session 6', order: 1, durationSeconds: 10000 }],
    },
    {
      courseId: 20,
      courseTitle: 'The Names: short clips',
      lessons: [{ id: 9, title: 'The Names Class 20: Al-Nūr', order: 1, durationSeconds: 98 }],
    },
  ]
  const pick = pickGentleFirstCourse(6, courses)
  assert.equal(pick?.courseId, 10)
  assert.equal(pick?.lessonId, 6)
  assert.equal(firstCourseVerdict(pick, courses).ok, true)
  const clip = pickGentleFirstCourse(9, courses)
  assert.notEqual(clip?.lessonId, 9)
  assert.equal(firstCourseVerdict(clip, courses).ok, true)
})

test('a marriage sitting is skipped when another part 1 is in the list', () => {
  const courses = [
    {
      courseId: 10,
      courseTitle: 'Nikah and mahr',
      lessons: [{ id: 6, title: 'Session 1: The mahr', order: 1, durationSeconds: 2400 }],
    },
    {
      courseId: 20,
      courseTitle: 'Al-Fatihah',
      lessons: [{ id: 9, title: 'Al-Fatihah, part 1', order: 1, durationSeconds: 2400 }],
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

test('a short clip is never marked OK', () => {
  const courses = [
    {
      courseId: 20,
      courseTitle: 'The Names: short clips',
      lessons: [{ id: 9, title: 'The Names Class 20: Al-Nūr', order: 1, durationSeconds: 98 }],
    },
  ]
  const pick = pickGentleFirstCourse(9, courses)
  assert.equal(firstCourseVerdict(pick, courses).ok, false)
})
