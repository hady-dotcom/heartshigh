import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DRAFT_FOLLOW_UPS } from './draft-prompt'
import { initialsOf } from './swarm-sort'
import { answersForPoint, circleFillProblems, CIRCLE_PEOPLE, starterAnswers } from './circle-fill'
import { circleDemoGuard, draftsForGap } from './circle-apply'
import { FILMS } from '../seed/films'
import { foldPlacingPrompt, PLACING_BANK, PLACING_DEFAULT, PLACING_EXTRA } from './placing-bank'

test('starter films still have four to six handwritten answers, shown as initials', () => {
  for (const film of FILMS) {
    for (const point of film.points) {
      const drafts = answersForPoint({ prompt: point.prompt, kind: point.kind, options: point.options })
      assert.equal(starterAnswers({ prompt: point.prompt, kind: point.kind })?.length, drafts.length)
      assert.deepEqual(circleFillProblems(drafts), [], point.prompt)
      for (const draft of drafts) {
        assert.match(draft.name, / /, `${draft.name} should be two words so the swarm can show initials`)
        assert.equal(initialsOf(draft.name).length, 2)
      }
    }
  }
})

test('starter-map follow-ups and the timed-learners question have a real voice, not a hook template', () => {
  const prompts = [
    ...DRAFT_FOLLOW_UPS.map((follow, index) => (index % 2 === 0 ? `He said: “Be gentle with people.” ${follow}` : `“Be gentle with people.” ${follow}`)),
    'What will you carry from this sitting into tomorrow?',
  ]
  for (const prompt of prompts) {
    const drafts = answersForPoint({ prompt, kind: 'reflection' })
    assert.deepEqual(circleFillProblems(drafts), [], prompt)
    assert.ok(drafts.length >= 4)
    assert.ok(!drafts.some((row) => /on [a-z]+ [a-z]+, I keep coming back/i.test(row.body)), prompt)
  }
})

test('unknown questions still get five distinct human answers that pass the voice checks', () => {
  const prompts = [
    'What would you hold from the bit about neighbours?',
    'How did that land on your walk home?',
    'What will you try after isha tonight?',
  ]
  for (const [index, prompt] of prompts.entries()) {
    const drafts = answersForPoint({ prompt, kind: 'reflection' })
    assert.deepEqual(circleFillProblems(drafts), [], prompt)
    const other = answersForPoint({ prompt: prompts[(index + 1) % prompts.length], kind: 'reflection' })
    assert.notDeepEqual(drafts.map((row) => row.body), other.map((row) => row.body))
  }
})

test('a question that already has four circle answers is left alone', () => {
  assert.deepEqual(draftsForGap({ id: 1, prompt: 'What will you carry from this sitting into tomorrow?', kind: 'reflection' }, 4), [])
  assert.equal(draftsForGap({ id: 1, prompt: 'What will you carry from this sitting into tomorrow?', kind: 'reflection' }, 0).length, 5)
  assert.equal(draftsForGap({ id: 2, prompt: 'x', kind: 'reflection', family: 'workbook' }, 0).length, 0)
})

test('circle demo apply refuses production unless HEARTS_DEMO=1', () => {
  assert.match(circleDemoGuard({ NODE_ENV: 'production', DATABASE_URL: 'postgres://db.example/hearts' }) || '', /production or remote/)
  assert.equal(circleDemoGuard({ NODE_ENV: 'production', HEARTS_DEMO: '1' }), null)
  assert.equal(circleDemoGuard({ NODE_ENV: 'test' }), null)
})

test('the joining bank keeps the four default questions and a richer extra set', () => {
  assert.equal(PLACING_DEFAULT.length, 4)
  assert.ok(PLACING_EXTRA.length >= 6)
  assert.equal(new Set(PLACING_BANK.map((row) => row.key)).size, PLACING_BANK.length)
  assert.equal(new Set(PLACING_BANK.map((row) => foldPlacingPrompt(row.prompt))).size, PLACING_BANK.length)
  for (const row of PLACING_BANK) {
    assert.ok(row.options.length >= 2, row.key)
    assert.ok(row.options.every((option) => /\|\s*\d+$/.test(option)), row.key)
  }
})

test('circle people names are initials-ready and not on the kill list', () => {
  assert.ok(CIRCLE_PEOPLE.length >= 8)
  for (const name of CIRCLE_PEOPLE) assert.equal(initialsOf(name).length, 2)
})
