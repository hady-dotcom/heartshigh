import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadRealAnswers } from './parent-feedback'
import { isBlankPrompt, isRealAnswerBody, planQuestionSwarm, questionsMatch, SWARM_PARENTS } from './swarm-plan'

test('2021 answers follow the question text, not the old video number', () => {
  const prompt = 'What will you try this week with the morning routine?'
  const planned = planQuestionSwarm({
    prompt,
    real: [
      { question: prompt, text: 'Shorter maths. The rest can wait.' },
      { question: 'A completely different question about bedtime battles and screens', text: 'This one should not show up here at all.' },
    ],
  })
  assert.ok(planned.some((row) => row.body.startsWith('Shorter maths')))
  assert.equal(planned.some((row) => row.body.includes('bedtime')), false)
  assert.equal(planned.length, 1)
  assert.ok(planned.every((row) => row.source === 'real'))
  assert.ok(planned.every((row) => SWARM_PARENTS.some((parent) => parent.name === row.name)))
  assert.equal(new Set(planned.map((row) => row.email)).size, planned.length)
  assert.ok(planned.every((row) => !row.body.includes('\u2014') && !/certainly|it is important to|as an ai/i.test(row.body)))
})

test('a film with no 2021 answer is left empty', () => {
  const planned = planQuestionSwarm({ prompt: 'List the 9 types of intelligence.', real: [] })
  assert.equal(planned.length, 0)
  assert.equal(isBlankPrompt('N/A'), true)
  assert.equal(planQuestionSwarm({ prompt: 'N/A', real: [] }).length, 0)
})

test('the committed 2021 sheet matches current questions by wording', () => {
  const real = loadRealAnswers()
  const sample = real.find((row) => row.text.length > 40)
  assert.ok(sample)
  assert.equal(questionsMatch(sample!.question, `  ${sample!.question}  `), true)
  assert.equal(questionsMatch(sample!.question, 'How was your weekend?'), false)
  assert.equal(isRealAnswerBody(sample!.text, [sample!.text]), true)
  assert.equal(isRealAnswerBody('Gave it about 14 minutes, which is our usual limit. agree claim parents more did not stick.', [sample!.text]), false)
  assert.equal(isRealAnswerBody('  ' + sample!.text + '  ', [sample!.text]), true)
})
