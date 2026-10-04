import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { DOORS, DOOR_SECTIONS, clauseForDoor, doorCode, doorLabel, doorNumberOfClause, doorsFromRows, parseDoor } from '../../src/lib/doors'
import { normaliseOption, parseOption, recommendLesson, startingClause } from '../../src/lib/placing'

test('the 20 doors cover all 41 clauses exactly once, in order, as Leon mapped them', () => {
  assert.equal(DOORS.length, 20)
  assert.deepEqual(DOORS.map((door) => door.number), Array.from({ length: 20 }, (_, index) => index + 1))
  const clauses = DOORS.flatMap((door) => door.clauses)
  assert.equal(clauses.length, 41)
  assert.deepEqual([...clauses].sort((a, b) => a - b), Array.from({ length: 41 }, (_, index) => index + 1))
  for (const door of DOORS) assert.ok((DOOR_SECTIONS as readonly string[]).includes(door.section))
  assert.deepEqual(DOORS.filter((door) => door.section === 'Islam').map((door) => door.number), [3, 4, 5, 6, 7, 8])
  assert.deepEqual(DOORS.filter((door) => door.section === 'Trunk').map((door) => door.number), [19, 20])
})

test('the mapping matches the working-doors file line for line', () => {
  const file = path.resolve(process.cwd(), 'content/jibril-doors.md')
  const lines = readFileSync(file, 'utf8').split('\n').filter((line) => /^- \*\*W\d+\*\*/.test(line.trim()))
  assert.equal(lines.length, 20)
  for (const line of lines) {
    const match = line.trim().match(/^- \*\*W(\d+)\*\* · (\w+) · (.+?) ← clauses ([\d, ]+)$/)
    assert.ok(match, line)
    const door = DOORS.find((row) => row.number === Number(match![1]))!
    assert.equal(door.section, match![2], `W${door.number} section`)
    assert.deepEqual(door.clauses, match![4].split(',').map((n) => Number(n.trim())), `W${door.number} clauses`)
  }
})

test('a talk’s door comes from its clause', () => {
  assert.equal(doorNumberOfClause(1), 1)
  assert.equal(doorNumberOfClause(7), 2)
  assert.equal(doorNumberOfClause(19), 3)
  assert.equal(doorNumberOfClause(22), 10)
  assert.equal(doorNumberOfClause(28), 9)
  assert.equal(doorNumberOfClause(31), 16)
  assert.equal(doorNumberOfClause(38), 19)
  assert.equal(doorNumberOfClause(41), 20)
  assert.equal(doorNumberOfClause(0), null)
  assert.equal(doorNumberOfClause(42), null)
  assert.equal(doorNumberOfClause(null), null)
  assert.equal(doorCode(3), 'W3')
  assert.equal(doorLabel(DOORS[2]), 'W3 · About Islam')
})

test('a door is read as W3, w3, Door 3 or 3, and nothing out of range', () => {
  for (const raw of ['W3', 'w3', ' W 3 ', 'Door 3', '3', 3]) assert.equal(parseDoor(raw), 3, String(raw))
  for (const raw of ['W0', 'W21', '21', 'X3', 'W3.1', '', null]) assert.equal(parseDoor(raw), null, String(raw))
})

test('a door alone keeps a clause already in it, or takes its first clause', () => {
  assert.equal(clauseForDoor(3, null), 13)
  assert.equal(clauseForDoor(3, 19), 19)
  assert.equal(clauseForDoor(3, 22), 13)
  assert.equal(clauseForDoor(2, 9), 9)
  assert.equal(clauseForDoor(21, null), null)
})

test('stored doors are used when they cover every clause; otherwise the built-in map', () => {
  const stored = DOORS.map((door) => ({ ...door, title: door.number === 5 ? 'The prayer' : door.title }))
  assert.equal(doorsFromRows(stored)[4].title, 'The prayer')
  assert.equal(doorsFromRows([]), DOORS)
  assert.equal(doorsFromRows(stored.slice(0, 19)), DOORS)
})

test('placing votes in doors: two answers in the Sitting outvote one elsewhere, and the clause stored is the first voted', () => {
  const q1 = ['The Prophet | 3', 'Prayer | 15']
  const q2 = ['The people I look after | 4', 'Prayer | 15']
  const q3 = ['Prayer | 15', 'Calm | 2']
  assert.equal(startingClause([{ options: q1, choice: 'The Prophet' }, { options: q2, choice: 'The people I look after' }, { options: q3, choice: 'Prayer' }]), 3)
  assert.equal(startingClause([{ options: q1, choice: 'Prayer' }, { options: q2, choice: 'The people I look after' }, { options: q3, choice: 'Calm' }]), 4)
})

test('a placing answer may name a door, and is saved as that door’s clause', () => {
  assert.deepEqual(parseOption('With prayer | W5'), { label: 'With prayer', clause: 15 })
  assert.deepEqual(parseOption('About Islam | w3'), { label: 'About Islam', clause: 13 })
  assert.deepEqual(parseOption('Nowhere | W21'), { label: 'Nowhere', clause: null })
  assert.equal(normaliseOption('With prayer | W5'), 'With prayer | 15')
  assert.equal(normaliseOption('With prayer | 15'), 'With prayer | 15')
  assert.equal(normaliseOption('Just words'), 'Just words')
})

test('the first course follows the starting door, not only the exact clause', () => {
  const cuts = [
    { lessonId: 1, bestClause: 41, approved: true },
    { lessonId: 2, bestClause: 7, approved: true },
    { lessonId: 3, bestClause: 22, approved: true },
  ]
  assert.equal(recommendLesson(3, cuts, [1, 2, 3]), 2, 'clause 3 and clause 7 share door 2')
  assert.equal(recommendLesson(22, cuts, [1, 2, 3]), 3)
  assert.equal(recommendLesson(30, cuts, [1, 2, 3]), 1, 'nothing in door 16 falls back to the first lesson')
})
