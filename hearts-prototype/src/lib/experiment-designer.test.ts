import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LlmClient } from './llm'
import { DESIGN_DAYS, DESIGNER_SYSTEM_PROMPT, designExperiment, parseDesignerReply, presetFromGoal, setupFromGoal } from './experiment-designer'
import { payloadProblems } from './experiment-slots'

test('a goal with no AI maps to a preset by keyword', () => {
  assert.equal(presetFromGoal('the invitation into the whole talk').key, 'whole-talk')
  assert.equal(presetFromGoal('people cannot find the courses tab').key, 'courses-tab')
  assert.equal(presetFromGoal('the button under a short clip').key, 'clip-button')
  assert.equal(presetFromGoal('reminder time is easy to miss').key, 'clip-button')
  const setup = setupFromGoal('Watch the whole talk feels buried', 'East London')
  assert.equal(setup.source, 'preset')
  assert.equal(setup.slot, 'full-talk-cta-label')
  assert.equal(setup.minimumSample, 100)
  assert.equal(setup.durationDays, DESIGN_DAYS)
  assert.equal(setup.durationDays, 28)
  assert.equal(setup.who, 'Learners in East London')
  assert.match(setup.method, /Thompson-sampling/)
  assert.match(setup.method, /4 weeks/)
  assert.equal(setup.explanation.split(/(?<=[.!?])\s+/).length, 2)
  for (const version of setup.versions) assert.deepEqual(payloadProblems(setup.slot, version.payload), [])
})

test('care in the goal picks care alerts, and other goals watch drop-offs', () => {
  assert.equal(setupFromGoal('care alerts after a clip').safetyMetric, 'care_alert')
  assert.equal(setupFromGoal('the lanes tab').safetyMetric, 'drop_off')
})

test('the portal designer uses the system prompt and keeps a safe setup', async () => {
  let system = ''
  const client: LlmClient = {
    name: 'portal',
    async complete(request) {
      system = request.system
      return [
        'People may stay if the button under a clip is clearer.',
        'This only changes that button, never the talk itself.',
        JSON.stringify({
          slot: 'feed-cta-label',
          name: 'Clearer clip button',
          who: 'Learners in East London',
          minimumSample: 40,
          decidingMetric: 'clip_cta_tap',
          safetyMetric: 'care alerts',
          versions: [
            { key: 'ready', label: 'Ready for more?' },
            { key: 'stay', label: 'Stay with this' },
            { key: 'hear', label: 'Hear a little more' },
          ],
        }),
      ].join(' ')
    },
  }
  const setup = await designExperiment('people leave after a short clip', { client, portalName: 'East London' })
  assert.equal(system, DESIGNER_SYSTEM_PROMPT)
  assert.equal(setup.source, 'portal-ai')
  assert.equal(setup.versions.length, 3)
  assert.equal(setup.safetyMetric, 'care_alert')
  assert.equal(setup.minimumSample, 100)
  assert.equal(setup.durationDays, 28)
  assert.equal(setup.decidingMetric, 'clip_cta_tap')
  assert.match(setup.explanation, /button under a clip/)
  assert.equal(setup.explanation.split(/(?<=[.!?])\s+/).filter(Boolean).length, 2)
})

test('a reply that would change a sheikh’s words falls back to a preset', async () => {
  const client: LlmClient = {
    name: 'portal',
    async complete() {
      return JSON.stringify({
        slot: 'feed-cta-label',
        versions: [
          { key: 'a', label: 'A', payload: { transcript: 'rewritten words', label: 'A' } },
          { key: 'b', label: 'B', payload: { label: 'B' } },
        ],
      })
    },
  }
  const setup = await designExperiment('the invitation into the whole talk', { client, portalName: 'East London' })
  assert.equal(setup.source, 'preset')
  assert.equal(setup.slot, 'full-talk-cta-label')
  assert.equal(parseDesignerReply('{"slot":"not-a-slot"}', 'clip button'), null)
})

test('with no client the designer never calls a model', async () => {
  const setup = await designExperiment('explore on the courses tab')
  assert.equal(setup.source, 'preset')
  assert.equal(setup.slot, 'lanes-tab-label')
})
