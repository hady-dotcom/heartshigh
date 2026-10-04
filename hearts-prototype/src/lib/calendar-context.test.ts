import assert from 'node:assert/strict'
import { test } from 'node:test'
import { approvedCopy, calendarContext, contextLabel, nudgeTalks } from './calendar-context'
import { hijriOf, toGregorian, toHijri } from './hijri'

function utc(iso: string) {
  return new Date(`${iso}Z`)
}

function gregorianOf(hy: number, hm: number, hd: number) {
  const g = toGregorian(hy, hm, hd)
  return utc(`${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}T12:00:00`)
}

test('Kuwaiti conversion round-trips a 2026 civil date', () => {
  const hijri = toHijri(2026, 3, 1)
  const back = toGregorian(hijri.hy, hijri.hm, hijri.hd)
  assert.deepEqual(back, { gy: 2026, gm: 3, gd: 1 })
})

test('1 Ramadan 1447 is Ramadan, and day 21 opens the last ten nights', () => {
  const first = calendarContext({ at: gregorianOf(1447, 9, 1) })
  assert.equal(first.ramadan, true)
  assert.equal(first.lastTenNights, false)
  assert.equal(first.hijri.hm, 9)
  assert.equal(first.hijri.hd, 1)
  const late = calendarContext({ at: gregorianOf(1447, 9, 21) })
  assert.equal(late.ramadan, true)
  assert.equal(late.lastTenNights, true)
})

test('Eid al-Fitr 1447 and 1448 (2026 and 2027) are flagged', () => {
  const e1447 = calendarContext({ at: gregorianOf(1447, 10, 1) })
  assert.equal(e1447.eidFitr, true)
  assert.equal(e1447.ramadan, false)
  const e1448 = calendarContext({ at: gregorianOf(1448, 10, 1) })
  assert.equal(e1448.eidFitr, true)
  assert.ok(e1448.at.startsWith('2027') || e1448.hijri.hy === 1448)
})

test('first ten days of Dhul Hijjah and Eid al-Adha in 1447 and 1448', () => {
  const day1 = calendarContext({ at: gregorianOf(1447, 12, 1) })
  assert.equal(day1.dhulHijjah, true)
  assert.equal(day1.eidAdha, false)
  const adha1447 = calendarContext({ at: gregorianOf(1447, 12, 10) })
  assert.equal(adha1447.eidAdha, true)
  assert.equal(adha1447.dhulHijjah, true)
  const adha1448 = calendarContext({ at: gregorianOf(1448, 12, 10) })
  assert.equal(adha1448.eidAdha, true)
})

test('Muharram and Ashura in 1448 and 1449', () => {
  const muharram = calendarContext({ at: gregorianOf(1448, 1, 1) })
  assert.equal(muharram.muharram, true)
  assert.equal(muharram.ashura, false)
  const ashura1448 = calendarContext({ at: gregorianOf(1448, 1, 10) })
  assert.equal(ashura1448.ashura, true)
  const ashura1449 = calendarContext({ at: gregorianOf(1449, 1, 10) })
  assert.equal(ashura1449.ashura, true)
})

test('Friday and Thursday evening in 2026', () => {
  // 6 February 2026 is a Friday.
  const friday = calendarContext({ at: utc('2026-02-06T10:00:00'), weekday: 5, hour: 10 })
  assert.equal(friday.friday, true)
  assert.equal(friday.thursdayEvening, false)
  const thursdayEvening = calendarContext({ at: utc('2026-02-05T19:30:00'), weekday: 4, hour: 19 })
  assert.equal(thursdayEvening.thursdayEvening, true)
  assert.equal(thursdayEvening.friday, true)
  const thursdayAfternoon = calendarContext({ at: utc('2026-02-05T15:00:00'), weekday: 4, hour: 15 })
  assert.equal(thursdayAfternoon.thursdayEvening, false)
  assert.equal(thursdayAfternoon.friday, false)
})

test('admin exam season is active inside its dates', () => {
  const ctx = calendarContext({
    at: utc('2026-05-12T10:00:00'),
    seasons: [{ key: 'exams', name: 'Exam season', theme: 'focus revision', start: '2026-05-01', end: '2026-06-15' }],
  })
  assert.ok(ctx.seasons.some((row) => row.key === 'exams'))
  assert.ok(ctx.active.includes('exams'))
})

test('moon-sighting offset of +1 day moves the Hijri date', () => {
  const noon = utc('2026-02-18T12:00:00')
  const plain = hijriOf(noon, 0)
  const shifted = hijriOf(noon, 1)
  assert.ok(plain.hd !== shifted.hd || plain.hm !== shifted.hm)
})

test('context wording picks Friday over the default label', () => {
  const friday = calendarContext({ at: utc('2026-02-06T10:00:00'), weekday: 5, hour: 10 })
  const line = contextLabel({ label: 'Learn more', friday: "A Friday reminder before Jumu'ah" }, friday, 'Learn more')
  assert.equal(line, "A Friday reminder before Jumu'ah")
  const approved = approvedCopy(
    [{ slot: 'feed-cta-label', context: 'friday', label: "A Friday reminder before Jumu'ah", approved: true }],
    'feed-cta-label',
    friday,
  )
  assert.equal(approved, "A Friday reminder before Jumu'ah")
  assert.equal(approvedCopy([{ slot: 'feed-cta-label', context: 'friday', label: 'Hold', approved: false }], 'feed-cta-label', friday), null)
})

test('talk order is nudged by season theme and optional popular ids', () => {
  const ramadan = calendarContext({ at: gregorianOf(1447, 9, 5) })
  const talks = [
    { id: 1, title: 'A quiet walk' },
    { id: 2, title: 'Mercy in Ramadan' },
    { id: 3, title: 'Another sitting' },
  ]
  const nudged = nudgeTalks(talks, ramadan, [3], true)
  assert.equal(nudged[0].id, 2)
  assert.equal(nudged[1].id, 3)
})
