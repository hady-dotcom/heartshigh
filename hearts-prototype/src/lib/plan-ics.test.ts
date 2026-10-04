import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planIcs } from './plan-ics'

test('an .ics file lists each sitting as an all-day event', () => {
  const ics = planIcs({
    name: 'Night class',
    zone: 'America/Toronto',
    slots: [
      { date: '2026-10-05', title: 'Lesson 1', href: '/p/east-london/course/1?part=1' },
      { date: '2026-10-09', title: 'Lesson 2' },
    ],
  })
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/)
  assert.match(ics, /X-WR-CALNAME:Night class/)
  assert.match(ics, /X-WR-TIMEZONE:America\/Toronto/)
  assert.match(ics, /DTSTART;VALUE=DATE:20261005/)
  assert.match(ics, /DTSTART;VALUE=DATE:20261009/)
  assert.match(ics, /SUMMARY:Lesson 1/)
  assert.match(ics, /END:VCALENDAR\r\n$/)
})
