import assert from 'node:assert/strict'
import test from 'node:test'
import { BOOK_SWARM } from './book-swarm'
import { isHandwrittenAnswer } from './demo-workbook'
import { SWARM_PARENTS } from './swarm-plan'

test('Raising calm, happy children keeps handwritten lines, with no repeated person', () => {
  const names = BOOK_SWARM.flatMap((film) => film.others.map((row) => row.name))
  const bodies = BOOK_SWARM.flatMap((film) => film.others.map((row) => row.body))
  const reserved = new Set<string>(SWARM_PARENTS.map((parent) => parent.name))
  const whole = BOOK_SWARM.filter((film) => film.title.startsWith('The Whole-Brain Child'))
  const danish = BOOK_SWARM.filter((film) => film.title.startsWith('The Danish Way of Parenting'))
  assert.equal(whole.length, 6)
  assert.equal(danish.length, 7)
  assert.ok(names.length >= 60)
  assert.equal(new Set(names).size, names.length)
  assert.ok(names.every((name) => !reserved.has(name)))
  assert.equal(new Set(bodies.map((body) => body.toLowerCase())).size, bodies.length)
  assert.ok(bodies.every((body) => body.length > 80 && isHandwrittenAnswer(body)))
  assert.ok(BOOK_SWARM.every((film) => film.others.length >= 4 && film.others.length <= 8))
  assert.ok(BOOK_SWARM.every((film) => film.prompt.trim().toLowerCase() !== 'n/a'))
})
