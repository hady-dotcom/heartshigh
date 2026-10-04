import assert from 'node:assert/strict'
import test from 'node:test'
import { DOORS } from './doors'
import { countLine, describeGroups, groupCourses, seatLabel, subsetGroups, type CutPlacement, type SeatInfo } from './curriculum-groups'

const seats: SeatInfo[] = [
  { id: 10, clause: 15, position: 1, text: 'Vol. 1 the prayer, the short grain.' },
  { id: 11, clause: 15, position: 2, text: 'Vol. 4 five daily prayers in full, pages 110 to 238, the long grain of the same act.' },
  { id: 12, clause: 17, position: 1, text: 'Vol. 4 year-fast.' },
]

function cut(lessonId: number, clause: number | null, seatId: number | null = null): CutPlacement {
  return { lessonId, clause, seatId }
}

test('a course sits in the door most of its talks belong to, and the rest are tags', () => {
  const groups = groupCourses(
    [{ id: 1, title: 'Prayer and a little fasting' }],
    [
      { id: 101, courseId: 1 },
      { id: 102, courseId: 1 },
      { id: 103, courseId: 1 },
      { id: 104, courseId: 1 },
    ],
    [cut(101, 15, 10), cut(102, 15, 10), cut(103, 15, 11), cut(104, 17, 12)],
    seats,
  )
  assert.equal(groups.length, 1)
  assert.equal(groups[0].code, 'W5')
  assert.equal(groups[0].heading, 'W5 · Prayer')
  assert.equal(groups[0].courses[0].door, 5)
  assert.deepEqual(groups[0].courses[0].otherDoors.map((door) => door.code), ['W7'])
  assert.equal(groups[0].courses[0].talkCount, 4)
  assert.equal(groups[0].seats.length, 1)
  assert.equal(groups[0].seats[0].id, 10)
  assert.match(groups[0].seats[0].label, /^Seat 1 · Vol\. 1 the prayer/)
  assert.equal(groups[0].unseated.length, 0)
})

test('a tie between doors goes to the earlier door', () => {
  const groups = groupCourses(
    [{ id: 2, title: 'Split evenly' }],
    [
      { id: 201, courseId: 2 },
      { id: 202, courseId: 2 },
    ],
    [cut(201, 15), cut(202, 22)],
    [],
  )
  const home = groups.find((group) => group.courses.some((course) => course.id === 2))
  assert.equal(home?.number, 5)
  assert.deepEqual(home?.courses[0].otherDoors.map((door) => door.number), [10])
  assert.equal(home?.unseated.length, 1)
  assert.equal(home?.seats.length, 0)
})

test('talks with no clause, and courses with none, gather under Other', () => {
  const groups = groupCourses(
    [
      { id: 3, title: 'Mapped' },
      { id: 4, title: 'Unmapped' },
    ],
    [
      { id: 301, courseId: 3 },
      { id: 401, courseId: 4 },
      { id: 402, courseId: 4 },
    ],
    [cut(301, 1), cut(401, null), cut(402, null)],
    [],
  )
  assert.equal(groups[0].code, 'W1')
  assert.equal(groups.at(-1)?.key, 'other')
  assert.equal(groups.at(-1)?.courses[0].id, 4)
  assert.equal(groups.at(-1)?.courses[0].talkCount, 2)
  assert.equal(describeGroups(groups), 'Across One day.')
})

test('a talk with cuts on several doors votes by its own majority', () => {
  const groups = groupCourses(
    [{ id: 5, title: 'One talk, three cuts' }],
    [{ id: 501, courseId: 5 }],
    [cut(501, 15), cut(501, 15), cut(501, 17)],
    [],
  )
  assert.equal(groups[0].number, 5)
  assert.equal(groups[0].courses[0].otherDoors.length, 0)
})

test('counts, seat labels and a written summary stay short', () => {
  assert.equal(countLine(138, 75), '138 talks · 75 courses')
  assert.equal(countLine(1, 1), '1 talk · 1 course')
  const long = 'Vol. 4 five daily prayers in full, pages 110 to 238, the long grain of the same act and then some more words.'
  assert.ok(seatLabel({ position: 2, text: long }).length < 90)
  assert.match(seatLabel({ position: 2, text: long }), /…$/)
  const groups = groupCourses([{ id: 1, title: 'Prayer' }], [{ id: 1, courseId: 1 }], [cut(1, 15)], [])
  assert.equal(describeGroups(groups, 'Fahmy and the two Names classes.'), 'Fahmy and the two Names classes.')
  assert.equal(describeGroups([]), 'Nothing in this pack yet.')
})

test('a subset keeps the door and drops empty headings', () => {
  const groups = groupCourses(
    [
      { id: 1, title: 'Prayer' },
      { id: 2, title: 'Fasting' },
    ],
    [
      { id: 11, courseId: 1 },
      { id: 21, courseId: 2 },
    ],
    [cut(11, 15, 10), cut(21, 17, 12)],
    seats,
  )
  const subset = subsetGroups(groups, new Set([2]))
  assert.equal(subset.length, 1)
  assert.equal(subset[0].code, 'W7')
  assert.equal(subset[0].courses[0].id, 2)
  assert.equal(subset[0].talkCount, 1)
})

test('the built-in doors are the ones the groups use', () => {
  assert.equal(DOORS.length, 20)
})
