import assert from 'node:assert/strict'
import test from 'node:test'
import { coverSlug, needsCover, resolveSuppliedCover } from './supplied-cover'

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
  const frames = new Set(['/covers/welcome-16x9.jpg', '/covers/welcome-4x5.jpg'])
  const frameExists = (file: string) => frames.has(file)
  const hady = { courses: { '78': { wide: 'welcome-16x9.jpg', tall: 'welcome-4x5.jpg' } } }
  assert.equal(resolveSuppliedCover({ root: '/covers', kind: 'course', id: 78, title: 'Welcome', frame: 'wide', index: hady, exists: frameExists }), '/covers/welcome-16x9.jpg')
  assert.equal(resolveSuppliedCover({ root: '/covers', kind: 'film', id: 400, title: 'How to use this course', frame: 'tall', courseId: 78, index: hady, exists: frameExists }), '/covers/welcome-4x5.jpg')
  assert.equal(resolveSuppliedCover({ root: '/covers', kind: 'film', id: 400, title: 'How to use this course', frame: 'tall', courseId: 33, courseTitle: 'Welcome', index: { courses: { welcome: { wide: 'welcome-16x9.jpg', tall: 'welcome-4x5.jpg' } } }, exists: frameExists }), '/covers/welcome-4x5.jpg')
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

test('a course needs a cover until a photograph is uploaded or supplied', () => {
  assert.equal(needsCover({ kind: 'course', id: 78, title: 'Welcome' }), false)
  assert.equal(needsCover({ kind: 'course', id: 99999, title: 'Brand new course' }), true)
  assert.equal(needsCover({ kind: 'course', id: 99999, title: 'Brand new course', uploaded: true }), false)
  assert.equal(needsCover({ kind: 'film', id: 5, title: 'A film', courseId: 78, courseTitle: 'Welcome' }), false)
  assert.equal(needsCover({ kind: 'film', id: 5, title: 'A film', courseId: 99999, courseTitle: 'Brand new course' }), true)
})
