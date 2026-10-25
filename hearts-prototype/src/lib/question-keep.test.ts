import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchQuestions, questionKey } from './question-keep'

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

test('a blank question does not inherit someone else’s answer', () => {
  const plan = matchQuestions([{ id: 1, prompt: '   ' }], [''])
  assert.deepEqual(plan.kept, [])
  assert.deepEqual(plan.dropped, [1])
})
