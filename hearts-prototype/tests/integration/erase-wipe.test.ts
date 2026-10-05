import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { closePayload } from '../../src/lib/prepare-db'
import { findOrphans, formatOrphanReport, missingWipeRegistrations, retryFailedFiles, wipePortal, wipeUser } from '../../src/server/erase'
import { execOutside } from '../../src/server/erase/sql'

const PG = process.env.HEARTS_ERASE_DATABASE || process.env.HEARTS_INTEGRATION_DATABASE || 'postgresql://hearts:hearts@127.0.0.1:5432/hearts_erase'

describe('erase wipe on a real database', { timeout: 180_000 }, () => {
  it('the registry is complete before any seed', () => {
    assert.deepEqual(missingWipeRegistrations(), [])
  })

  let payload: Awaited<ReturnType<typeof import('payload')['getPayload']>>
  let keepPortal: { id: number; name: string }
  let wipePortalDoc: { id: number; name: string; slug: string }
  let learner: { id: number; name: string }
  let otherLearner: { id: number }
  let libraryLesson: { id: number }
  let localLesson: { id: number }
  let mediaId: number
  let mediaName: string
  let master: { id: number; role?: string | null; name?: string | null }

  before(async () => {
    if (PG) process.env.DATABASE_URL = PG
    process.env.DATABASE_ADAPTER = 'postgres'
    const { getPayload } = await import('payload')
    const { default: config } = await import('../../src/payload.config')
    payload = await getPayload({ config })
    await payload.db.migrate()
    master = (await payload.find({ collection: 'users', overrideAccess: true, limit: 1, where: { role: { equals: 'master' } } })).docs[0] as never
    if (!master) {
      master = (await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: { email: `erase-master-${randomUUID().slice(0, 8)}@hearts.test`, password: 'erase-master-pass', name: 'Erase Master', role: 'master' },
      })) as never
    }
    const suffix = randomUUID().slice(0, 8)
    keepPortal = (await payload.create({
      collection: 'portals',
      overrideAccess: true,
      data: { name: `Keep ${suffix}`, slug: `keep-${suffix}`, kind: 'mosque' },
    })) as never
    wipePortalDoc = (await payload.create({
      collection: 'portals',
      overrideAccess: true,
      data: { name: `Wipe ${suffix}`, slug: `wipe-${suffix}`, kind: 'mosque' },
    })) as never

    const course = (await payload.create({
      collection: 'courses',
      overrideAccess: true,
      data: { title: `Library talk ${suffix}`, origin: 'master', importable: true },
    })) as { id: number }
    const unit = (await payload.create({
      collection: 'units',
      overrideAccess: true,
      data: { title: 'Part one', course: course.id, order: 1 },
    })) as { id: number }
    libraryLesson = (await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: { title: `Shared talk ${suffix}`, course: course.id, unit: unit.id, order: 1, master: true },
    })) as { id: number }
    await payload.create({ collection: 'adoptions', overrideAccess: true, data: { kind: 'course', course: course.id, portal: keepPortal.id } })
    await payload.create({ collection: 'adoptions', overrideAccess: true, data: { kind: 'course', course: course.id, portal: wipePortalDoc.id } })

    const localCourse = (await payload.create({
      collection: 'courses',
      overrideAccess: true,
      data: { title: `Local ${suffix}`, origin: 'local', portal: wipePortalDoc.id },
    })) as { id: number }
    const localUnit = (await payload.create({
      collection: 'units',
      overrideAccess: true,
      data: { title: 'Local part', course: localCourse.id, order: 1 },
    })) as { id: number }
    localLesson = (await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: { title: `Local talk ${suffix}`, course: localCourse.id, unit: localUnit.id, portal: wipePortalDoc.id, order: 1 },
    })) as { id: number }

    const dir = path.resolve(process.cwd(), 'media')
    mkdirSync(dir, { recursive: true })
    const filename = `erase-${suffix}.png`
    mediaName = filename
    const filePath = path.join(dir, filename)
    writeFileSync(
      filePath,
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
    )
    const media = (await payload.create({
      collection: 'media',
      overrideAccess: true,
      data: { alt: 'wipe file', portal: wipePortalDoc.id },
      filePath,
    })) as { id: number }
    mediaId = media.id

    learner = (await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: `wipe-learner-${suffix}@hearts.test`,
        password: 'portal-learner',
        name: `Wipe Learner ${suffix}`,
        role: 'learner',
        tenants: [{ tenant: wipePortalDoc.id }],
      },
    })) as never
    otherLearner = (await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: `keep-learner-${suffix}@hearts.test`,
        password: 'portal-learner',
        name: `Keep Learner ${suffix}`,
        role: 'learner',
        tenants: [{ tenant: keepPortal.id }],
      },
    })) as never

    const point = (await payload.create({
      collection: 'engagement-points',
      overrideAccess: true,
      data: { lesson: libraryLesson.id, second: 10, prompt: 'What stayed with you?', kind: 'reflection', status: 'published' },
    })) as { id: number }

    await payload.create({
      collection: 'answers',
      overrideAccess: true,
      data: { point: point.id, user: learner.id, portal: wipePortalDoc.id, lesson: libraryLesson.id, body: 'A wipe answer', image: mediaId },
    })
    await payload.create({
      collection: 'answers',
      overrideAccess: true,
      data: { point: point.id, user: otherLearner.id, portal: keepPortal.id, lesson: libraryLesson.id, body: 'A keep answer' },
    })
    await payload.create({
      collection: 'workbook-entries',
      overrideAccess: true,
      data: { user: learner.id, portal: wipePortalDoc.id, lesson: libraryLesson.id, body: 'Workbook line', image: mediaId },
    })
    await payload.create({
      collection: 'completions',
      overrideAccess: true,
      data: { user: learner.id, portal: wipePortalDoc.id, lesson: libraryLesson.id, percent: 100 },
    })
    await payload.create({
      collection: 'notifications',
      overrideAccess: true,
      data: { user: learner.id, portal: wipePortalDoc.id, title: 'A note', body: 'Hello' },
    })
    await payload.create({
      collection: 'circle-answers',
      overrideAccess: true,
      data: { point: point.id, lesson: libraryLesson.id, portal: wipePortalDoc.id, name: 'Circle', body: 'A circle line from the learner.', author: learner.id, origin: 'staff', enabled: true },
    })
    await payload.create({
      collection: 'harvest-entries',
      overrideAccess: true,
      data: { user: learner.id, portal: wipePortalDoc.id, lesson: libraryLesson.id, kind: 'line', text: 'A line' },
    })
    await payload.create({
      collection: 'drawn-to',
      overrideAccess: true,
      data: { user: learner.id, portal: wipePortalDoc.id, speaker: 'A speaker', speakerSlug: 'a-speaker' },
    })
    await payload.create({
      collection: 'watch-sessions',
      overrideAccess: true,
      data: { user: learner.id, portal: wipePortalDoc.id, lesson: libraryLesson.id, seconds: 12 },
    })
    await payload.create({
      collection: 'lesson-visits',
      overrideAccess: true,
      data: { user: learner.id, portal: wipePortalDoc.id, lesson: libraryLesson.id },
    })
    await payload.create({
      collection: 'rituals',
      overrideAccess: true,
      data: { user: learner.id, portal: wipePortalDoc.id, note: 'A ritual' },
    })
    await payload.create({
      collection: 'compass-attempts',
      overrideAccess: true,
      data: { user: learner.id, portal: wipePortalDoc.id, at: new Date().toISOString(), bank: 'opening', scales: { belonging: 1 } },
    })
    await payload.create({
      collection: 'opening-answers',
      overrideAccess: true,
      data: { user: learner.id, portal: wipePortalDoc.id, sceneKey: 'arrive', optionKey: 'one', labelSnapshot: 'One' },
    })
    const gathering = (await payload.create({
      collection: 'gatherings',
      overrideAccess: true,
      data: {
        title: 'Wipe circle',
        portal: wipePortalDoc.id,
        startsAt: new Date().toISOString(),
        slug: `wipe-gath-${suffix}`,
        checkinToken: `tok-${suffix}`,
        status: 'published',
      },
    })) as { id: number }
    await payload.create({
      collection: 'gather-rsvps',
      overrideAccess: true,
      data: { gathering: gathering.id, portal: wipePortalDoc.id, user: learner.id, status: 'going' },
    })
    await payload.create({
      collection: 'access-codes',
      overrideAccess: true,
      data: { code: `WIPE${suffix.slice(0, 4).toUpperCase()}`, role: 'learner', portal: wipePortalDoc.id },
    })
  })

  after(async () => {
    if (!payload) return
    const pool = (payload.db as { pool?: { end?: () => Promise<unknown> } }).pool
    if (pool?.end) await pool.end().catch(() => undefined)
    await closePayload(payload)
    setTimeout(() => process.exit(0), 50).unref()
  })

  it('wiping a learner leaves no rows for them and keeps the other portal and the library talk', async () => {
    const result = await wipeUser(payload, {
      actor: master,
      userId: learner.id,
      portalId: wipePortalDoc.id,
      mode: 'account',
      confirmName: learner.name,
    })
    assert.equal(result.ok, true, result.ok ? '' : result.error)
    const answers = await payload.find({ collection: 'answers', overrideAccess: true, where: { user: { equals: learner.id } } })
    assert.equal(answers.totalDocs, 0)
    const circle = await payload.find({ collection: 'circle-answers', overrideAccess: true, where: { author: { equals: learner.id } } })
    assert.equal(circle.totalDocs, 0)
    const gone = await payload.findByID({ collection: 'users', id: learner.id, overrideAccess: true }).catch(() => null)
    assert.equal(gone, null)
    assert.equal(existsSync(path.join(process.cwd(), 'media', mediaName)), false)
    const keepAnswers = await payload.find({ collection: 'answers', overrideAccess: true, where: { user: { equals: otherLearner.id } } })
    assert.equal(keepAnswers.totalDocs, 1)
    const talk = await payload.findByID({ collection: 'lessons', id: libraryLesson.id, overrideAccess: true })
    assert.ok(talk)
    const local = await payload.findByID({ collection: 'lessons', id: localLesson.id, overrideAccess: true })
    assert.ok(local)
  })

  it('wiping the portal leaves zero rows for it, keeps the library talk, and leaves the other portal clean', async () => {
    const result = await wipePortal(payload, { actor: master, portalId: wipePortalDoc.id, confirmName: wipePortalDoc.name })
    assert.equal(result.ok, true, result.ok ? '' : result.error)
    const portal = await payload.findByID({ collection: 'portals', id: wipePortalDoc.id, overrideAccess: true }).catch(() => null)
    assert.equal(portal, null)
    const leftover = await execOutside(payload, `SELECT COUNT(*) AS n FROM answers WHERE portal_id = ${wipePortalDoc.id}`)
    assert.equal(Number(leftover.rows[0]?.n || 0), 0)
    const local = await payload.findByID({ collection: 'lessons', id: localLesson.id, overrideAccess: true }).catch(() => null)
    assert.equal(local, null)
    const talk = await payload.findByID({ collection: 'lessons', id: libraryLesson.id, overrideAccess: true })
    assert.ok(talk)
    const keep = await payload.findByID({ collection: 'portals', id: keepPortal.id, overrideAccess: true })
    assert.ok(keep)
    const keepAnswers = await payload.find({ collection: 'answers', overrideAccess: true, where: { portal: { equals: keepPortal.id } } })
    assert.equal(keepAnswers.totalDocs, 1)
    const report = await findOrphans(payload)
    assert.equal(report.clean, true, formatOrphanReport(report))
  })

  it('a forced storage failure lands in erase_s3_retries and is retried', async () => {
    const suffix = randomUUID().slice(0, 8)
    const portal = (await payload.create({
      collection: 'portals',
      overrideAccess: true,
      data: { name: `Retry ${suffix}`, slug: `retry-${suffix}`, kind: 'mosque' },
    })) as { id: number; name: string }
    const person = (await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: `retry-${suffix}@hearts.test`,
        password: 'portal-learner',
        name: `Retry ${suffix}`,
        role: 'learner',
        tenants: [{ tenant: portal.id }],
      },
    })) as { id: number; name: string }
    const filename = `retry-${suffix}.png`
    const filePath = path.join(process.cwd(), 'media', filename)
    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))
    const media = (await payload.create({
      collection: 'media',
      overrideAccess: true,
      data: { alt: 'retry file', portal: portal.id },
      filePath,
    })) as { id: number; filename?: string }
    const storedName = String(media.filename || filename)
    const storedPath = path.join(process.cwd(), 'media', storedName)
    writeFileSync(storedPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))
    const course = (await payload.find({ collection: 'courses', overrideAccess: true, limit: 1 })).docs[0] as { id: number }
    const lesson = (await payload.find({ collection: 'lessons', overrideAccess: true, limit: 1, where: { course: { equals: course.id } } })).docs[0] as { id: number }
    const point = (await payload.find({ collection: 'engagement-points', overrideAccess: true, limit: 1, where: { lesson: { equals: lesson.id } } })).docs[0] as { id: number }
    await payload.create({
      collection: 'answers',
      overrideAccess: true,
      data: { point: point.id, user: person.id, portal: portal.id, lesson: lesson.id, body: 'Retry answer', image: media.id },
    })
    process.env.HEARTS_ERASE_FAIL_STORAGE = '1'
    const failed = await wipeUser(payload, {
      actor: master,
      userId: person.id,
      portalId: portal.id,
      mode: 'account',
      confirmName: person.name,
    })
    delete process.env.HEARTS_ERASE_FAIL_STORAGE
    assert.equal(failed.ok, true, failed.ok ? '' : failed.error)
    if (failed.ok) assert.ok((failed.fileFailures || 0) >= 1)
    assert.equal(existsSync(storedPath), true)
    const queued = await execOutside(payload, 'SELECT COUNT(*) AS n FROM erase_s3_retries')
    assert.ok(Number(queued.rows[0]?.n || 0) >= 1)
    const retried = await retryFailedFiles(payload)
    assert.ok(retried.removed >= 1)
    assert.equal(existsSync(storedPath), false)
    const left = await execOutside(payload, 'SELECT COUNT(*) AS n FROM erase_s3_retries')
    assert.equal(Number(left.rows[0]?.n || 0), 0)
  })
})
