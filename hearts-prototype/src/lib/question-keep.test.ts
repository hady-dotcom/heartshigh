import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calloutsDiffer, matchQuestions, questionKey } from './question-keep'

test('unchanged question text keeps its id, and a rewritten question does not', () => {
  const existing = [
    { id: 4, prompt: 'How would you describe your experience of home learning so far?' },
    { id: 9, prompt: 'What will you try this week?' },
  ]
  const plan = matchQuestions(existing, [
    'How would you describe your experience of home learning so far?',
    'What will you try tomorrow?',
  ])
  assert.deepEqual(plan.kept, [{ id: 4, prompt: 'How would you describe your experience of home learning so far?' }])
  assert.deepEqual(plan.fresh, ['What will you try tomorrow?'])
  assert.deepEqual(plan.dropped, [9])
  assert.equal(questionKey('  same   line '), 'same line')
})

test('a split callout does not match the sheet’s one question', () => {
  const sheet = [{ prompt: 'Describe two ways in which you can stimulate interest in students? (200 words)', second: 218, kind: 'question' }]
  const split = [
    sheet[0],
    { prompt: 'Consider how you would create an environment to allow your learners to practice skills learnt? (200 words)', second: 368, kind: 'question' },
  ]
  assert.equal(calloutsDiffer(split, sheet), true)
  assert.equal(calloutsDiffer(sheet, sheet), false)
})

test('a blank question does not inherit someone else’s answer', () => {
  const plan = matchQuestions([{ id: 1, prompt: '   ' }], [''])
  assert.deepEqual(plan.kept, [])
  assert.deepEqual(plan.dropped, [1])
})
