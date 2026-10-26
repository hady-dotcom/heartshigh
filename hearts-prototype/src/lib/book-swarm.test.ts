import assert from 'node:assert/strict'
import test from 'node:test'
import { BOOK_SWARM } from './book-swarm'
import { isHandwrittenAnswer } from './demo-workbook'

test('Raising calm, happy children starts with handwritten Whole-Brain Child lines', () => {
  const names = BOOK_SWARM.flatMap((film) => film.others.map((row) => row.name))
  const bodies = BOOK_SWARM.flatMap((film) => film.others.map((row) => row.body))
  assert.ok(BOOK_SWARM.every((film) => film.title.startsWith('The Whole-Brain Child')))
  assert.ok(names.length >= 25)
  assert.equal(new Set(names).size, names.length)
  assert.equal(new Set(bodies.map((body) => body.toLowerCase())).size, bodies.length)
  assert.ok(bodies.every((body) => body.length > 80 && isHandwrittenAnswer(body)))
  assert.ok(BOOK_SWARM.every((film) => film.others.length >= 4 && film.others.length <= 8))
})
