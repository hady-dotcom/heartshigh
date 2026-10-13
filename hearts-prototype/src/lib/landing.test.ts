import assert from 'node:assert/strict'
import { test } from 'node:test'
import { afterJoinPath, deskAppHref, portalHomePath } from './landing'

test('teachers land on Teach, learners stay in the app, portal admins keep the desk', () => {
  assert.equal(portalHomePath('hearts-demo', 'teacher'), '/p/hearts-demo/admin/teach')
  assert.equal(portalHomePath('hearts-demo', 'learner'), '/p/hearts-demo')
  assert.equal(portalHomePath('hearts-demo', 'portal-admin'), '/p/hearts-demo/admin')
  assert.equal(afterJoinPath('hearts-demo', 'teacher'), '/p/hearts-demo/admin/teach')
  assert.equal(afterJoinPath('hearts-demo', 'learner'), '/p/hearts-demo/welcome')
  assert.equal(afterJoinPath('hearts-demo', 'parent'), '/p/hearts-demo/welcome')
  assert.equal(afterJoinPath('hearts-demo', 'admin'), '/p/hearts-demo/admin')
  assert.equal(deskAppHref('/p/hearts-demo/admin'), '/p/hearts-demo')
  assert.equal(deskAppHref('/master'), null)
})
