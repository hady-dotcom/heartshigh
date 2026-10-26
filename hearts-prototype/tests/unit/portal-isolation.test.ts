import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { courseOnPortal } from '../../src/lib/portal-courses'

const root = new URL('../../', import.meta.url)

test('a local course stays on its own portal', () => {
  const hady = { id: 76, origin: 'local', portal: 2 }
  const hearts = { id: 4, origin: 'local', portal: 1 }
  const library = { id: 9, origin: 'library', portal: null }
  const adopted = new Set([9])
  assert.equal(courseOnPortal(hady, 2, adopted), true)
  assert.equal(courseOnPortal(hady, 1, adopted), false)
  assert.equal(courseOnPortal(hady, 1, new Set([76])), false)
  assert.equal(courseOnPortal(hearts, 1, adopted), true)
  assert.equal(courseOnPortal(library, 1, adopted), true)
  assert.equal(courseOnPortal(library, 1, new Set()), false)
})

test('learner routes pass the portal into the course list', () => {
  const read = (file: string) => readFileSync(new URL(file, root), 'utf8')
  const visible = read('src/server/context.ts')
  const fn = visible.slice(visible.indexOf('export async function visibleCourseIds'), visible.indexOf('export function idList'))
  assert.match(fn, /viewing/)
  assert.match(fn, /courseOnPortal/)
  assert.match(fn, /user\.role === 'master' && !viewing/)
  assert.match(read('src/screens/app/course-home.tsx'), /visibleCourseIds\(payload, user, portal\.id\)/)
  assert.match(read('src/screens/app/course.tsx'), /visibleCourseIds\(payload, user, portal\.id\)/)
  assert.match(read('src/server/week-plan.ts'), /visibleCourseIds\(payload, user, portal\.id\)/)
  assert.match(read('src/server/week-plan.ts'), /allowed\.has\(courseId\)/)
  assert.doesNotMatch(fn, /if \(user\.role === 'master'\) \{\s*const all/)
})
