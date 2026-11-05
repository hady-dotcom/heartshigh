import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DOORS, doorLabel } from '../../src/lib/doors'
import { eveningName } from '../../src/lib/evening-name'
import { giveCourseGroups } from '../../src/lib/give-course'
import { humanDate } from '../../src/lib/human-date'

test('a Jibril option does not repeat the door code', () => {
  const label = doorLabel(DOORS[0])
  assert.equal(label, 'W1 · One day')
  assert.doesNotMatch(label, /W1 · W1/)
  const screen = readFileSync(new URL('../../src/screens/desk/bring-in.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(screen, /doorCode\(door\.number\)\} · \{doorLabel/)
  assert.match(screen, /data-testid="bring-in-more"/)
  assert.match(screen, /publish when captions are ready/i)
  assert.match(screen, /defaultChecked/)
})

test('give-course search keeps doors grouped', () => {
  const groups = giveCourseGroups(
    [
      { id: 1, title: 'Prayer', door: 'W5 · Prayer' },
      { id: 2, title: 'Zakat', door: 'W6 · Zakat' },
      { id: 3, title: 'Night prayer', door: 'W5 · Prayer' },
    ],
    'pray',
  )
  assert.deepEqual(groups.map((group) => group.door), ['W5 · Prayer'])
  assert.deepEqual(groups[0].courses.map((course) => course.id), [1, 3])
})

test('a blank night is named Circle evening, and dates shown to admins are human', () => {
  assert.equal(eveningName(''), 'Circle evening')
  assert.equal(eveningName('  Harbour night  '), 'Harbour night')
  assert.equal(humanDate('2026-10-13T19:47:42.146Z'), '13 Oct')
  assert.equal(humanDate('not a date'), 'not a date')
})
