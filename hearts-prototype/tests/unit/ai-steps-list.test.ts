import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aiStepsListArgs, classifyAiStepsGet } from '../../src/lib/ai-steps-list'

test('a job poll stays a job poll', () => {
  assert.deepEqual(classifyAiStepsGet('?job=12'), { kind: 'job', jobId: 12 })
  assert.deepEqual(classifyAiStepsGet('?job='), { kind: 'job', jobId: 0 })
  assert.deepEqual(classifyAiStepsGet(''), { kind: 'bare' })
})

test('the versions list relationship query is a collection list, not a missing job', () => {
  const search = '?depth=0&draft=true&limit=250&where[id][in]=4,9&locale=en'
  assert.equal(classifyAiStepsGet(search).kind, 'list')
  const args = aiStepsListArgs(search)
  assert.equal(args.depth, 0)
  assert.equal(args.draft, true)
  assert.equal(args.limit, 250)
  assert.equal(args.locale, 'en')
  assert.deepEqual(args.where, { id: { in: '4,9' } })
})

test('a depth and limit list query is read as a list and capped', () => {
  const search = '?depth=1&limit=10'
  assert.equal(classifyAiStepsGet(search).kind, 'list')
  const args = aiStepsListArgs('?depth=4&limit=9999')
  assert.equal(args.depth, 2)
  assert.equal(args.limit, 250)
})
