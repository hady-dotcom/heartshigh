import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { screenAnswer } from './answer-moderation'

describe('answer screen', () => {
  it('lets an ordinary reflection through', () => {
    const result = screenAnswer('I sat with the talk and felt calmer.')
    assert.equal(result.show, true)
    assert.equal(result.atRisk, false)
  })

  it('holds unkind words for review, without saying flagged', () => {
    const result = screenAnswer('I will kill you')
    assert.equal(result.show, false)
    assert.equal(result.atRisk, false)
    assert.match(result.reason, /Hidden for review/)
    assert.doesNotMatch(result.reason, /flag/i)
  })

  it('marks self-harm and abuse as needing a person', () => {
    assert.equal(screenAnswer('I want to die tonight').atRisk, true)
    assert.equal(screenAnswer('someone touched me').atRisk, true)
    assert.equal(screenAnswer('I want to die tonight').show, false)
  })
})
