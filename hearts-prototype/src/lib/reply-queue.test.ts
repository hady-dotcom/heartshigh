import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildQueueCards,
  earlierCards,
  filterQueue,
  leftCount,
  nextUnanswered,
  queuePath,
  queueStatus,
  shownWhen,
  stepCard,
  type QueueCard,
} from './reply-queue'

function card(partial: Partial<QueueCard> & Pick<QueueCard, 'id' | 'learnerId'>): QueueCard {
  return {
    entryId: partial.id,
    learner: partial.learnerId === 2 ? 'Hamza Ali' : 'Maryam Begum',
    portalId: 1,
    portal: 'East London Mosque',
    portalSlug: 'east-london',
    talk: 'The Names',
    minute: '4:12',
    second: 252,
    lessonId: 9,
    courseId: 3,
    question: 'Where did you meet that line?',
    answer: `Answer ${partial.id}`,
    reply: '',
    done: false,
    at: '2026-10-02T10:00:00.000Z',
    ...partial,
  }
}

const maryam = card({ id: 1, learnerId: 1, at: '2026-10-01T10:00:00.000Z', reply: 'Thank you.', answer: 'I sat with my uncle.' })
const hamza = card({ id: 2, learnerId: 2, at: '2026-10-04T10:00:00.000Z', answer: 'I greeted the person on the bus.' })
const maryamOpen = card({ id: 3, learnerId: 1, at: '2026-10-03T10:00:00.000Z', answer: 'The house goes quiet before suhoor.' })
const leeds = card({ id: 4, learnerId: 5, portalId: 2, portal: 'Leeds Chapter', portalSlug: 'leeds', at: '2026-10-02T12:00:00.000Z', answer: 'I walked to fajr.' })
const done = card({ id: 5, learnerId: 2, at: '2026-10-05T10:00:00.000Z', done: true, answer: 'Left my phone in the kitchen.' })
const kept = { id: 6, learnerId: 1, keepPrivate: true, shareWithTeacher: false, body: 'Just for me.', createdAt: '2026-10-06T10:00:00.000Z', user: { id: 1, name: 'Maryam Begum' }, portal: { id: 1 } }

const rows = [maryam, hamza, maryamOpen, leeds, done]

test('the queue keeps unanswered, all, and answered apart, and counts what is left', () => {
  assert.equal(queueStatus(undefined), 'unanswered')
  assert.equal(queueStatus('all'), 'all')
  assert.equal(queueStatus('answered'), 'answered')
  assert.equal(queueStatus('nope'), 'unanswered')
  const east = { portalSlug: 'east-london', learnerId: null }
  assert.deepEqual(filterQueue(rows, { status: 'unanswered', ...east }).map((item) => item.id), [2, 3])
  assert.deepEqual(filterQueue(rows, { status: 'answered', ...east }).map((item) => item.id), [5, 1])
  assert.deepEqual(filterQueue(rows, { status: 'all', portalSlug: null, learnerId: 2 }).map((item) => item.id), [5, 2])
  assert.deepEqual(filterQueue(rows, { status: 'all', portalSlug: 'leeds', learnerId: null }).map((item) => item.id), [4])
  assert.equal(leftCount(rows, east), 2)
  assert.equal(leftCount(rows, { portalSlug: 'leeds', learnerId: null }), 1)
})

test('send moves to the next unanswered card, and J and K step through the list', () => {
  const east = { portalSlug: 'east-london', learnerId: null }
  assert.equal(nextUnanswered(rows, 3, east)?.id, 2)
  assert.equal(nextUnanswered(rows, 2, east)?.id, 3)
  assert.equal(nextUnanswered(rows, 1, east)?.id, 2)
  assert.equal(nextUnanswered([maryam], 1, east), null)
  const visible = filterQueue(rows, { status: 'unanswered', ...east })
  assert.deepEqual(visible.map((item) => item.id), [2, 3])
  assert.equal(stepCard(visible, 2, 1)?.id, 3)
  assert.equal(stepCard(visible, 3, -1)?.id, 2)
  assert.equal(stepCard(visible, 3, 1), null)
  assert.equal(stepCard(visible, 0, 1)?.id, 2)
  assert.equal(stepCard([], 1, 1), null)
})

test('earlier answers are the same learner, older, newest first', () => {
  const earlier = earlierCards(rows, maryamOpen)
  assert.deepEqual(earlier.map((item) => item.id), [1])
  assert.equal(earlierCards(rows, hamza).length, 0)
})

test('a fresh reply reads as now, and an older one does not', () => {
  const at = new Date('2026-10-14T12:00:00.000Z')
  assert.equal(shownWhen('2026-10-14T11:59:10.000Z', at), 'now')
  assert.equal(shownWhen('2026-10-14T11:57:00.000Z', at), '')
  assert.equal(shownWhen('', at), '')
  assert.equal(queuePath('/p/east-london/admin/teach', { status: 'unanswered' }), '/p/east-london/admin/teach')
  assert.equal(queuePath('/p/east-london/admin/teach', { status: 'all', portal: 'all', learnerId: 2, answerId: 9 }), '/p/east-london/admin/teach?queue=all&queuePortal=all&learner=2&answer=9')
})

test('private answers never become cards, and a done mark is kept', () => {
  const cards = buildQueueCards([
    { id: 10, createdAt: '2026-10-04T10:00:00.000Z', body: 'I greeted the person on the bus.', shareWithTeacher: true, keepPrivate: false, atSecond: 90, user: { id: 2, name: 'Hamza Ali' }, lesson: { id: 4, title: 'How to Live — by Shaykh', course: 8 }, point: { prompt: 'What did you try?', second: 90 }, portal: 1 },
    kept as never,
  ], [
    { id: 70, answer: 10, consent: true, teacherReply: '', doneAt: '2026-10-14T12:00:00.000Z' },
    { id: 71, answer: 6, consent: false, teacherReply: 'no' },
  ], [{ id: 1, name: 'East London Mosque', slug: 'east-london', organisationName: 'East London Mosque' }])
  assert.equal(cards.length, 1)
  assert.equal(cards[0].done, true)
  assert.equal(cards[0].learner, 'Hamza Ali')
  assert.equal(cards[0].minute, '1:30')
  assert.equal(cards[0].courseId, 8)
  assert.equal(cards[0].answer.includes('Just for me'), false)
  assert.equal(cards[0].talk.includes('by Shaykh'), false)
})
