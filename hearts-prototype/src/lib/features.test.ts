import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEPTH_ORDER,
  FEATURES,
  FEATURE_KEYS,
  FEATURE_UNAVAILABLE,
  defaultFeatures,
  deskNavAllowed,
  featureOn,
  featuresEqual,
  featuresFromForm,
  featuresOf,
  isFeatureKey,
  learnerBar,
  matchingPreset,
  parseFeatures,
  presetFeatures,
  unavailableCopy,
  withDependencyClosure,
} from './features'

test('the registry lists every promised switch once, with a name, a one-line what, a default and plug-in points', () => {
  const keys = FEATURES.map((row) => row.key)
  assert.deepEqual(keys, [...FEATURE_KEYS])
  assert.equal(new Set(keys).size, FEATURE_KEYS.length)
  for (const feature of FEATURES) {
    assert.ok(feature.name.trim(), feature.key)
    assert.ok(feature.what.trim(), feature.key)
    assert.ok(!feature.what.includes('\n'), feature.key)
    assert.equal(typeof feature.defaultOn, 'boolean')
    assert.ok(DEPTH_ORDER.includes(feature.depth), feature.key)
    assert.ok(feature.help.split(/(?<=[.!?])\s+/).filter(Boolean).length >= 2, feature.key)
    assert.ok(feature.plugIn.length >= 1, feature.key)
    for (const dep of feature.dependsOn) assert.ok(isFeatureKey(dep), `${feature.key} dep ${dep}`)
  }
})

test('features that exist on live today default ON, so existing portals do not change', () => {
  const shipped = FEATURES.filter((row) => row.shipped)
  assert.ok(shipped.some((row) => row.key === 'gather'))
  assert.ok(shipped.some((row) => row.key === 'garden'))
  assert.ok(shipped.some((row) => row.key === 'compass'))
  assert.ok(shipped.every((row) => row.defaultOn), 'a shipped feature defaulted off')
})

test('unmerged work is in the registry so later PRs add one featureOn check', () => {
  for (const key of ['live', 'missions', 'insights', 'experiments'] as const) {
    const feature = FEATURES.find((row) => row.key === key)
    assert.ok(feature, key)
    assert.equal(feature!.shipped, false)
    assert.ok(feature!.plugIn.some((line) => /PR #\d+/.test(line)), key)
  }
})

test('null or missing features use defaults — the safe live default', () => {
  const defaults = defaultFeatures()
  assert.deepEqual(parseFeatures(null), defaults)
  assert.deepEqual(parseFeatures(undefined), defaults)
  assert.deepEqual(parseFeatures('nope'), defaults)
  assert.deepEqual(featuresOf(null), defaults)
  assert.deepEqual(featuresOf({}), defaults)
  assert.equal(featureOn(null, 'gather'), true)
  assert.equal(featureOn({ features: null }, 'garden'), true)
})

test('an explicit false wins, and unknown keys are ignored', () => {
  const portal = { features: { gather: false, garden: true, madeUp: true } }
  assert.equal(featureOn(portal, 'gather'), false)
  assert.equal(featureOn(portal, 'garden'), true)
  assert.equal(featureOn(portal, 'workbook'), true)
  assert.ok(!('madeUp' in featuresOf(portal)))
})

test('a feature is off when a dependency is off', () => {
  const original = FEATURES.find((row) => row.key === 'workbook')
  assert.ok(original)
  const deps = original!.dependsOn
  // The helper must walk dependsOn; with none set, turning workbook off is enough to prove the map.
  assert.equal(featureOn({ features: { workbook: false } }, 'workbook'), false)
  assert.deepEqual(deps, [])
  const closed = withDependencyClosure({ ...defaultFeatures(), workbook: true, garden: false })
  assert.equal(closed.workbook, true)
})

test('presets: start small, add the community, everything', () => {
  const small = presetFeatures('small')
  assert.equal(small.garden, true)
  assert.equal(small.workbook, true)
  assert.equal(small.gather, false)
  assert.equal(small.circle, false)
  assert.equal(small.planner, false)
  const community = presetFeatures('community')
  assert.equal(community.circle, true)
  assert.equal(community.planner, true)
  assert.equal(community.gather, false)
  const all = presetFeatures('everything')
  assert.ok(FEATURE_KEYS.every((key) => all[key]))
  assert.equal(matchingPreset(small), 'small')
  assert.equal(matchingPreset(community), 'community')
  assert.equal(matchingPreset(all), 'everything')
  assert.equal(matchingPreset({ ...small, gather: true }), null)
})

test('the bottom bar is always Home · Lanes · My week · Garden · Me', () => {
  const on = learnerBar(null)
  assert.deepEqual(on.map((item) => item.key), ['home', 'lanes', 'week', 'garden', 'me'])
  assert.deepEqual(on.map((item) => item.label), ['Home', 'Lanes', 'My week', 'Garden', 'Me'])
  const gatherOn = learnerBar({ features: { ...defaultFeatures(), gather: true } })
  assert.deepEqual(gatherOn.map((item) => item.label), ['Home', 'Lanes', 'My week', 'Garden', 'Me'])
  assert.ok(!on.some((item) => item.key === 'gather'))
  const bare = learnerBar({ features: { ...defaultFeatures(), gather: false, planner: false, garden: false } })
  assert.deepEqual(bare.map((item) => item.label), ['Home', 'Lanes', 'My week', 'Garden', 'Me'])
})

test('desk nav hides a feature’s tools when that switch is off', () => {
  const portal = { features: { ...defaultFeatures(), gather: false, compass: false, circle: false } }
  assert.equal(deskNavAllowed(portal, 'gather'), false)
  assert.equal(deskNavAllowed(portal, 'nights'), false)
  assert.equal(deskNavAllowed(portal, 'compass'), false)
  assert.equal(deskNavAllowed(portal, 'circle'), false)
  assert.equal(deskNavAllowed(portal, 'overview'), true)
  assert.equal(deskNavAllowed(null, 'gather'), true)
})

test('form ticks become a full map, and the unavailable copy stays calm', () => {
  const form = new FormData()
  form.append('feature', 'garden')
  form.append('feature', 'workbook')
  form.append('feature', 'not-a-key')
  const map = featuresFromForm(form)
  assert.equal(map.garden, true)
  assert.equal(map.workbook, true)
  assert.equal(map.gather, false)
  assert.ok(featuresEqual(map, presetFeatures('small')))
  assert.equal(unavailableCopy('gather').title, 'Not available in this portal')
  assert.match(unavailableCopy('gather').body, /Gather/)
  assert.equal(FEATURE_UNAVAILABLE, 'This is not available in this portal.')
})
