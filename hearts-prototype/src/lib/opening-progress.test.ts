import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openingStepLabel, openingStepTotal } from './opening-progress'

test('opening progress is opener plus each served scene', () => {
  assert.equal(openingStepTotal(7), 8)
  assert.equal(openingStepLabel(1, 7), '1 of 8')
  assert.equal(openingStepLabel(2, 7), '2 of 8')
  assert.equal(openingStepTotal(4), 5)
  assert.equal(openingStepLabel(1, 4), '1 of 5')
})
