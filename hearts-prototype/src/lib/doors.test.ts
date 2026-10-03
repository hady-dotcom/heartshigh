import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DOORS, doorForClause, doorFromPath, doorLabel, groupByDoor, parseImportedClause } from './doors'

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

test('the working doors are W1 to W20 and cover every clause once', () => {
  assert.equal(DOORS.length, 20)
  assert.deepEqual(DOORS.map((door) => door.code), SPEC.map(([code]) => code))
  assert.deepEqual(DOORS.map((door) => door.order), SPEC.map((_, index) => index + 1))
  SPEC.forEach(([code, clauses], index) => {
    assert.deepEqual(DOORS[index].clauses, clauses, code)
    assert.ok(DOORS[index].name.length > 1)
    assert.ok(DOORS[index].teaching.length > 8)
    assert.equal(/clause|41/i.test(`${DOORS[index].name} ${DOORS[index].teaching}`), false)
  })
  const seen = new Map<number, string>()
  for (const door of DOORS) {
    for (const clause of door.clauses) {
      assert.equal(seen.has(clause), false, `clause ${clause} is on two doors`)
      seen.set(clause, door.code)
      assert.equal(doorForClause(clause)?.code, door.code)
    }
  }
  assert.equal(seen.size, 41)
  for (let clause = 1; clause <= 41; clause += 1) assert.equal(seen.has(clause), true, `clause ${clause} has no door`)
})

test('an imported clause number resolves to its door, and a door code does not', () => {
  assert.equal(parseImportedClause('15')?.door.code, 'W5')
  assert.equal(parseImportedClause(' 41 ')?.door.code, 'W20')
  assert.equal(parseImportedClause('3')?.clause, 3)
  assert.equal(parseImportedClause('3')?.door.code, 'W2')
  assert.equal(parseImportedClause('0'), null)
  assert.equal(parseImportedClause('42'), null)
  assert.equal(parseImportedClause('W5'), null)
  assert.equal(parseImportedClause(''), null)
  assert.equal(doorLabel(parseImportedClause('22')!.door), 'W10 · Believe in Allah')
})

test('learner paths open a door, and an old clause number opens that clause’s door', () => {
  assert.equal(doorFromPath('w10')?.name, 'Believe in Allah')
  assert.equal(doorFromPath('W3')?.clauses.join(','), '13,19,20')
  assert.equal(doorFromPath('22')?.code, 'W10')
  assert.equal(doorFromPath('3')?.code, 'W2')
  assert.equal(doorFromPath('w21'), null)
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
    (item) => doorForClause(item.clause),
  )
  assert.deepEqual(groups.map((group) => [group.door?.code || 'open', group.items.map((item) => item.id)]), [
    ['W2', [4]],
    ['W5', [2]],
    ['W10', [1]],
    ['open', [3]],
  ])
})
