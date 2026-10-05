import assert from 'node:assert/strict'
import { test } from 'node:test'
import { screenAnswer } from './answer-moderation'

test('a plain answer is shown', () => {
  const result = screenAnswer('I started praying Fajr this week and it felt quieter.')
  assert.equal(result.show, true)
})

test('harmful words are held for review', () => {
  const result = screenAnswer('You should kill yourself.')
  assert.equal(result.show, false)
  assert.match(result.reason, /review/)
})
