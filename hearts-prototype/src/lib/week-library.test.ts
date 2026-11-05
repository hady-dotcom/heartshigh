import assert from 'node:assert/strict'
import test from 'node:test'
import { carryFilm, progressPercent, withPhoneProgress, type WeekSection } from './week-library'

const sections: WeekSection[] = [
  {
    title: 'Guiding Home Learning',
    courses: [
      {
        id: 78,
        title: 'Welcome',
        sheetTitle: 'Guiding Home Learning',
        sheetOrder: 1,
        count: 2,
        lengthLabel: ' · 8:26',
        href: '/p/parenting/course/78',
        poster: null,
        filmTitle: 'How to use this course',
        place: 1,
        finished: 2,
        films: [
          { id: 140, title: 'How to use this course', place: 1, href: '/film/140', done: true },
          { id: 443, title: 'Implementing advice', place: 2, href: '/film/443', done: true },
        ],
      },
      {
        id: 79,
        title: 'Preparation and resources',
        sheetTitle: 'Guiding Home Learning',
        sheetOrder: 2,
        count: 2,
        lengthLabel: '',
        href: '/p/parenting/course/79',
        poster: null,
        filmTitle: 'Preparations',
        place: 1,
        finished: 0,
        films: [
          { id: 142, title: 'Preparations', place: 1, href: '/film/142', done: false },
          { id: 444, title: 'Child centred', place: 2, href: '/film/444', done: false },
        ],
      },
    ],
  },
]

test('progress is the share of films finished', () => {
  assert.equal(progressPercent(0, 2), 0)
  assert.equal(progressPercent(1, 2), 50)
  assert.equal(progressPercent(2, 2), 100)
  assert.equal(withPhoneProgress(sections[0].courses[1], new Set([142])).finished, 1)
})

test('carry on skips a finished course and opens the next film', () => {
  const carry = carryFilm(sections)
  assert.equal(carry?.course.title, 'Preparation and resources')
  assert.equal(carry?.film.id, 142)
  assert.equal(carry?.finished, 0)
})
