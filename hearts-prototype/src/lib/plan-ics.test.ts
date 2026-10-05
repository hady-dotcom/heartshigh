import assert from 'node:assert/strict'
import { test } from 'node:test'
import { foldIcsLine, planIcs } from './plan-ics'

test('an .ics file lists each sitting as an all-day event with a real stamp and an absolute link', () => {
  const stampedAt = new Date('2026-10-04T19:30:00.000Z')
  const ics = planIcs({
    name: 'Night class',
    zone: 'America/Toronto',
    origin: 'https://hearts.example',
    stampedAt,
    slots: [
      { date: '2026-10-05', title: 'Tawakkul | Speaker Name', href: '/p/east-london/course/1?part=1' },
      { date: '2026-10-09', title: 'Lesson 2' },
    ],
  })
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/)
  assert.match(ics, /X-WR-CALNAME:Night class/)
  assert.match(ics, /X-WR-TIMEZONE:America\/Toronto/)
  assert.match(ics, /DTSTAMP:20261004T193000Z/)
  assert.match(ics, /DTSTART;VALUE=DATE:20261005/)
  assert.match(ics, /DTSTART;VALUE=DATE:20261009/)
  assert.match(ics, /SUMMARY:Tawakkul/)
  assert.doesNotMatch(ics, /SUMMARY:Tawakkul \| Speaker/)
  assert.match(ics, /URL:https:\/\/hearts\.example\/p\/east-london\/course\/1\?part=1/)
  assert.match(ics, /END:VCALENDAR\r\n$/)
  for (const raw of ics.split('\r\n')) {
    if (!raw) continue
    const line = raw.startsWith(' ') ? raw.slice(1) : raw
    assert.ok(Buffer.from(line, 'utf8').length <= 75, `line over 75 octets: ${raw}`)
  }
})

test('ics lines fold at 75 octets', () => {
  const long = `SUMMARY:${'A very long sitting title that must wrap '.repeat(6).trim()}`
  const folded = foldIcsLine(long)
  assert.match(folded, /\r\n /)
  for (const raw of folded.split('\r\n')) {
    const line = raw.startsWith(' ') ? raw.slice(1) : raw
    assert.ok(Buffer.from(line, 'utf8').length <= 75)
  }
})
