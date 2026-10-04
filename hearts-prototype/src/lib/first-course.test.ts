import assert from 'node:assert/strict'
import { test } from 'node:test'
import { firstCourseVerdict, isGentleOpening, libraryStartNote, pickGentleFirstCourse, seriesPartNumber } from './first-course'

test('a later session or part is not a gentle opening', () => {
  assert.equal(seriesPartNumber('How to Live Like the Prophet, Session 6'), 6)
  assert.equal(isGentleOpening('How to Live Like the Prophet, Session 6'), false)
  assert.equal(isGentleOpening('Al-Fatihah, part 1'), true)
  assert.equal(isGentleOpening('A talk on mahr and marriage'), false)
})

test('the first course walks back to part 1 of the matched series when that part is on-topic', () => {
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
  const pick = pickGentleFirstCourse(6, courses, [1, 6])
  assert.equal(pick?.courseId, 10)
  assert.equal(pick?.lessonId, 1)
  assert.match(pick?.reason || '', /earliest full talk|part 1/i)
})

test('walking back never leaves the door\'s topic', () => {
  const courses = [
    {
      courseId: 10,
      courseTitle: 'The Names',
      lessons: [
        { id: 19, title: 'The Names Class 19: Ar-Rabb', order: 1, durationSeconds: 3600 },
        { id: 20, title: 'The Names Class 20: Al-Nūr', order: 2, durationSeconds: 3600 },
      ],
    },
  ]
  const pick = pickGentleFirstCourse(20, courses, [20])
  assert.equal(pick?.lessonId, 20)
  assert.equal(firstCourseVerdict(pick, courses, [20]).note, 'OK')
  const crossed = pickGentleFirstCourse(20, courses, [19])
  assert.notEqual(crossed?.lessonId, 20)
  assert.equal(firstCourseVerdict({ courseId: 10, lessonId: 19, courseTitle: 'The Names', lessonTitle: 'The Names Class 19: Ar-Rabb', reason: '' }, courses, [20]).note, 'OFF-TOPIC')
})

test('a long Session 6 stays when leftover talks share a buffet, and does not walk to another series', () => {
  const courses = [
    {
      courseId: 33,
      courseTitle: 'Ten sittings',
      lessons: [
        { id: 1, title: 'How to Live Like the Prophet, Session 6', order: 1, durationSeconds: 10080 },
        { id: 16, title: 'Purification of the Heart w/ Ustadha Fatima Lette | Session 1', order: 4, durationSeconds: 3600 },
      ],
    },
    {
      courseId: 20,
      courseTitle: 'The Names: short clips',
      lessons: [{ id: 9, title: 'The Names Class 20: Al-Nūr', order: 1, durationSeconds: 98 }],
    },
  ]
  const pick = pickGentleFirstCourse(1, courses)
  assert.equal(pick?.lessonId, 1)
  assert.match(pick?.lessonTitle || '', /Session 6/)
  assert.equal(firstCourseVerdict(pick, courses).ok, true)
  assert.equal(firstCourseVerdict(pick, courses).note, 'OK')
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
  assert.equal(clip?.lessonId, 9)
  assert.equal(firstCourseVerdict(clip, courses).ok, false)
})

test('a marriage sitting stays on-topic and is marked life-stage, never swapped for another course', () => {
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
  const pick = pickGentleFirstCourse(6, courses, [6])
  assert.equal(pick?.courseId, 10)
  assert.equal(pick?.lessonId, 6)
  assert.equal(firstCourseVerdict(pick, courses, [6]).note, 'LIFE-STAGE TALK')
})

test('a door with no on-topic long talk says so', () => {
  const courses = [
    {
      courseId: 20,
      courseTitle: 'The Names: short clips',
      lessons: [{ id: 9, title: 'The Names Class 20: Al-Nūr', order: 1, durationSeconds: 98 }],
    },
  ]
  const pick = pickGentleFirstCourse(null, courses, [])
  assert.equal(pick, null)
  assert.equal(firstCourseVerdict(pick, courses, []).note, 'NO ON-TOPIC LONG TALK')
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
