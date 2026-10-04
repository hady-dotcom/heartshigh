import assert from 'node:assert/strict'
import test from 'node:test'
import { DOORS } from './doors'
import { countLine, describeGroups, groupCourses, seatLabel, seatName, subsetGroups, type CutPlacement, type SeatInfo } from './curriculum-groups'

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
  assert.equal(groups[0].seats[0].label, 'Seat 1 · The Prayer')
  assert.equal(groups[0].seats[0].note, 'Vol. 1 the prayer, the short grain.')
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
  assert.equal(seatLabel({ position: 2, text: long }), 'Seat 2 · Five Daily Prayers in Full, Pages 110 to 238')
  assert.equal(seatName('Vol. 3 Friday 295–325, a known hour in a known week. Later grain of the same trust'), 'Friday')
  assert.equal(seatName('Vol. 1 visiting Medina and the tomb (end of the hajj book, inside 26–52)'), 'Visiting Medina and the Tomb')
  assert.equal(seatName('Vol. 1 Ch. 4: follow the Sunna; respect due to his wives'), 'Follow the Sunna')
  assert.equal(seatName('Vol. 5 ḥusn al-khuluq 126–131, character as how you attend to someone'), 'Ḥusn al-Khuluq')
  assert.equal(seatName('Vol. 4 qasr, combining, jumua 239–301, distance, travel, and where the body is'), 'Qasr, Combining, Jumua')
  assert.equal(seatName('Sidq of creed in Ch. 4'), 'Sidq of Creed')
  assert.equal(seatName('Unit 33 again: limits on how we talk. Do not force a signs chapter'), 'Unit 33 Again: Limits on How We Talk')
  const wordy = seatLabel({ position: 1, text: 'Vol. 1 wudu 10+10 and prayer essentials, including qibla: the actual Kaaba if you are in Mecca and the direction elsewhere' })
  assert.match(wordy, /^Seat 1 · Wudu and Prayer Essentials, Including Qibla: The Actual…$/)
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
