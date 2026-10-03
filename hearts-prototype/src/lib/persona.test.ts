import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SCALE_KEYS, type ScaleKey } from './heart'
import { BALANCE_NOTES, PERSONA_BANDS } from './persona-data'
import { hasBounds, matchPersonas, publishProblems, sameRangeAs, signature, tallyPersonas, toRung, type PersonaBand, type Reading } from './persona'

const devout = PERSONA_BANDS.find((band) => band.key === 'devout')!
const traditionalist = PERSONA_BANDS.find((band) => band.key === 'traditionalist')!
const newbie = PERSONA_BANDS.find((band) => band.key === 'new-muslim')!

test('balanced persona bands are distinct and ready to publish', () => {
  assert.equal(PERSONA_BANDS.length, 10)
  assert.ok(BALANCE_NOTES.some((note) => note.id === 'anger-greed'))
  assert.notEqual(signature(devout), signature(traditionalist))
  assert.equal(sameRangeAs(devout, PERSONA_BANDS), null)
  assert.equal(hasBounds(newbie), true)
  assert.equal(publishProblems(devout, PERSONA_BANDS).length, 0)
  assert.equal(publishProblems(newbie, PERSONA_BANDS).length, 0)
  assert.equal(devout.ranges.find((row) => row.scale === 'anger')?.present, true)
  assert.equal(devout.ranges.find((row) => row.scale === 'greed')?.min != null, true)
  assert.deepEqual(matchPersonas({ worry: 0 }, PERSONA_BANDS), [])
})

test('the step-2 stand-in matches a published band only when every included scale was read', () => {
  assert.equal(toRung(0.3), 3)
  assert.equal(toRung(-0.6), -6)
  assert.equal(toRung(1), 10)
  assert.equal(toRung(-1), -10)
  const band = complete('quiet-one', -2, 2)
  const calm: Reading = Object.fromEntries(SCALE_KEYS.map((scale) => [scale, 0]))
  assert.deepEqual(matchPersonas(calm, [band]), ['quiet-one'])
  assert.deepEqual(matchPersonas({ ...calm, worry: -0.6 }, [band]), [])
  assert.deepEqual(matchPersonas(calm, [{ ...band, status: 'draft' }]), [])
  const unread: Reading = { worry: 0 }
  assert.deepEqual(matchPersonas(unread, [band]), [])
  const twin = complete('quiet-two', -2, 2)
  assert.deepEqual(matchPersonas(calm, [band, twin]), [])
  const before = JSON.stringify(calm)
  matchPersonas(calm, [band])
  assert.equal(JSON.stringify(calm), before)
  assert.equal('persona' in calm, false)
})

test('persona cells stay hidden under 20 people and round a share to 5 percent', () => {
  const band = complete('quiet-one', -2, 2)
  const reading: Reading = Object.fromEntries(SCALE_KEYS.map((scale) => [scale, 0]))
  const few = Array.from({ length: 19 }, () => ({ group: 'east-london', reading }))
  const hidden = tallyPersonas(few, [band])
  assert.equal(hidden.length, 1)
  assert.equal(hidden[0].shown, false)
  assert.equal(hidden[0].share, null)
  const many = Array.from({ length: 20 }, () => ({ group: 'east-london', reading }))
  const shown = tallyPersonas(many, [band])
  assert.equal(shown[0].shown, true)
  assert.equal(shown[0].count, 20)
  assert.equal(shown[0].share, 100)
  const mixed = [...Array.from({ length: 20 }, () => ({ group: 'east-london', reading })), { group: 'east-london', reading: { worry: -1 } }]
  const share = tallyPersonas(mixed, [band])
  assert.equal(share[0].count, 20)
  assert.equal(share[0].people, 21)
  assert.equal(share[0].share, 95)
})

test('the balancing notes record how the ranges were split', () => {
  const text = BALANCE_NOTES.map((item) => item.text).join(' ')
  for (const phrase of ['Anger', 'Greed', 'Devout Practitioner', 'Traditionalist', 'Season', 'New Muslim']) {
    assert.ok(text.includes(phrase), phrase)
  }
})

function complete(key: string, min: number, max: number): PersonaBand {
  return {
    key,
    title: key,
    status: 'published',
    source: 'unassigned',
    placeholder: false,
    identicalGroup: '',
    note: '',
    ranges: SCALE_KEYS.map((scale: ScaleKey) => ({ scale, present: true, min, max })),
  }
}
