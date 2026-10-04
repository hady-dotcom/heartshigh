import assert from 'node:assert/strict'
import { test } from 'node:test'
import { authorTextProblems } from './opening-data'
import { BANK, LIFE_EVENTS, MONTH_FORMS, applyMonth, formById, formForRound } from './compass-bank'
import { DEFAULT_MIX, SCALE_DOOR, combineServes, compassDate, doorPhrase, monthShort, plainWhy, quotas, rankFeed, teachDoors, teachLine, whyDeficit, whyStrength } from './compass-feed'
import { SCALE_KEYS, type ScaleKey } from './heart'
import { PERSONA_BANDS } from './persona-data'
import { matchPersonas, nearestPersona, rangesDisjoint } from './persona'
import { midpointReading, PERSONA_VERSION } from './persona-v2'
import { lifeForDemo, passwordForNewAccount } from './compass-demo-plan'

test('persona v2 ranges do not overlap, and a midpoint matches only its own band', () => {
  assert.equal(PERSONA_BANDS.length, 10)
  for (const band of PERSONA_BANDS) {
    assert.equal(band.version, PERSONA_VERSION)
    assert.ok(band.doors?.length)
    assert.ok(band.talks?.length)
    assert.ok(band.description)
    const reading = midpointReading(band)
    assert.deepEqual(matchPersonas(reading, PERSONA_BANDS), [band.key])
  }
  for (let i = 0; i < PERSONA_BANDS.length; i += 1) {
    for (let j = i + 1; j < PERSONA_BANDS.length; j += 1) {
      assert.equal(rangesDisjoint(PERSONA_BANDS[i], PERSONA_BANDS[j]), true, `${PERSONA_BANDS[i].key} ${PERSONA_BANDS[j].key}`)
    }
  }
  assert.equal(nearestPersona({ worry: 0 }, PERSONA_BANDS) != null, true)
})

test('each scale has two wordings, and a month sits five of them', () => {
  for (const scale of SCALE_KEYS) {
    const forms = BANK.filter((item) => item.scale === scale).map((item) => item.form).sort()
    assert.deepEqual(forms, ['a', 'b'])
  }
  assert.equal(MONTH_FORMS.length, 4)
  const seen = new Set<string>()
  for (let round = 0; round < 4; round += 1) {
    const form = formForRound(round)
    assert.equal(form.items.length, 5)
    assert.equal(formById(form.id)?.id, form.id)
    seen.add(form.id)
    const scales = form.items.map((item) => item.scale)
    assert.equal(new Set(scales).size, 5)
  }
  assert.equal(seen.size, 4)
  assert.equal(formForRound(4).id, formForRound(0).id)
  const fields: [string, string][] = []
  for (const item of BANK) {
    fields.push([item.key, item.caption], [`${item.key} sub`, item.subline])
    for (const choice of item.options) fields.push([`${item.key} ${choice.key}`, choice.label])
  }
  for (const event of LIFE_EVENTS) fields.push([event.key, event.label])
  fields.push(['invite', 'A fresh look, when you have a moment'])
  fields.push(['invite body', 'Five short questions, in different words, and one line about life just now.'])
  assert.deepEqual(authorTextProblems(fields), [])
})

test('a monthly sitting keeps unasked scales and never overwrites the previous object', () => {
  const previous = { gratitude: 0.2, anger: -0.4, worry: 0.1, faith: 0, belonging: 0.5, greed: 0.3 }
  const before = JSON.stringify(previous)
  const next = applyMonth(previous, [
    { scale: 'gratitude', delta: 1 },
    { scale: 'anger', delta: -1 },
  ])
  assert.equal(JSON.stringify(previous), before)
  assert.equal(next.gratitude, 0.5)
  assert.equal(next.anger, -0.7)
  assert.equal(next.greed, 0.3)
  assert.equal(next.desire, 0)
  assert.equal(Object.keys(next).length, SCALE_KEYS.length)
})

test('the shelf is 60, 25 and 15, and the why line names the scale and the door', () => {
  const mix = quotas(4, DEFAULT_MIX)
  assert.deepEqual(mix, { deficit: 2, strength: 1, discovery: 1 })
  assert.deepEqual(quotas(3, DEFAULT_MIX), { deficit: 2, strength: 1, discovery: 0 })
  const reading: Partial<Record<ScaleKey, number>> = { gratitude: -0.8, anger: -0.2, faith: 0.7, worry: 0.1 }
  const items = [
    { id: 'g1', title: 'Gifts', href: '/a', kind: 'hors' as const, door: SCALE_DOOR.gratitude, scales: [{ scale: 'gratitude' as const, weight: 1 }] },
    { id: 'g2', title: 'More gifts', href: '/b', kind: 'appetiser' as const, door: SCALE_DOOR.gratitude, scales: [{ scale: 'gratitude' as const, weight: 1 }] },
    { id: 'a1', title: 'Patience', href: '/c', kind: 'hors' as const, door: SCALE_DOOR.anger, scales: [{ scale: 'anger' as const, weight: 1 }] },
    { id: 'f1', title: 'Closeness', href: '/d', kind: 'talk' as const, door: SCALE_DOOR.faith, scales: [{ scale: 'faith' as const, weight: 1 }] },
    { id: 'd1', title: 'A new door', href: '/e', kind: 'course' as const, door: 8, scales: [{ scale: 'compassion' as const, weight: 0.2 }] },
  ]
  const ranked = rankFeed(items, reading, { take: 4, mix: DEFAULT_MIX, recentDoors: [SCALE_DOOR.gratitude, SCALE_DOOR.anger, SCALE_DOOR.faith] })
  assert.equal(ranked.filter((row) => row.bucket === 'deficit').length, 2)
  assert.equal(ranked.filter((row) => row.bucket === 'strength').length, 1)
  assert.equal(ranked.filter((row) => row.bucket === 'discovery').length, 1)
  assert.equal(ranked.find((row) => row.id === 'g1')?.why, whyDeficit('gratitude'))
  assert.match(ranked.find((row) => row.id === 'g1')?.why || '', /Door 15 \(Qadar: good and evil\)/)
  assert.doesNotMatch(ranked.find((row) => row.id === 'g1')?.why || '', /\bW\d+/)
  assert.equal(ranked.find((row) => row.bucket === 'strength')?.id, 'f1')
  assert.match(ranked.find((row) => row.id === 'f1')?.why || '', /Steady on Faith/)
  assert.equal(ranked.find((row) => row.bucket === 'discovery')?.id, 'd1')
  const grief = rankFeed(items, { gratitude: 0.4, anger: 0.4 }, { take: 4, life: [LIFE_EVENTS.find((event) => event.key === 'grief')!] })
  assert.equal(grief[0]?.id, 'a1')
  assert.match(grief[0]?.why || '', /patience and qadr/)
  const names = { id: 'names', title: 'The Names Class 19', href: '/n', kind: 'talk' as const, door: SCALE_DOOR.faith, scales: [{ scale: 'faith' as const, weight: 1 }, { scale: 'worry' as const, weight: 0.6 }] }
  const griefWhy = LIFE_EVENTS.find((event) => event.key === 'grief')?.why
  const mismatched = rankFeed([names, items[2]], { faith: 0.5, worry: -0.8, anger: 0.2 }, { take: 3, life: [LIFE_EVENTS.find((event) => event.key === 'grief')!] })
  const namesRow = mismatched.find((row) => row.id === 'names')
  assert.notEqual(namesRow?.why, griefWhy)
  assert.notEqual(namesRow?.why, whyDeficit('worry'))
})

const PLACEHOLDER = /\bDoor X\b|\bundefined\b|\bnull\b|\bNaN\b/

test('desk lines name a real door, and September is Sep', () => {
  for (const scale of SCALE_KEYS) {
    assert.doesNotMatch(whyDeficit(scale), PLACEHOLDER)
    assert.doesNotMatch(whyStrength(scale), PLACEHOLDER)
    assert.doesNotMatch(teachLine(scale, 0), PLACEHOLDER)
    assert.doesNotMatch(teachLine(scale, 1), PLACEHOLDER)
  }
  assert.equal(doorPhrase(Number.NaN), '')
  assert.equal(doorPhrase(0), '')
  assert.equal(doorPhrase(15), 'Door 15 (Qadar: good and evil)')
  assert.equal(doorPhrase(16), 'Door 16 (Ihsan)')
  assert.equal(doorPhrase(7), 'Door 7 (Fasting Ramadan)')
  assert.match(plainWhy('Low on Worry, so Door 15, Qadar, good and evil talks get a boost.'), /Door 15 \(Qadar: good and evil\) talks get a boost/)
  const cleaned = plainWhy('Low on Fear, so Door X, qadr and qada come forward.')
  assert.doesNotMatch(cleaned, PLACEHOLDER)
  assert.match(cleaned, /qadr and qada/)
  assert.equal(monthShort('2026-09-03T12:00:00.000Z'), 'Sep')
  assert.equal(compassDate('2026-06-03T12:00:00.000Z'), '3 Jun')
  const shared = teachDoors(['ego', 'desire'])
  assert.equal(shared.length, 2)
  assert.notEqual(shared[0], shared[1])
  assert.notEqual(teachDoors(['worry', 'gratitude'])[0], teachDoors(['worry', 'gratitude'])[1])
  const rows = combineServes([
    { title: 'Praying the night on', kind: 'appetiser', engaged: false },
    { title: 'Praying the night on', kind: 'hors', engaged: true },
  ])
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].kinds, ['appetiser', 'hors'])
  assert.equal(rows[0].engaged, true)
})

test('demo passwords are set only for accounts this run creates, and life notes do not repeat', () => {
  assert.equal(passwordForNewAccount(true), 'compass-demo')
  assert.equal(passwordForNewAccount(false), null)
  const notes = new Set<string>()
  for (let month = 1; month <= 4; month += 1) notes.add(lifeForDemo(0, month).note)
  assert.equal(notes.size, 4)
  const sameMonth = [0, 1, 2, 3].map((person) => lifeForDemo(person, 2).note)
  assert.equal(new Set(sameMonth).size, sameMonth.length)
})
