import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DOORS } from './doors'
import { courseDoorHeadingVisible, lessonDoor, primaryBestClause, showCourseDoorHeading } from './course-doors'

test('primary clause prefers the placeholder, then the majority of approved cuts', () => {
  assert.equal(primaryBestClause([{ bestClause: 27, status: 'approved', start: 0, end: 20 }, { bestClause: 15, status: 'approved', start: 20, end: 80 }, { bestClause: 15, status: 'approved', start: 80, end: 140 }]), 15)
  assert.equal(primaryBestClause([{ bestClause: 27, placeholder: true, start: 0, end: 20 }, { bestClause: 15, status: 'approved', start: 20, end: 200 }]), 27)
})

test('a prayer title wins over an early qadar cut', () => {
  const door = lessonDoor({
    lessonTitle: 'Establish the prayer',
    courseTitle: 'First steps',
    cuts: [{ bestClause: 27, status: 'approved', start: 0, end: 12 }],
    doors: DOORS,
  })
  assert.equal(door?.number, 5)
})

test('a one-talk course does not need a door heading', () => {
  assert.equal(showCourseDoorHeading({ lessonCount: 1, groupCount: 1 }), false)
  assert.equal(showCourseDoorHeading({ lessonCount: 2, groupCount: 1 }), true)
})

test('a dua series does not sit under a lone Qadar heading', () => {
  const door = DOORS.find((row) => row.number === 15)!
  assert.equal(
    courseDoorHeadingVisible(
      [
        {
          door,
          items: [
            { title: 'Dua 1: O Allah, I am Your Servant | Prophetic Dua' },
            { title: 'Dua 2: Guidance' },
          ],
        },
      ],
      'Prophetic Duas',
    ),
    false,
  )
  assert.equal(
    courseDoorHeadingVisible(
      [{ door: DOORS.find((row) => row.number === 5)!, items: [{ title: 'Establish the prayer' }, { title: 'Fajr' }] }],
      'Prayer',
    ),
    true,
  )
})
