import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dir = mkdtempSync(path.join(tmpdir(), 'hearts-gather-'))
process.env.DATABASE_URL = `file:${path.join(dir, 'hearts.db')}`
process.env.DATABASE_ADAPTER = 'sqlite'
process.env.PAYLOAD_SECRET = 'gather-seed-test-secret-32-characters'
Object.assign(process.env, { NODE_ENV: 'test' })

test('demo:gather writes only hearts-demo, and a second run does not duplicate', { timeout: 180_000 }, async () => {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config')
  const { seedGatherDemo } = await import('../../src/seed/gather-demo')
  const payload = await getPayload({ config })
  const other = await payload.create({
    collection: 'portals',
    overrideAccess: true,
    data: { name: 'Other masjid', slug: 'other-masjid', kind: 'mosque', wizardDone: true } as never,
  })
  const missing = await seedGatherDemo(payload)
  assert.equal(missing.ok, false)
  const untouched = await payload.find({ collection: 'gatherings', overrideAccess: true, depth: 0, limit: 10, where: { portal: { equals: other.id } } })
  assert.equal(untouched.docs.length, 0)

  const demo = await payload.create({
    collection: 'portals',
    overrideAccess: true,
    data: { name: 'Hearts demo', slug: 'hearts-demo', kind: 'mosque', wizardDone: true } as never,
  })
  const learner = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: { email: 'demo-learner@hearts.foundation', password: 'a-long-demo-password', name: 'Amina Yusuf', role: 'learner', tenants: [{ tenant: demo.id }] } as never,
  })
  const first = await seedGatherDemo(payload)
  assert.equal(first.ok, true)
  if (!first.ok) return
  assert.equal(first.created, 8)
  const second = await seedGatherDemo(payload)
  assert.equal(second.ok, true)
  if (!second.ok) return
  assert.equal(second.created, 0)
  assert.equal(second.reused, 8)
  const rows = await payload.find({ collection: 'gatherings', overrideAccess: true, depth: 0, limit: 20, where: { portal: { equals: demo.id } } })
  assert.equal(rows.docs.length, 8)
  const stillOther = await payload.find({ collection: 'gatherings', overrideAccess: true, depth: 0, limit: 10, where: { portal: { equals: other.id } } })
  assert.equal(stillOther.docs.length, 0)
  const rsvps = await payload.find({ collection: 'gather-rsvps', overrideAccess: true, depth: 0, limit: 50, where: { user: { equals: learner.id } } })
  assert.ok(rsvps.docs.length >= 8)
  const leaked = await payload.find({ collection: 'gather-rsvps', overrideAccess: true, depth: 0, limit: 5, where: { and: [{ user: { equals: learner.id } }, { portal: { not_equals: demo.id } }] } })
  assert.equal(leaked.docs.length, 0)
})
