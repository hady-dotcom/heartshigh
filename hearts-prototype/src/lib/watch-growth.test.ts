import assert from 'node:assert/strict'
import { test } from 'node:test'
import { activityDay, countedTalkCompletions, doorsLitByCuts, gardenPathNodes, growthLessonIds, watchedLessonIds } from './watch-growth'

test('the watched ring counts a sitting even when the completion is still missing', () => {
  const ids = watchedLessonIds({
    completions: [],
    sessions: [{ lesson: 11, seconds: 90 }, { lesson: 12, seconds: 0 }, { lesson: { id: 11 }, seconds: 12 }],
  })
  assert.deepEqual([...ids].sort((a, b) => a - b), [11])
})

test('a finished talk and a partial sitting both count as watched', () => {
  const ids = watchedLessonIds({
    completions: [{ lesson: 4, sourceLevel: 'talk' }],
    sessions: [{ lesson: 9, seconds: 40 }],
  })
  assert.deepEqual([...ids].sort((a, b) => a - b), [4, 9])
})

test('parts watched keep only full talks that sit in a course', () => {
  const counted = countedTalkCompletions({
    completions: [
      { lesson: 1, sourceLevel: 'talk' },
      { lesson: 2, sourceLevel: 'appetiser' },
      { lesson: 3, sourceLevel: 'talk' },
      { lesson: 4, sourceLevel: 'talk' },
    ],
    courseByLesson: new Map([
      [1, 10],
      [2, 10],
      [3, null],
    ]),
  })
  assert.deepEqual(counted.map((row) => row.lesson), [1])
})

test('Garden days prefer the sitting or answer time over the row time', () => {
  assert.equal(activityDay({ watchedAt: '2026-10-03T18:00:00.000Z', createdAt: '2026-10-05T12:00:00.000Z' }), '2026-10-03')
  assert.equal(activityDay({ answeredAt: '2026-09-28T09:00:00.000Z', createdAt: '2026-10-05T12:00:00.000Z' }), '2026-09-28')
  assert.equal(activityDay({ createdAt: '2026-10-01T08:00:00.000Z' }), '2026-10-01')
})

test('Your path lists only the talks in this course, in course order', () => {
  const watched = [
    { id: 4, title: 'Sheltered', href: '/c/1?part=4', done: true },
    { id: 9, title: 'Tawakkul', href: '/c/2?part=9', done: true },
    { id: 12, title: 'Dua 1', href: '/c/3?part=12', done: true },
  ]
  const sheltered = [
    { id: 4, title: 'Sheltered', href: '/c/1?part=4', done: false },
    { id: 5, title: 'Next part', href: '/c/1?part=5', done: false },
    { id: 6, title: 'Later part', href: '/c/1?part=6', done: true },
  ]
  const nodes = gardenPathNodes(watched, sheltered)
  assert.deepEqual(nodes.map((row) => ({ id: row.id, state: row.state })), [
    { id: 4, state: 'done' },
    { id: 5, state: 'active' },
    { id: 6, state: 'done' },
  ])
  assert.equal(nodes.some((row) => row.id === 9 || row.id === 12), false)

  const tawakkul = [
    { id: 9, title: 'Tawakkul', href: '/c/2?part=9', done: true },
    { id: 10, title: 'Trust', href: '/c/2?part=10', done: false },
  ]
  const switched = gardenPathNodes(watched, tawakkul)
  assert.deepEqual(switched.map((row) => ({ id: row.id, state: row.state })), [
    { id: 9, state: 'done' },
    { id: 10, state: 'active' },
  ])
})

test('a sitting or an answer on a cut lights that door’s section', () => {
  const lit = doorsLitByCuts({
    cuts: [{ lesson: 4, bestClause: 22 }, { lesson: 9, bestClause: 15 }],
    watched: new Set([4]),
    done: new Set([4]),
    answered: new Set([9]),
    doorOf: (clause) => (clause === 22 ? 10 : clause === 15 ? 5 : null),
  })
  assert.deepEqual([...lit.lit].sort((a, b) => a - b), [10])
  assert.deepEqual([...lit.activityLit].sort((a, b) => a - b), [5, 10])
})

test('growth loads the sitting lesson so a completion can be placed in its course', () => {
  assert.deepEqual(
    growthLessonIds({
      completions: [{ lesson: 1 }],
      visits: [{ lesson: 2 }],
      answers: [{ lesson: 3 }],
      sessions: [{ lesson: 4, seconds: 20 }],
    }).sort((a, b) => a - b),
    [1, 2, 3, 4],
  )
})
