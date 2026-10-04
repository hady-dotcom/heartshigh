import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dir = mkdtempSync(path.join(tmpdir(), 'hearts-live-'))
process.env.DATABASE_URL = `file:${path.join(dir, 'hearts.db')}`
process.env.DATABASE_ADAPTER = 'sqlite'
process.env.PAYLOAD_SECRET = 'live-seed-test-secret-32-characters'
Object.assign(process.env, { NODE_ENV: 'test' })

test('demo:live writes only hearts-demo, never touches passwords, and a second run does not duplicate', { timeout: 180_000 }, async () => {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config')
  const { seedLiveDemo } = await import('../../src/seed/live-demo')
  const payload = await getPayload({ config })
  const other = await payload.create({
    collection: 'portals',
    overrideAccess: true,
    data: { name: 'Other masjid', slug: 'other-masjid', kind: 'mosque', wizardDone: true } as never,
  })
  const missing = await seedLiveDemo(payload)
  assert.equal(missing.ok, false)

  const demo = await payload.create({
    collection: 'portals',
    overrideAccess: true,
    data: { name: 'Hearts demo', slug: 'hearts-demo', kind: 'mosque', wizardDone: true } as never,
  })
  const teacher = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: { email: 'demo-teacher@hearts.foundation', password: 'keep-this-password', name: 'Idris Rahman', role: 'teacher', tenants: [{ tenant: demo.id }] } as never,
  })
  const first = await seedLiveDemo(payload, { live: true })
  assert.equal(first.ok, true)
  if (!first.ok) return
  assert.equal(first.created, 2)
  const second = await seedLiveDemo(payload, { live: true })
  assert.equal(second.ok, true)
  if (!second.ok) return
  assert.equal(second.created, 0)
  assert.equal(second.reused, 2)
  const rows = await payload.find({ collection: 'live-sessions' as 'users', overrideAccess: true, depth: 0, limit: 20, where: { portal: { equals: demo.id } } })
  assert.equal(rows.docs.length, 2)
  assert.ok(rows.docs.some((row) => String((row as { status?: string }).status) === 'scheduled'))
  assert.ok(rows.docs.some((row) => String((row as { status?: string }).status) === 'live'))
  const leaked = await payload.find({ collection: 'live-sessions' as 'users', overrideAccess: true, depth: 0, limit: 10, where: { portal: { equals: other.id } } })
  assert.equal(leaked.docs.length, 0)
  const same = await payload.findByID({ collection: 'users', id: teacher.id, overrideAccess: true, depth: 0 })
  assert.equal((same as { email?: string }).email, 'demo-teacher@hearts.foundation')
  assert.equal((same as { name?: string }).name, 'Idris Rahman')
})
