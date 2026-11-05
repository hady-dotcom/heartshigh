import assert from 'node:assert/strict'
import { test } from 'node:test'

const url = process.env.HEARTS_POSTGRES_TEST_URL || ''

test('a throwaway Postgres database can migrate and then save a lesson and a user', async (t) => {
  if (!url.startsWith('postgres')) {
    t.skip('Set HEARTS_POSTGRES_TEST_URL to a throwaway local Postgres database.')
    return
  }
  process.env.DATABASE_URL = url
  process.env.DATABASE_ADAPTER = 'postgres'
  process.env.PAYLOAD_SECRET = 'hearts-lock-smoke-secret-not-for-production'
  delete process.env.HEARTS_DB_PUSH

  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config')
  const { closePayload } = await import('../../src/lib/prepare-db')
  const payload = await getPayload({ config })
  try {
    await payload.db.migrate()
    const stamp = Date.now()
    const user = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: `lock-${stamp}@hearts.test`,
        password: 'lock-smoke-pass-not-demo',
        name: 'Lock smoke',
        role: 'learner',
      },
    })
    await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { name: 'Lock smoke saved' } })
    const course = await payload.create({
      collection: 'courses',
      overrideAccess: true,
      data: { title: `Lock smoke ${stamp}`, origin: 'master', visibility: 'published', importable: true },
    })
    const unit = await payload.create({
      collection: 'units',
      overrideAccess: true,
      data: { title: 'Talks', course: course.id, order: 1 },
    })
    const lesson = await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: { title: 'Lock smoke talk', unit: unit.id, course: course.id, master: true, order: 1, publishState: 'published' },
    })
    const saved = await payload.update({
      collection: 'lessons',
      id: lesson.id,
      overrideAccess: true,
      data: { title: 'Lock smoke talk saved' },
    })
    assert.equal((saved as { title?: string }).title, 'Lock smoke talk saved')
    const userSaved = await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true })
    assert.equal((userSaved as { name?: string }).name, 'Lock smoke saved')
  } finally {
    await closePayload(payload)
  }
})
