import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { reversedTalkCourses, sortParts, talkSequenceNumber } from '../../src/lib/part-order'

test('course parts follow the order field, not the unit they sit in', () => {
  const orders = [2, 3, 1, 5, 6, 8, 4, 7]
  const lessons = orders.map((order, index) => ({ id: index + 1, order, unit: index % 2 }))
  assert.deepEqual(
    sortParts(lessons, (row) => row.unit).map((row) => row.order),
    [1, 2, 3, 4, 5, 6, 7, 8],
  )
})

test('Manners of the Salaf follows Ep 1 then Ep 2, not the stored lesson order', () => {
  const lessons = [
    { id: 40, order: 1, title: '[Ep 2] Humility In Practice | Manners of the Salaf | Sh. Mohammad Elshinawy' },
    { id: 41, order: 2, title: '[Ep 1] The Primacy of Adab | Manners of the Salaf | Sh. Mohammad Elshinawy' },
  ]
  assert.deepEqual(
    sortParts(lessons).map((row) => row.title?.slice(0, 6)),
    ['[Ep 1]', '[Ep 2]'],
  )
})

test('talk sequence reads [Ep N], Ep. N, Part N and Session N', () => {
  assert.equal(talkSequenceNumber('[Ep 2] Humility In Practice'), 2)
  assert.equal(talkSequenceNumber('Ep. 1: Know Your Purpose'), 1)
  assert.equal(talkSequenceNumber('Anger Management (Part 3)'), 3)
  assert.equal(talkSequenceNumber('How to Live Like the Prophet, Session 6'), 6)
  assert.equal(talkSequenceNumber('The Names Class 19: Ar-Rabb'), 19)
  assert.equal(talkSequenceNumber('Our Character | Day 2'), 2)
  assert.equal(talkSequenceNumber('A talk with no number'), null)
  assert.equal(talkSequenceNumber('13 Centuries of Islamic History: Week 1 - Part 6/8'), null)
})

test('an explicit episode field wins over the title, then publish date, then stored order', () => {
  assert.deepEqual(
    sortParts([
      { id: 1, order: 1, episode: 2, title: '[Ep 1] First on the title' },
      { id: 2, order: 2, episode: 1, title: '[Ep 2] Second on the title' },
    ]).map((row) => row.id),
    [2, 1],
  )
  assert.deepEqual(
    sortParts([
      { id: 1, order: 1, title: 'Later upload', publishedAt: '2023-09-15T00:00:00.000Z' },
      { id: 2, order: 2, title: 'Earlier upload', publishedAt: '2023-09-01T00:00:00.000Z' },
    ]).map((row) => row.id),
    [2, 1],
  )
  assert.deepEqual(
    sortParts([
      { id: 2, order: 1, title: 'Created first' },
      { id: 1, order: 2, title: 'Created second' },
    ]).map((row) => row.id),
    [2, 1],
  )
})

test('reversedTalkCourses lists live-style Manners of the Salaf and leaves a numbered series alone', () => {
  const found = reversedTalkCourses([
    {
      title: 'Manners of the Salaf',
      lessons: [
        { id: 1, order: 1, title: '[Ep 2] Humility In Practice' },
        { id: 2, order: 2, title: '[Ep 1] The Primacy of Adab' },
      ],
    },
    {
      title: 'How to Live Like the Prophet',
      lessons: [
        { id: 3, order: 1, title: 'How to Live Like the Prophet, Session 1' },
        { id: 4, order: 2, title: 'How to Live Like the Prophet, Session 6' },
      ],
    },
  ])
  assert.deepEqual(found.map((row) => row.title), ['Manners of the Salaf'])
  assert.equal(found[0]?.talk[0]?.title, '[Ep 1] The Primacy of Adab')
})

test('The Common Man\'s Tafsir follows Class 1 to Class 19, not newest-first import order', () => {
  const lessons = [19, 18, 1].map((n, index) => ({
    id: index + 1,
    order: index + 1,
    title: `The Common Man's Tafsir - Class ${n}`,
  }))
  assert.deepEqual(
    sortParts(lessons).map((row) => talkSequenceNumber(row.title)),
    [1, 18, 19],
  )
})

test('the lane end card sits above the More pill', () => {
  const css = readFileSync(new URL('../../src/app/(frontend)/journey.css', import.meta.url), 'utf8')
  const endCard = css.slice(css.indexOf('\n.end-card {'), css.indexOf('\n.end-card {') + 220)
  const more = css.slice(css.indexOf('\n.j-more-tab {'), css.indexOf('\n.j-more-tab {') + 280)
  const endBottom = Number(/\bbottom: calc\((\d+)px/.exec(endCard)?.[1])
  const moreBottom = Number(/\bbottom: calc\((\d+)px/.exec(more)?.[1])
  const moreMinHeight = Number(/\bmin-height: (\d+)px/.exec(more)?.[1])
  assert.ok(endBottom >= moreBottom + moreMinHeight + 16, `end-card bottom ${endBottom} overlaps More at ${moreBottom}+${moreMinHeight}`)
})
