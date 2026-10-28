import assert from 'node:assert/strict'
import test from 'node:test'
import { appleLookEnabled, appleSurface } from './apple-look'

test('apple colour stays off every other route', () => {
  assert.equal(appleSurface('/p/parenting/courses'), 'courses')
  assert.equal(appleSurface('/p/parenting'), 'home')
  assert.equal(appleSurface('/p/parenting/'), 'home')
  assert.equal(appleSurface('/p/parenting/course/33'), 'course')
  assert.equal(appleSurface('/p/parenting/course/33', '?part=9'), 'player')
  assert.equal(appleSurface('/p/parenting/course/33', 'part=9&look=apple'), 'player')
  assert.equal(appleSurface('/p/parenting/week'), '')
  assert.equal(appleSurface('/p/parenting/me'), '')
  assert.equal(appleSurface('/p/parenting/feed'), '')
  assert.equal(appleSurface('/p/hearts-demo/courses'), '')
  assert.equal(appleSurface('/p/east-london'), '')
  assert.equal(appleSurface('/master'), 'master')
  assert.equal(appleSurface('/master/'), 'master')
  assert.equal(appleSurface('/master/learners'), '')
  assert.equal(appleSurface('/admin'), 'cms')
  assert.equal(appleSurface('/admin/collections/courses'), '')
  assert.equal(appleSurface('/admin/login'), '')
})

test('the look is opt-in and can be switched off', () => {
  assert.equal(appleLookEnabled(null, ''), false)
  assert.equal(appleLookEnabled('apple', ''), true)
  assert.equal(appleLookEnabled(null, 'hh_look=apple'), true)
  assert.equal(appleLookEnabled('off', 'hh_look=apple'), false)
  assert.equal(appleLookEnabled('something', 'theme=evening'), false)
})
