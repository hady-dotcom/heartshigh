import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isHandwrittenAnswer, WORKBOOK_FILMS, workbookParentEmail } from './demo-workbook'

test('the first ten films each have a real question and a handful of different parent lines', () => {
  assert.equal(WORKBOOK_FILMS.length, 10)
  const bodies = WORKBOOK_FILMS.flatMap((film) => film.others.map((row) => row.body))
  const names = new Set(WORKBOOK_FILMS.flatMap((film) => film.others.map((row) => row.name)))
  assert.equal(new Set(bodies).size, bodies.length)
  assert.ok(names.size >= 25)
  for (const film of WORKBOOK_FILMS) {
    assert.ok(film.prompt.length > 20)
    assert.ok(film.vimeoId)
    assert.ok(film.others.length >= 4 && film.others.length <= 8)
    assert.equal(new Set(film.others.map((row) => row.name)).size, film.others.length)
    for (const row of film.others) {
      const sentences = row.body.split(/(?<=[.!?])\s+/).filter(Boolean)
      assert.ok(sentences.length >= 1 && sentences.length <= 4)
      assert.equal(row.body.includes('\u2014'), false)
      assert.equal(/gave it about \d+ minutes|did not stick|agree claim/i.test(row.body), false)
      assert.equal(isHandwrittenAnswer(row.body), true)
    }
  }
  assert.equal(workbookParentEmail('James O\'Brien'), 'james.o.brien@hady.home')
  assert.equal(isHandwrittenAnswer('Gave it about 14 minutes, which is our usual limit.'), false)
})
