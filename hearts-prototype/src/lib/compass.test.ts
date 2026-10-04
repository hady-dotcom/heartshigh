import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SCALE_KEYS } from './heart'
import { SCENES } from './opening-data'
import { authorTextProblems } from './opening-data'
import { DEFAULT_COPY, FOCUS_NAMES, LEARNER_VOICE, LIFE_OPTIONS, LIFE_PROMPT, MONTH_WORDING } from './compass-data'
import { attribute, focusLine, portalSummary, rawScoreLeak, recalibrationDue, steer, summarise, withLife, MONTH_MS } from './compass'
import { PERSONA_BANDS } from './persona-data'
import { publishProblems, signature } from './persona'

test('persona ranges are published, distinct, and cover anger and greed', () => {
  assert.equal(PERSONA_BANDS.length, 10)
  const signatures = new Set<string>()
  for (const band of PERSONA_BANDS) {
    assert.equal(band.status, 'published')
    assert.equal(band.placeholder, false)
    assert.equal(publishProblems(band, PERSONA_BANDS).length, 0, band.key)
    assert.equal(band.ranges.filter((row) => row.present && row.min != null).length, SCALE_KEYS.length)
    signatures.add(signature(band))
  }
  assert.equal(signatures.size, PERSONA_BANDS.length)
  const devout = PERSONA_BANDS.find((band) => band.key === 'devout')!
  const traditionalist = PERSONA_BANDS.find((band) => band.key === 'traditionalist')!
  assert.notEqual(signature(devout), signature(traditionalist))
  const devoutFaith = devout.ranges.find((row) => row.scale === 'faith')!
  const traditionalFaith = traditionalist.ranges.find((row) => row.scale === 'faith')!
  assert.ok((devoutFaith.max || 0) < (traditionalFaith.min || 0))
  assert.equal(devout.ranges.find((row) => row.scale === 'anger')?.present, true)
  assert.equal(traditionalist.ranges.find((row) => row.scale === 'greed')?.present, true)
})

test('learner copy, monthly wording and the life check pass the kill list', () => {
  const fields: [string, string][] = [
    ['lead', DEFAULT_COPY.focusLead],
    ['up', DEFAULT_COPY.movementUp],
    ['same', DEFAULT_COPY.movementSame],
    ['onward', DEFAULT_COPY.movementOnward],
    ['life', LIFE_PROMPT.caption],
    ['life sub', LIFE_PROMPT.subline],
    ...DEFAULT_COPY.places.flatMap((place) => [[place.key, place.label], [`${place.key} forward`, place.forward]] as [string, string][]),
    ...LIFE_OPTIONS.map((option) => [option.key, option.label] as [string, string]),
    ...Object.values(FOCUS_NAMES).map((name) => ['focus', name] as [string, string]),
    ...Object.values(LEARNER_VOICE).flatMap((voice) => [['voice', voice.line], ['step', voice.step]] as [string, string][]),
  ]
  for (const [key, wording] of Object.entries(MONTH_WORDING)) {
    const scene = SCENES.find((row) => row.key === key)
    assert.ok(scene)
    assert.notEqual(wording.caption, scene!.caption)
    fields.push([`${key} caption`, wording.caption], [`${key} sub`, wording.subline])
    for (const option of scene!.options) {
      assert.ok(wording.labels[option.key], `${key} ${option.key}`)
      assert.notEqual(wording.labels[option.key], option.label)
      fields.push([`${key} ${option.key}`, wording.labels[option.key]])
    }
  }
  assert.deepEqual(authorTextProblems(fields), [])
})

test('the soft summary has warm words and no raw scores', () => {
  const summary = summarise({
    now: [
      { scale: 'anger', focus: 'patience', rung: 1 },
      { scale: 'gratitude', focus: 'thankfulness', rung: -5 },
      { scale: 'worry', focus: 'trust', rung: 4 },
    ],
    before: [
      { scale: 'anger', focus: 'patience', rung: -8 },
      { scale: 'gratitude', focus: 'thankfulness', rung: -6 },
      { scale: 'worry', focus: 'trust', rung: 4 },
    ],
    talks: [
      { title: 'A short talk on patience', href: '/p/east-london/feed?lane=patience', scales: [{ scale: 'anger', weight: 1 }] },
      { title: 'A short talk on thankfulness', href: '/p/east-london/feed?lane=gifts', scales: [{ scale: 'gratitude', weight: 1 }] },
    ],
  })
  assert.equal(rawScoreLeak(summary), null)
  assert.equal(summary.focusLine, 'Focusing on: Noticing small gifts, Holding your temper')
  assert.equal(summary.areas.length, 2)
  assert.equal(summary.areas.every((area) => area.place == null), true)
  assert.equal(summary.steps.length, 2)
  assert.equal(summary.talks[0]?.title, 'A short talk on thankfulness')
  assert.equal(summary.movement.length, 0)
  const lines = summary.areas.map((area) => area.forward)
  assert.equal(new Set(lines).size, lines.length)
})

test('the framing can be the focus line, the place words, or both', () => {
  const now = [{ scale: 'anger' as const, focus: 'patience', rung: -4 }]
  const talks: { title: string; href: string; scales: { scale: 'anger'; weight: number }[] }[] = []
  const both = summarise({ now, talks })
  assert.equal(both.focusLine, 'Focusing on: Holding your temper')
  assert.equal(both.areas[0]?.place, null)
  const focusing = summarise({ now, talks, frame: 'focusing' })
  assert.equal(focusing.focusLine, 'Focusing on: Holding your temper')
  assert.equal(focusing.areas[0]?.place, null)
  const places = summarise({ now, talks, frame: 'places', copy: { ...DEFAULT_COPY, focusLead: 'Walking with' } })
  assert.equal(places.focusLine, null)
  assert.equal(places.areas[0]?.place, null)
  assert.equal(focusLine('Walking with', ['patience', 'thankfulness']), 'Walking with: Patience, Thankfulness')
})

test('steering weights the weakest scale and still keeps a second one', () => {
  const items = [
    { id: 'w1', scales: [{ scale: 'worry' as const, weight: 1 }] },
    { id: 'w2', scales: [{ scale: 'worry' as const, weight: 1 }] },
    { id: 'a1', scales: [{ scale: 'anger' as const, weight: 1 }] },
    { id: 'plain', scales: [{ scale: 'faith' as const, weight: 1 }] },
  ]
  const picked = steer(items, { worry: -0.9, anger: -0.3, faith: 0.4 }, 3)
  assert.deepEqual(picked.map((item) => item.id), ['w1', 'a1', 'w2'])
  const heavy = steer(
    [
      { id: 'light', scales: [{ scale: 'worry' as const, weight: 0.2 }] },
      { id: 'heavy', scales: [{ scale: 'anger' as const, weight: 1 }] },
    ],
    { worry: -0.9, anger: -0.4 },
    1,
  )
  assert.equal(heavy[0]?.id, 'heavy')
})

test('a life event pulls steering toward that scale without changing the stored reading', () => {
  const stored = { worry: 0.2, anger: 0.1 }
  const pulled = withLife(stored, 'worry')
  assert.equal(stored.worry, 0.2)
  assert.equal(pulled.worry, -0.4)
  const picked = steer(
    [
      { id: 'trust', scales: [{ scale: 'worry' as const, weight: 1 }] },
      { id: 'other', scales: [{ scale: 'faith' as const, weight: 1 }] },
    ],
    pulled,
    1,
  )
  assert.equal(picked[0]?.id, 'trust')
})

test('recalibration is due thirty days after the latest attempt', () => {
  const now = Date.UTC(2026, 5, 15)
  assert.equal(recalibrationDue(null, now), false)
  assert.equal(recalibrationDue(now - MONTH_MS + 1000, now), false)
  assert.equal(recalibrationDue(now - MONTH_MS, now), true)
})

test('attribution pairs talks watched in a low scale with the change at the next attempt', () => {
  const attempts = [
    { at: 1_000, scales: { anger: -0.8, gratitude: -0.6, worry: 0.4 } },
    { at: 5_000, scales: { anger: 0.1, gratitude: -0.5, worry: 0.4 } },
  ]
  const watched = [
    { at: 3_000, title: 'On patience', scales: ['anger' as const] },
    { at: 6_000, title: 'Too late', scales: ['anger' as const] },
  ]
  const rows = attribute(attempts, watched)
  const anger = rows.find((row) => row.scale === 'anger')
  assert.deepEqual(anger, { scale: 'anger', from: -8, to: 1, delta: 9, talks: ['On patience'] })
  const gratitude = rows.find((row) => row.scale === 'gratitude')
  assert.equal(gratitude?.from, -6)
  assert.equal(gratitude?.to, -5)
  assert.deepEqual(gratitude?.talks, [])
  assert.equal(rows.some((row) => row.scale === 'worry'), false)
  const portal = portalSummary([{ attempts, watched }])
  const cell = portal.find((row) => row.scale === 'anger')
  assert.equal(cell?.learners, 1)
  assert.equal(cell?.meanThen, -8)
  assert.equal(cell?.meanNow, 1)
  assert.deepEqual(cell?.helpedBy, [{ title: 'On patience', lifts: 1 }])
})
