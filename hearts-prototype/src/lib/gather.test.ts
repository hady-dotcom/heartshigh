import assert from 'node:assert/strict'
import test from 'node:test'
import { harvestLine } from './harvest'
import { qrPosterPdf } from './gather-pdf'
import {
  applyChoice,
  attendanceCompletesTask,
  balanceGroups,
  countsWithGathering,
  crossPost,
  demoPortalGuard,
  makeEntryCode,
  normaliseEntryCode,
  publicShareUrl,
  whatsAppHref,
  discussionPrompts,
  gatheringMatchesTask,
  googleCalendarUrl,
  groupByDoor,
  linkLabel,
  londonIso,
  newcomerFollowUp,
  publicNames,
  reflectionSentence,
  relatedGatherings,
  suggestedAudience,
  taskWantsCompany,
  toIcs,
  userIdFromBringToken,
  bringToken,
  afterTalkLine,
  whenLabel,
} from './gather'
import { countsTowardProgress } from './progress'
import { publicBaseURL } from './env'

test('a full room puts the next person on the list, and a decline promotes them', () => {
  const first = applyChoice([], 'a', 'going', 1, 1)
  assert.equal(first.status, 'going')
  const second = applyChoice(first.rows, 'b', 'going', 1, 2)
  assert.equal(second.status, 'waitlist')
  const left = applyChoice(second.rows, 'a', 'cant', 1, 3)
  assert.equal(left.status, 'cant')
  assert.equal(left.promotedId, 'b')
  assert.equal(left.rows.find((row) => row.id === 'b')?.status, 'going')
})

test('maybe and can’t do not take a seat or promote anyone', () => {
  const going = applyChoice([], 'a', 'going', 1, 1)
  const maybe = applyChoice(going.rows, 'b', 'maybe', 1, 2)
  assert.equal(maybe.status, 'maybe')
  assert.equal(maybe.promotedId, null)
  assert.equal(maybe.rows.filter((row) => row.status === 'going').length, 1)
  const cant = applyChoice(maybe.rows, 'c', 'cant', 1, 3)
  assert.equal(cant.promotedId, null)
})

test('the earliest waitlist place is the one that moves up', () => {
  let rows = applyChoice([], 'a', 'going', 1, 1).rows
  rows = applyChoice(rows, 'b', 'going', 1, 2).rows
  rows = applyChoice(rows, 'c', 'going', 1, 3).rows
  const left = applyChoice(rows, 'a', 'cant', 1, 4)
  assert.equal(left.promotedId, 'b')
  assert.equal(left.rows.find((row) => row.id === 'c')?.status, 'waitlist')
})

test('public pages show a first name, or a first name and initial when two share it', () => {
  assert.deepEqual(publicNames(['Amina Yusuf', 'Idris']), ['Amina', 'Idris'])
  assert.deepEqual(publicNames(['Amina Yusuf', 'Amina Khan']), ['Amina Y.', 'Amina K.'])
})

test('a bring-a-friend token points back at the learner who shared it', () => {
  assert.equal(userIdFromBringToken(bringToken(42)), 42)
  assert.equal(userIdFromBringToken('nope'), null)
})

test('company tasks match a gathering on the same talk, course or door', () => {
  const task = { id: 3, lessonId: 9, courseId: 2, door: 7, prompt: 'Sit with others and thank one person this week.' }
  assert.equal(taskWantsCompany(task.prompt), true)
  assert.equal(taskWantsCompany('Write a note in your own book.'), false)
  const gathering = { id: 1, lessonId: 9, courseId: null, door: null, taskId: null, startsAt: '2026-10-08T18:00:00.000Z' }
  assert.equal(gatheringMatchesTask(gathering, task), true)
  assert.equal(gatheringMatchesTask({ ...gathering, lessonId: null, door: 7 }, task), true)
  assert.equal(gatheringMatchesTask({ ...gathering, lessonId: 4, door: 1 }, { ...task, prompt: 'Write a note in your own book.' }), false)
  assert.equal(gatheringMatchesTask({ ...gathering, lessonId: 4, taskId: 3 }, { ...task, prompt: 'Write a note in your own book.' }), true)
})

test('after a talk, the masjid line names the day', () => {
  assert.equal(afterTalkLine('2026-10-08T18:00:00.000Z'), 'People from your masjid are meeting to talk about this on Thursday.')
  const related = relatedGatherings(
    [{ id: 1, lessonId: 9, courseId: 2, door: null, taskId: null, startsAt: '2026-10-08T18:00:00.000Z' }],
    { lessonId: 9 },
    Date.parse('2026-10-01T00:00:00.000Z'),
  )
  assert.equal(related.length, 1)
})

test('showing up completes a matching activation task, and that counts even on a short clip', () => {
  assert.equal(attendanceCompletesTask({ checkedIn: true, matches: true, alreadyAnswered: false }), true)
  assert.equal(attendanceCompletesTask({ checkedIn: true, matches: true, alreadyAnswered: true }), false)
  assert.equal(attendanceCompletesTask({ checkedIn: false, matches: true, alreadyAnswered: false }), false)
  assert.equal(countsTowardProgress({ level: 'hors', inCourse: true, event: 'watch' }), false)
  assert.equal(countsTowardProgress({ level: 'appetiser', inCourse: true, event: 'question' }), false)
  assert.equal(countsTowardProgress({ level: 'hors', inCourse: true, event: 'question', viaGathering: true }), true)
  assert.equal(countsWithGathering({ level: 'hors', inCourse: false, event: 'question', viaGathering: true }), false)
})

test('circles mix newcomers with regulars and do not return scores', () => {
  const people = [
    { id: 'a', newcomer: false, band: 'gratitude' },
    { id: 'b', newcomer: false, band: 'gratitude' },
    { id: 'c', newcomer: false, band: 'worry' },
    { id: 'd', newcomer: false, band: 'worry' },
    { id: 'e', newcomer: true, band: 'open' },
    { id: 'f', newcomer: true, band: 'open' },
    { id: 'g', newcomer: false, band: 'anger' },
    { id: 'h', newcomer: true, band: 'anger' },
  ]
  const circles = balanceGroups(people)
  assert.ok(circles.length >= 2)
  for (const circle of circles) {
    assert.ok(circle.memberIds.length >= 1)
    assert.equal(JSON.stringify(circle).includes('band'), false)
    assert.equal(JSON.stringify(circle).includes('score'), false)
  }
  const newcomers = new Set(['e', 'f', 'h'])
  for (const circle of circles) {
    const news = circle.memberIds.filter((id) => newcomers.has(id))
    if (news.length === circle.memberIds.length) assert.fail('a circle was only newcomers')
  }
})

test('discussion prompts come from the talk, and a reflection sentence can sit in the harvest', () => {
  const prompts = discussionPrompts([
    { prompt: 'What will you carry?', kind: 'reflection' },
    { prompt: 'Which option?', kind: 'multiple_choice' },
  ])
  assert.deepEqual(prompts, ['What will you carry?'])
  const sentence = reflectionSentence('i will carry the quiet of the circle')
  assert.equal(sentence, 'I will carry the quiet of the circle.')
  assert.equal(harvestLine(sentence || '', sentence || ''), sentence)
  assert.equal(reflectionSentence('Too short'), null)
})

test('calendar files, Google links and cross-post text are ready to send', () => {
  const ics = toIcs({ uid: 'gather-tea@hearts', title: 'Tea and talk', startsAt: '2026-10-08T18:00:00.000Z', place: 'The hall', description: 'Bring nothing', url: 'https://hearts.example/gather/tea' })
  assert.match(ics, /BEGIN:VCALENDAR/)
  assert.match(ics, /SUMMARY:Tea and talk/)
  assert.match(ics, /DTSTART:20261008T180000Z/)
  assert.match(ics, /LOCATION:The hall/)
  const google = googleCalendarUrl({ title: 'Tea and talk', startsAt: '2026-10-08T18:00:00.000Z', place: 'The hall' })
  assert.match(google, /^https:\/\/calendar\.google\.com\//)
  const post = crossPost({ title: 'Tea and talk', when: 'Thursday', place: 'The hall', audience: 'Everyone', url: 'http://127.0.0.1:3010/gather/tea-after-class', linkLabel: 'Discussing W16: Ihsan: worship as though you see Him' })
  assert.match(post, /Discussing W16: Ihsan: Worship as though you see Him/)
  assert.match(post, /Come if you can/)
  assert.doesNotMatch(post, /https?:\/\//)
  assert.doesNotMatch(post, /127\.0\.0\.1|localhost|tea-after-class/)
  const sent = decodeURIComponent(whatsAppHref('http://localhost:3010/gather/circle-after-isha', 'Circle after Isha', 'Thursday'))
  assert.doesNotMatch(sent, /localhost|127\.0\.0\.1|circle-after-isha/)
  assert.match(decodeURIComponent(whatsAppHref('https://hearts.example/gather/circle-after-isha', 'Circle after Isha', 'Thursday')), /https:\/\/hearts\.example\/gather\/circle-after-isha/)
  assert.equal(publicShareUrl('http://127.0.0.1:3010/gather/x'), '')
  assert.equal(publicBaseURL({ NEXT_PUBLIC_SITE_URL: 'https://hearts.example/' }, 'http://localhost:3010'), 'https://hearts.example')
  assert.equal(publicBaseURL({ NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000' }, 'https://masjid.example'), 'https://masjid.example')
  assert.equal(publicBaseURL({}, 'http://localhost:3010'), '')
})

test('London wall time becomes the right instant, and gender defaults follow the title', () => {
  assert.equal(londonIso('2026-01-15T19:00'), '2026-01-15T19:00:00.000Z')
  assert.equal(londonIso('2026-07-15T19:00'), '2026-07-15T18:00:00.000Z')
  assert.equal(londonIso('15/01/2026 19:00'), '2026-01-15T19:00:00.000Z')
  assert.equal(londonIso('15/07/2026 19:00'), '2026-07-15T18:00:00.000Z')
  assert.equal(suggestedAudience('walk', 'Sisters’ walk'), 'sisters')
  assert.equal(suggestedAudience('tea', 'Brothers’ tea'), 'brothers')
  assert.equal(suggestedAudience('picnic', 'Sunday picnic'), 'family')
  assert.equal(suggestedAudience('youth', 'Football'), 'youth')
  assert.match(whenLabel('2026-10-08T18:00:00.000Z'), /Thursday/)
})

test('the desk groups by upcoming and past, then by door, and the demo script refuses every other portal', () => {
  const grouped = groupByDoor([
    { doorLabel: 'W7 · Fasting Ramadan', past: false, startsAt: '2026-10-08T18:00:00.000Z' },
    { doorLabel: 'W7 · Fasting Ramadan', past: true, startsAt: '2026-09-01T18:00:00.000Z' },
    { doorLabel: 'W16 · Ihsan', past: false, startsAt: '2026-10-09T18:00:00.000Z' },
  ])
  assert.equal(grouped.upcoming.length, 2)
  assert.equal(grouped.past.length, 1)
  assert.equal(newcomerFollowUp(3), '3 newcomers came for the first time. Send them a welcome.')
  assert.match(demoPortalGuard('east-london') || '', /hearts-demo/)
  assert.equal(demoPortalGuard('hearts-demo'), null)
  assert.match(linkLabel({ doorCode: 'W7', doorTitle: 'Fasting Ramadan', courseTitle: 'The Names', lessonTitle: 'Class 20' }), /Discussing W7: Fasting Ramadan, after Class 20/)
  assert.match(linkLabel({ doorCode: 'W16', doorTitle: 'Ihsan: worship as though you see Him' }), /Discussing W16: Ihsan: Worship as though you see Him/)
  assert.equal(normaliseEntryCode(' nur4 '), 'NUR4')
  assert.equal(makeEntryCode([0, 1, 2, 3]).length, 4)
})

test('the door poster is one A4 page and keeps the web address inside the code', () => {
  const pdf = qrPosterPdf({
    title: "Sisters' walk",
    when: 'Thursday 15 October at 6:30 pm',
    place: 'The park gate beside the masjid',
    audience: 'Sisters',
    host: 'Amina',
    masjid: 'East London Mosque',
    entryCode: 'SLM5',
    url: 'https://hearts.example/gather/sisters-walk/in?k=abc',
  }).toString('latin1')
  assert.match(pdf, /%PDF-1\.4/)
  assert.match(pdf, /MediaBox \[0 0 595 842\]/)
  assert.match(pdf, /Sisters' walk/)
  assert.match(pdf, /Scan this to check in/)
  assert.match(pdf, /SLM5/)
  assert.match(pdf, /Or type the door code/)
  assert.doesNotMatch(pdf, /sisters-walk/)
})
