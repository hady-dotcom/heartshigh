import assert from 'node:assert/strict'
import { test } from 'node:test'
import { afterJoinPath, deskAppHref, portalHomePath, staffDeskHref } from './landing'

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
  const here = { id: 4, slug: 'hearts-demo' }
  assert.equal(staffDeskHref({ role: 'teacher', tenants: [{ tenant: 4 }] }, here), '/p/hearts-demo/admin/teach')
  assert.equal(staffDeskHref({ role: 'portal-admin', tenants: [{ tenant: 4 }] }, here), '/p/hearts-demo/admin')
  assert.equal(staffDeskHref({ role: 'learner', tenants: [{ tenant: 4 }] }, here), null)
  assert.equal(staffDeskHref({ role: 'teacher', tenants: [{ tenant: 4 }] }, { id: 9, slug: 'other' }), null)
  assert.equal(staffDeskHref({ role: 'master' }, here), null)
  assert.equal(staffDeskHref(null, here), null)
})
