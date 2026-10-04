import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DOORS, capitalAfterColon, doorCode, doorFromPath, doorLabel, doorOfClause, groupByDoor } from './doors'

const SPEC: [string, number[]][] = [
  ['W1', [1]],
  ['W2', [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
  ['W3', [13, 19, 20]],
  ['W4', [14]],
  ['W5', [15]],
  ['W6', [16]],
  ['W7', [17]],
  ['W8', [18]],
  ['W9', [21, 28]],
  ['W10', [22]],
  ['W11', [23]],
  ['W12', [24]],
  ['W13', [25]],
  ['W14', [26]],
  ['W15', [27]],
  ['W16', [29, 30, 31]],
  ['W17', [32, 33]],
  ['W18', [34, 35]],
  ['W19', [36, 37, 38, 39, 40]],
  ['W20', [41]],
]

test('the working doors are W1 to W20, each with a short teaching, and cover every clause once', () => {
  assert.equal(DOORS.length, 20)
  assert.deepEqual(DOORS.map((door) => doorCode(door.number)), SPEC.map(([code]) => code))
  SPEC.forEach(([code, clauses], index) => {
    assert.deepEqual(DOORS[index].clauses, clauses, code)
    assert.ok((DOORS[index].teaching || '').length > 8, `${code} has a teaching`)
    assert.equal(/clause|41/i.test(`${DOORS[index].title} ${DOORS[index].teaching}`), false)
  })
  const seen = new Map<number, string>()
  for (const door of DOORS) {
    for (const clause of door.clauses) {
      assert.equal(seen.has(clause), false, `clause ${clause} is on two doors`)
      seen.set(clause, doorCode(door.number))
      assert.equal(doorOfClause(clause)?.number, door.number)
    }
  }
  assert.equal(seen.size, 41)
  assert.equal(doorLabel(doorOfClause(22)!), 'W10 · Believe in Allah')
  assert.equal(doorLabel(DOORS[15]), 'W16 · Ihsan: Worship as though you see Him')
  assert.equal(capitalAfterColon('The Hour: when, and what cannot be known'), 'The Hour: When, and what cannot be known')
})

test('learner paths open a door by number or code, and an old clause number above 20 opens that clause’s door', () => {
  assert.equal(doorFromPath('w10')?.title, 'Believe in Allah')
  assert.equal(doorFromPath('W3')?.clauses.join(','), '13,19,20')
  assert.equal(doorFromPath('10')?.number, 10)
  assert.equal(doorFromPath('22')?.number, 10)
  assert.equal(doorFromPath('41')?.number, 20)
  assert.equal(doorFromPath('w21'), null)
  assert.equal(doorFromPath('42'), null)
  assert.equal(doorFromPath('clause'), null)
})

test('course parts group by door, with anything untagged after the doors', () => {
  const groups = groupByDoor(
    [
      { id: 1, clause: 22 },
      { id: 2, clause: 15 },
      { id: 3, clause: null },
      { id: 4, clause: 3 },
    ],
    (item) => doorOfClause(item.clause),
  )
  assert.deepEqual(groups.map((group) => [group.door ? doorCode(group.door.number) : 'open', group.items.map((item) => item.id)]), [
    ['W2', [4]],
    ['W5', [2]],
    ['W10', [1]],
    ['open', [3]],
  ])
})
