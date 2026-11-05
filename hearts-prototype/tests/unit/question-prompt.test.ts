import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shownQuestionPrompt, tidyQuestionPrompt, usableQuestionPrompt } from '../../src/lib/question-prompt'

test('a garbled ASR quote keeps only the real question', () => {
  const raw = 'He said: “We will be landing in a shape on the Ragini Anessa stated you accessing I seek refuge protection with Allah from shaytan the accursed” What from that stayed with you on the way home?'
  assert.equal(tidyQuestionPrompt(raw), 'What from that stayed with you on the way home?')
  assert.equal(usableQuestionPrompt('landing in a shape on the Ragini'), false)
  assert.equal(tidyQuestionPrompt('What stayed with you?'), 'What stayed with you?')
  const book = 'Do you agree with the claim that parents are more knowledgeable about their children’s bodies than about their brain? If yes, why do you think this happens?'
  assert.equal(tidyQuestionPrompt(book), book)
})

test('a sheet question keeps its lead-in, and HEARTS still names a blank one', () => {
  const sheet = 'After watching the video, what information did you find most interesting and why?'
  assert.equal(shownQuestionPrompt(sheet, { sheet: true }), sheet)
  assert.equal(shownQuestionPrompt('Upload a video of your home learning space.', { sheet: true }), 'Upload a video of your home learning space.')
  assert.equal(shownQuestionPrompt('Upload a video of your home learning space.', { sheet: false, index: 0 }), 'Question 1')
  assert.equal(shownQuestionPrompt(sheet, { sheet: false }), 'what information did you find most interesting and why?')
})
