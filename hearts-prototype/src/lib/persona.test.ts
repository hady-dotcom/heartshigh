import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SCALE_KEYS, type ScaleKey } from './heart'
import { MISSING_SCALE_ROWS, OPEN_QUESTIONS, PERSONA_BANDS } from './persona-data'
import { hasBounds, matchPersonas, publishProblems, sameRangeAs, signature, tallyPersonas, toRung, type PersonaBand, type Reading } from './persona'

const devout = PERSONA_BANDS.find((band) => band.key === 'devout')!
const traditionalist = PERSONA_BANDS.find((band) => band.key === 'traditionalist')!
const newbie = PERSONA_BANDS.find((band) => band.key === 'new-muslim')!

test('persona drafts leave Anger and Greed empty, and Devout matches Traditionalist', () => {
  assert.equal(PERSONA_BANDS.length, 10)
  assert.ok(PERSONA_BANDS.every((band) => band.status === 'draft' && band.placeholder))
  for (const band of PERSONA_BANDS) {
    for (const scale of MISSING_SCALE_ROWS) {
      const row = band.ranges.find((item) => item.scale === scale)
      assert.equal(row?.present, false, `${band.key} ${scale}`)
      assert.equal(row?.min, null)
      assert.equal(row?.max, null)
    }
  }
  assert.equal(signature(devout), signature(traditionalist))
  assert.equal(sameRangeAs(devout, PERSONA_BANDS)?.key, 'traditionalist')
  assert.equal(hasBounds(newbie), false)
  assert.equal(sameRangeAs(newbie, PERSONA_BANDS), null)
  const blocked = publishProblems(devout, PERSONA_BANDS)
  assert.ok(blocked.some((line) => line.includes('anger')))
  assert.ok(blocked.some((line) => line.includes('Traditionalist')))
  assert.ok(blocked.some((line) => line.includes('Stand-in')))
  assert.equal(publishProblems(newbie, PERSONA_BANDS).some((line) => line.includes('no range yet')), true)
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

test('the open questions name the gaps the drafts are standing in for', () => {
  const text = OPEN_QUESTIONS.map((item) => item.text).join(' ')
  for (const phrase of ['Anger', 'Greed', 'Devout Practitioner', 'Traditionalist', 'Doc C', 'Season', 'Keep my place']) {
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
