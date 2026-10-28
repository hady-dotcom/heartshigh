import assert from 'node:assert/strict'
import test from 'node:test'
import { coverSlug, resolveSuppliedCover } from './supplied-cover'

test('a supplied photograph is found by title, by id, or by the index', () => {
  const files = new Set([
    '/covers/course/welcome.jpg',
    '/covers/film/91.png',
    '/covers/custom/kitchen.jpg',
  ])
  const exists = (file: string) => files.has(file)
  assert.equal(coverSlug('Working with your Child'), 'working-with-your-child')
  assert.equal(resolveSuppliedCover({ root: '/covers', kind: 'course', id: 4, title: 'Welcome', exists }), '/covers/course/welcome.jpg')
  assert.equal(resolveSuppliedCover({ root: '/covers', kind: 'film', id: 91, title: 'How to use this course', exists }), '/covers/film/91.png')
  assert.equal(resolveSuppliedCover({
    root: '/covers',
    kind: 'course',
    id: 8,
    title: 'Preparation and resources',
    index: { courses: { 'preparation-and-resources': 'custom/kitchen.jpg' } },
    exists,
  }), '/covers/custom/kitchen.jpg')
  assert.equal(resolveSuppliedCover({ root: '/covers', kind: 'course', id: 8, title: 'Preparation and resources', exists }), null)
})

test('a supplied path cannot leave the cover folder', () => {
  const exists = (file: string) => file.includes('passwd')
  assert.equal(resolveSuppliedCover({
    root: '/covers',
    kind: 'course',
    id: 1,
    title: 'Welcome',
    index: { courses: { welcome: '../../etc/passwd.jpg' } },
    exists,
  }), null)
})
