import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEPTH_ORDER,
  DEPTH_SECTION,
  FEATURES,
  FEATURE_KEYS,
  FEATURE_UNAVAILABLE,
  PRESETS,
  defaultFeatures,
  deskNavAllowed,
  featureLocked,
  featureOn,
  featuresEqual,
  featuresFromForm,
  featuresOf,
  isFeatureKey,
  learnerBar,
  legacyPortalFeatures,
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

test('beginner stays on, intermediate starts on, and extras start off', () => {
  const beginner = FEATURES.filter((row) => row.depth === 'beginner').map((row) => row.key)
  const intermediate = FEATURES.filter((row) => row.depth === 'intermediate').map((row) => row.key)
  const extra = FEATURES.filter((row) => row.depth === 'in-depth').map((row) => row.key)
  assert.deepEqual(beginner, ['garden', 'workbook', 'planner', 'announcements'])
  assert.deepEqual(intermediate, ['circle', 'compass', 'feedback'])
  assert.deepEqual(extra, ['gather', 'live', 'missions', 'insights', 'experiments', 'calendar', 'ai'])
  for (const key of beginner) {
    assert.equal(FEATURES.find((row) => row.key === key)?.defaultOn, true, key)
    assert.equal(featureLocked(key), true, key)
  }
  for (const key of intermediate) {
    assert.equal(FEATURES.find((row) => row.key === key)?.defaultOn, true, key)
    assert.equal(featureLocked(key), false, key)
  }
  for (const key of extra) {
    assert.equal(FEATURES.find((row) => row.key === key)?.defaultOn, false, key)
    assert.equal(featureLocked(key), false, key)
  }
  assert.equal(DEPTH_SECTION.beginner.title, 'Always included')
  assert.equal(DEPTH_SECTION.intermediate.title, 'On unless you switch it off')
  assert.equal(DEPTH_SECTION['in-depth'].title, 'Extras you choose')
  assert.deepEqual(Object.keys(PRESETS), ['standard', 'everything'])
})

test('merged live, missions, insights and experiments stay shipped and start off for a new portal', () => {
  for (const key of ['live', 'missions', 'insights', 'experiments'] as const) {
    const feature = FEATURES.find((row) => row.key === key)
    assert.ok(feature, key)
    assert.equal(feature!.shipped, true)
    assert.equal(feature!.defaultOn, false)
    assert.equal(feature!.depth, 'in-depth')
    assert.ok(feature!.plugIn.some((line) => /PR #\d+/.test(line)), key)
  }
})

test('a portal with no saved switches keeps what it already has, plus beginner forced on', () => {
  const kept = parseFeatures(null)
  assert.deepEqual(kept, legacyPortalFeatures(null))
  assert.deepEqual(parseFeatures(undefined), kept)
  assert.deepEqual(parseFeatures('nope'), kept)
  assert.deepEqual(featuresOf(null), kept)
  assert.deepEqual(featuresOf({}), kept)
  assert.equal(featureOn(null, 'gather'), true)
  assert.equal(featureOn(null, 'calendar'), true)
  assert.equal(featureOn(null, 'ai'), true)
  assert.equal(featureOn({ features: null }, 'announcements'), true)
  assert.equal(featureOn({ features: null }, 'garden'), true)
  const fresh = defaultFeatures()
  assert.equal(fresh.circle, true)
  assert.equal(fresh.gather, false)
  assert.equal(fresh.calendar, false)
  assert.equal(fresh.ai, false)
  assert.equal(fresh.announcements, true)
  assert.notDeepEqual(kept, fresh)
})

test('an older saved map keeps its choices, and beginner cannot be stored off', () => {
  const portal = { features: { gather: false, garden: false, madeUp: true } }
  assert.equal(featureOn(portal, 'gather'), false)
  assert.equal(featureOn(portal, 'garden'), true)
  assert.equal(featureOn(portal, 'workbook'), true)
  assert.equal(featureOn(portal, 'planner'), true)
  assert.equal(featureOn(portal, 'announcements'), true)
  assert.equal(featureOn(portal, 'circle'), true)
  assert.equal(featureOn(portal, 'calendar'), true)
  assert.equal(featureOn(portal, 'ai'), true)
  assert.ok(!('madeUp' in featuresOf(portal)))
})

test('a new save uses the stored extras, and beginner stays on', () => {
  const portal = {
    features: {
      announcements: false,
      calendar: false,
      ai: true,
      garden: false,
      workbook: false,
      planner: false,
      circle: false,
      gather: true,
    },
  }
  assert.equal(featureOn(portal, 'garden'), true)
  assert.equal(featureOn(portal, 'workbook'), true)
  assert.equal(featureOn(portal, 'planner'), true)
  assert.equal(featureOn(portal, 'announcements'), true)
  assert.equal(featureOn(portal, 'circle'), false)
  assert.equal(featureOn(portal, 'gather'), true)
  assert.equal(featureOn(portal, 'calendar'), false)
  assert.equal(featureOn(portal, 'ai'), true)
  assert.equal(featureOn(portal, 'live'), false)
})

test('a feature is off when a dependency is off', () => {
  const original = FEATURES.find((row) => row.key === 'compass')
  assert.ok(original)
  const deps = original!.dependsOn
  assert.equal(featureOn({ features: { compass: false } }, 'compass'), false)
  assert.deepEqual(deps, [])
  const closed = withDependencyClosure({ ...defaultFeatures(), workbook: true, garden: false })
  assert.equal(closed.workbook, true)
})

test('presets are Standard and Everything', () => {
  const standard = presetFeatures('standard')
  assert.equal(standard.garden, true)
  assert.equal(standard.workbook, true)
  assert.equal(standard.planner, true)
  assert.equal(standard.announcements, true)
  assert.equal(standard.circle, true)
  assert.equal(standard.compass, true)
  assert.equal(standard.feedback, true)
  assert.equal(standard.gather, false)
  assert.equal(standard.live, false)
  assert.equal(standard.calendar, false)
  assert.equal(standard.ai, false)
  assert.equal(matchingPreset(standard), 'standard')
  assert.equal(matchingPreset(defaultFeatures()), 'standard')
  const all = presetFeatures('everything')
  assert.ok(FEATURE_KEYS.every((key) => all[key]))
  assert.equal(matchingPreset(all), 'everything')
  assert.equal(matchingPreset({ ...standard, gather: true }), null)
  assert.equal('small' in PRESETS, false)
  assert.equal('community' in PRESETS, false)
})

test('the bottom bar is always Home · Lanes · My week · Garden · Me', () => {
  const on = learnerBar(null)
  assert.deepEqual(on.map((item) => item.key), ['home', 'lanes', 'week', 'garden', 'me'])
  assert.deepEqual(on.map((item) => item.label), ['Home', 'Lanes', 'My week', 'Courses', 'Me'])
  const gatherOn = learnerBar({ features: { ...defaultFeatures(), gather: true } })
  assert.deepEqual(gatherOn.map((item) => item.label), ['Home', 'Lanes', 'My week', 'Courses', 'Me'])
  assert.ok(!on.some((item) => item.key === 'gather'))
  const bare = learnerBar({ features: { ...defaultFeatures(), gather: false, planner: false, garden: false } })
  assert.deepEqual(bare.map((item) => item.label), ['Home', 'Lanes', 'My week', 'Courses', 'Me'])
})

test('desk nav hides a feature’s tools when that switch is off', () => {
  const portal = { features: defaultFeatures() }
  assert.equal(deskNavAllowed(portal, 'gather'), false)
  assert.equal(deskNavAllowed(portal, 'nights'), false)
  assert.equal(deskNavAllowed(portal, 'calendar'), false)
  assert.equal(deskNavAllowed(portal, 'ai'), false)
  assert.equal(deskNavAllowed(portal, 'announcements'), true)
  assert.equal(deskNavAllowed(portal, 'plans'), true)
  assert.equal(deskNavAllowed({ features: { ...defaultFeatures(), compass: false, circle: false } }, 'compass'), false)
  assert.equal(deskNavAllowed({ features: { ...defaultFeatures(), compass: false, circle: false } }, 'circle'), false)
  assert.equal(deskNavAllowed(portal, 'overview'), true)
  assert.equal(deskNavAllowed(null, 'gather'), true)
  assert.equal(deskNavAllowed(null, 'ai'), true)
  assert.equal(deskNavAllowed(null, 'announcements'), true)
})

test('form ticks become a full map, beginner stays on, and the unavailable copy stays calm', () => {
  const form = new FormData()
  form.append('feature', 'garden')
  form.append('feature', 'circle')
  form.append('feature', 'not-a-key')
  const map = featuresFromForm(form)
  assert.equal(map.garden, true)
  assert.equal(map.workbook, true)
  assert.equal(map.planner, true)
  assert.equal(map.announcements, true)
  assert.equal(map.circle, true)
  assert.equal(map.compass, false)
  assert.equal(map.gather, false)
  assert.equal(map.calendar, false)
  assert.equal(map.ai, false)
  const bare = new FormData()
  assert.ok(featuresEqual(featuresFromForm(bare), {
    ...presetFeatures('standard'),
    circle: false,
    compass: false,
    feedback: false,
  }))
  assert.equal(unavailableCopy('gather').title, 'Not available in this portal')
  assert.match(unavailableCopy('gather').body, /Gather/)
  assert.equal(unavailableCopy('announcements').body.includes('Announcements'), true)
  assert.equal(FEATURE_UNAVAILABLE, 'This is not available in this portal.')
})
