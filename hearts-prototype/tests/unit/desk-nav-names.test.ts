import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('../../src/screens/desk/shell.tsx', import.meta.url), 'utf8')

function slice(start: string, end: string) {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  assert.ok(from >= 0 && to > from, `${start} .. ${end}`)
  return source.slice(from, to)
}

function labels(block: string) {
  return [...block.matchAll(/label: '([^']+)'/g)].map((match) => match[1])
}

function duplicates(names: string[]) {
  const seen = new Map<string, number>()
  for (const label of names) seen.set(label, (seen.get(label) || 0) + 1)
  return [...seen.entries()].filter(([, count]) => count > 1).map(([label]) => label)
}

test('no desk nav shares a name, and the calendar and the two lives are distinct', () => {
  const teach = ['Overview', ...labels(slice('const teach: NavItem[]', "if (user.role === 'teacher')"))]
  const portal = labels(slice("description: 'Who is here, and notes they will see.'", 'export function masterNav'))
  const master = labels(slice('export function masterNav', 'export async function DeskFrame'))

  assert.deepEqual(duplicates(teach), [])
  assert.deepEqual(duplicates(portal), [])
  assert.deepEqual(duplicates(master), [])

  for (const names of [master, portal, teach]) {
    assert.equal(names.includes('Live recordings'), true)
    assert.equal(names.includes('Live in person'), true)
    assert.equal(names.includes('Live'), false)
    assert.equal(names.includes('Go live'), false)
    assert.equal(names.includes('Nights'), false)
  }
  assert.equal(master.includes('Event Calendar'), true)
  assert.equal(portal.includes('Event Calendar'), true)
  assert.equal(master.includes('Calendar'), false)
  assert.equal(portal.includes('Calendar'), false)
  assert.equal(teach.includes('Event Calendar'), false)
  // People, Teaching and Look closer stay, with the purpose lines from the grouped nav.
  for (const group of ['People', 'Teaching', 'Look closer']) assert.match(source, new RegExp(`group: '${group}'`))
  assert.equal(source.includes("group: 'Beginner'"), false)
  assert.equal(source.includes("group: 'Intermediate'"), false)
  assert.match(source, /Who is here, and notes they will see\./)
  assert.match(source, /Courses, study plans, gatherings, live video, and Scenes and Lanes\./)
  assert.match(source, /Insights, Compass, the calendar, and how the words are set up\./)
  assert.match(source, /Courses, live video, nights, and Scenes and Lanes\./)
  // Gatherings is its own page. It does not take the Live in person name.
  assert.equal(portal.filter((label) => label === 'Gatherings').length, 1)
  assert.equal(teach.filter((label) => label === 'Gatherings').length, 1)
})
