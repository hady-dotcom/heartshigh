import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fillSampleGaps, parseSaidSheet, readSaidAnswers, saidForFilm } from './said-answers'

test('an answers sheet stays on the film it names', () => {
  const parsed = parseSaidSheet([
    'phase,video_order,question,answer',
    'Phase 1,1,"How is home learning?","A little messy, and that is fine"',
    'Sample,2,What will you try?,A sample line',
  ].join('\n'))
  assert.equal(parsed.error, undefined)
  assert.equal(parsed.rows.length, 2)
  assert.equal(parsed.rows[0].order, 1)
  assert.match(parsed.rows[0].label, /Phase 1/)
  assert.equal(parsed.rows[1].sample, true)
  assert.equal(parsed.rows[1].label, 'Sample answer')
  const kept = readSaidAnswers(parsed.rows)
  assert.equal(saidForFilm(kept, 1, 'How is home learning?')[0].text, 'A little messy, and that is fine')
  const filled = fillSampleGaps(kept.filter((row) => row.order === 1))
  assert.equal(filled.some((row) => row.order === 1 && row.sample), false)
  assert.equal(filled.some((row) => row.sample && row.order !== 1), true)
})
