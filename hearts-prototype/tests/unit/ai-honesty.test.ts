import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AI_OFF_NOTE,
  PRACTICE_DRAFT_LABEL,
  SEASONAL_APPROVAL,
  aiAccountLine,
  aiSpendIsOff,
  rerunScopes,
  tryOutputLabel,
} from '../../src/lib/ai-honesty'

test('the off note is the same plain sentence for a master and a portal with no AI', () => {
  assert.equal(AI_OFF_NOTE, 'AI is off. This runs the built-in practice draft, not AI.')
  assert.equal(aiSpendIsOff({ master: true, connected: false }), true)
  assert.equal(aiSpendIsOff({ master: true, connected: true }), true)
  assert.equal(aiSpendIsOff({ master: false, connected: false }), true)
  assert.equal(aiSpendIsOff({ connected: false }), true)
  assert.equal(aiSpendIsOff({ master: false, connected: true }), false)
})

test('a built-in compare result is labelled a practice draft, not a live model', () => {
  assert.equal(tryOutputLabel(true, 'draft'), PRACTICE_DRAFT_LABEL)
  assert.equal(tryOutputLabel(true, 'live'), PRACTICE_DRAFT_LABEL)
  assert.equal(PRACTICE_DRAFT_LABEL, 'practice draft (no AI)')
  assert.equal(tryOutputLabel(false, 'draft'), 'This draft')
  assert.equal(tryOutputLabel(false, 'live'), 'Live version')
})

test('the master desk hides Everything while no portal AI is connected', () => {
  const hidden = rerunScopes({ master: true, connected: false }).map((scope) => scope.label)
  assert.deepEqual(hidden, ['One talk', 'A selection', 'A course'])
  assert.equal(hidden.includes('Everything'), false)

  const portalOff = rerunScopes({ master: false, connected: false }).map((scope) => scope.value)
  assert.deepEqual(portalOff, ['talk', 'selection', 'course', 'all'])

  const portalOn = rerunScopes({ master: false, connected: true }).map((scope) => scope.value)
  assert.deepEqual(portalOn, ['talk', 'selection', 'course', 'all'])

  const masterOn = rerunScopes({ master: true, connected: true }).map((scope) => scope.label)
  assert.equal(masterOn.includes('Everything'), true)
})

test('calendar and portal pages say what is really happening', () => {
  assert.equal(SEASONAL_APPROVAL, 'Suggested lines need your approval. They never change a sheikh\u2019s words.')
  assert.equal(SEASONAL_APPROVAL.includes('AI drafts'), false)
  assert.equal(aiAccountLine(false), 'AI account: not connected (the portal admin connects it in Settings)')
  assert.equal(aiAccountLine(true), 'AI account: connected (the portal admin connects it in Settings)')
})
