import assert from 'node:assert/strict'
import { test } from 'node:test'
import { afterJoinPath, deskAppHref, portalHomePath } from './landing'

test('teachers land in the learner app, portal admins keep the desk', () => {
  assert.equal(portalHomePath('hearts-demo', 'teacher'), '/p/hearts-demo')
  assert.equal(portalHomePath('hearts-demo', 'learner'), '/p/hearts-demo')
  assert.equal(portalHomePath('hearts-demo', 'portal-admin'), '/p/hearts-demo/admin')
  assert.equal(afterJoinPath('hearts-demo', 'teacher'), '/p/hearts-demo')
  assert.equal(afterJoinPath('hearts-demo', 'learner'), '/p/hearts-demo/welcome')
  assert.equal(afterJoinPath('hearts-demo', 'admin'), '/p/hearts-demo/admin')
  assert.equal(deskAppHref('/p/hearts-demo/admin'), '/p/hearts-demo')
  assert.equal(deskAppHref('/master'), null)
})
