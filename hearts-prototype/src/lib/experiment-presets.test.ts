import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EXPERIMENT_PRESETS, experimentEndsAt, presetExperimentKey, presetOf, presetProblems } from './experiment-presets'
import { experimentDraftProblems } from './experiment-slots'

test('each preset is two approved wordings on a real slot, with auto split and 14 days', () => {
  assert.equal(EXPERIMENT_PRESETS.length, 3)
  for (const preset of EXPERIMENT_PRESETS) {
    assert.equal(presetProblems(preset).length, 0)
    assert.equal(preset.variants.length, 2)
    const key = presetExperimentKey(preset.key, 1_700_000_000_000)
    const problems = experimentDraftProblems({
      key,
      name: preset.name,
      slot: preset.slot,
      primaryMetric: preset.primaryMetric,
      allocation: 'auto',
      variants: preset.variants.map((row) => ({ ...row, weight: 1, approved: true, source: 'staff' })),
    })
    assert.deepEqual(problems, [])
    assert.equal(presetOf(preset.key)?.slot, preset.slot)
  }
})

test('a preset run ends fourteen days after it starts', () => {
  assert.equal(experimentEndsAt('2026-10-01T00:00:00.000Z', 14), '2026-10-15T00:00:00.000Z')
  assert.equal(experimentEndsAt(null, 14), null)
})
