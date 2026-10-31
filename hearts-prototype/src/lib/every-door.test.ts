import assert from 'node:assert/strict'
import test from 'node:test'
import { DOORS } from './doors'
import { withEveryDoor } from './every-door'
import type { DoorGroup } from './curriculum-groups'

function group(number: number, title: string): DoorGroup {
  return {
    key: `W${number}`,
    number,
    code: `W${number}`,
    title,
    heading: `W${number} · ${title}`,
    courses: [{ id: 1, title: 'A talk', summary: '', talkCount: 1, door: number, otherDoors: [], seatId: null }],
    seats: [],
    unseated: [],
    talkCount: 1,
  }
}

test('Content lists all twenty doors, keeping courses on the doors they already sit in', () => {
  const filled = withEveryDoor([group(5, 'Prayer'), group(7, 'Fasting')])
  assert.equal(filled.length, 20)
  assert.deepEqual(filled.map((row) => row.number), DOORS.map((door) => door.number))
  assert.equal(filled[4].courses[0].title, 'A talk')
  assert.equal(filled[0].courses.length, 0)
  assert.equal(filled[0].heading, 'Door 1 · One day')
})

test('unmapped courses stay after the twenty doors', () => {
  const other: DoorGroup = {
    key: 'other',
    number: null,
    code: 'Other',
    title: 'Other',
    heading: 'Other',
    courses: [],
    seats: [],
    unseated: [],
    talkCount: 0,
  }
  const filled = withEveryDoor([other])
  assert.equal(filled.length, 21)
  assert.equal(filled.at(-1)?.key, 'other')
})
