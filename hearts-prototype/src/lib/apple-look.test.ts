import assert from 'node:assert/strict'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { APPLE_LOOK_BOOT, appleLookEnabled, appleSurface } from './apple-look'

test('the learner look covers every portal, and leaves the desk alone', () => {
  assert.equal(appleSurface('/p/parenting/courses'), 'courses')
  assert.equal(appleSurface('/p/parenting'), 'home')
  assert.equal(appleSurface('/p/parenting/'), 'home')
  assert.equal(appleSurface('/p/hearts-demo'), 'home')
  assert.equal(appleSurface('/p/hearts-demo/courses'), 'courses')
  assert.equal(appleSurface('/p/east-london/lanes'), 'courses')
  assert.equal(appleSurface('/p/parenting/course/33'), 'course')
  assert.equal(appleSurface('/p/parenting/course/33', '?part=9'), 'player')
  assert.equal(appleSurface('/p/hearts-demo/course/12', 'part=4&look=off'), 'player')
  assert.equal(appleSurface('/p/parenting/week'), 'week')
  assert.equal(appleSurface('/p/parenting/me'), 'me')
  assert.equal(appleSurface('/p/parenting/me/settings'), 'me')
  assert.equal(appleSurface('/p/parenting/welcome'), 'signin')
  assert.equal(appleSurface('/login'), 'signin')
  assert.equal(appleSurface('/join'), 'signin')
  assert.equal(appleSurface('/p/parenting/feed'), 'home')
  assert.equal(appleSurface('/master'), '')
  assert.equal(appleSurface('/master/'), '')
  assert.equal(appleSurface('/master/learners'), '')
  assert.equal(appleSurface('/admin'), '')
  assert.equal(appleSurface('/admin/collections/courses'), '')
  assert.equal(appleSurface('/admin/login'), '')
})

test('the look is the default and ?look=off is the fallback', () => {
  assert.equal(appleLookEnabled(null, ''), true)
  assert.equal(appleLookEnabled('apple', ''), true)
  assert.equal(appleLookEnabled(null, 'hh_look=apple'), true)
  assert.equal(appleLookEnabled(null, 'hh_look=off'), false)
  assert.equal(appleLookEnabled('off', 'hh_look=apple'), false)
  assert.equal(appleLookEnabled('apple', 'hh_look=off'), true)
  assert.equal(appleLookEnabled('something', ''), true)
})

function boot(pathname: string, search = '', cookie = '') {
  const dataset: Record<string, string | undefined> = {}
  const document = { cookie, documentElement: { dataset } }
  const location = { pathname, search: search ? (search.startsWith('?') ? search : `?${search}`) : '' }
  runInNewContext(APPLE_LOOK_BOOT, { document, location, URLSearchParams })
  return { look: dataset.look || '', surface: dataset.lookSurface || '' }
}

test('the first paint matches the learner default', () => {
  assert.deepEqual(boot('/p/hearts-demo/courses'), { look: 'apple', surface: 'courses' })
  assert.deepEqual(boot('/p/parenting/week'), { look: 'apple', surface: 'week' })
  assert.deepEqual(boot('/p/parenting/course/78', 'part=9'), { look: 'apple', surface: 'player' })
  assert.deepEqual(boot('/login'), { look: 'apple', surface: 'signin' })
  assert.deepEqual(boot('/p/parenting/courses', 'look=off'), { look: '', surface: '' })
  assert.deepEqual(boot('/p/parenting/courses', '', 'hh_look=off'), { look: '', surface: '' })
  assert.deepEqual(boot('/p/parenting/courses', 'look=apple', 'hh_look=off'), { look: 'apple', surface: 'courses' })
  assert.deepEqual(boot('/admin'), { look: '', surface: '' })
  assert.deepEqual(boot('/admin/collections/courses'), { look: '', surface: '' })
  assert.deepEqual(boot('/master/learners'), { look: '', surface: '' })
})
