import assert from 'node:assert/strict'
import { migrations } from '../src/migrations'

const LIVE_URL = process.env.DATABASE_URL || 'postgres://hearts:hearts@127.0.0.1:5432/hearts_live'
const CF40_LAST = '20261004_080000_lesson_picture_flags'

void main().then(
  () => process.exit(0),
  (error) => {
    console.error(error)
    process.exit(1)
  },
)

async function main() {
  const { default: pg } = await import('pg')
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const pool = new pg.Pool({ connectionString: LIVE_URL, max: 4 })
  const db = drizzle(pool)
  let learnerId = 0
  let teacherId = 0
  let portalId = 0
  try {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE')
    await pool.query('CREATE SCHEMA public')
    await pool.query('GRANT ALL ON SCHEMA public TO CURRENT_USER')

    const names = migrations.map((row) => row.name)
    const cut = names.indexOf(CF40_LAST)
    assert.ok(cut >= 0, 'cf40 cutoff is in the migration list')
    const cf40 = names.slice(0, cut + 1)
    const later = names.slice(cut + 1)
    assert.ok(later.includes('20261005_120000_consent'), 'consent migration follows the live schema')

    for (const row of migrations.filter((item) => cf40.includes(item.name))) {
      await row.up({ db, payload: null, req: null } as never)
      await record(pool, row.name)
    }

    const portal = await pool.query(
      `insert into portals (name, slug, kind, wizard_done) values ('East London Masjid', 'east-london', 'mosque', true) returning id`,
    )
    portalId = Number(portal.rows[0].id)
    const learner = await pool.query(
      `insert into users (name, role, email, onboarded, seen_welcome) values ('Live Learner', 'learner', 'live-learner@hearts.test', true, true) returning id`,
    )
    const teacher = await pool.query(
      `insert into users (name, role, email, onboarded) values ('Live Teacher', 'teacher', 'live-teacher@hearts.test', true) returning id`,
    )
    learnerId = Number(learner.rows[0].id)
    teacherId = Number(teacher.rows[0].id)
    await pool.query(`insert into users_tenants (_order, _parent_id, id, tenant_id) values (0, $1, $2, $3)`, [
      learnerId,
      `live-learner-${learnerId}`,
      portalId,
    ])
    await pool.query(`insert into users_tenants (_order, _parent_id, id, tenant_id) values (0, $1, $2, $3)`, [
      teacherId,
      `live-teacher-${teacherId}`,
      portalId,
    ])

    for (const row of migrations.filter((item) => later.includes(item.name))) {
      await row.up({ db, payload: null, req: null } as never)
      await record(pool, row.name)
    }

    const tables = await pool.query(
      `select to_regclass('public.consents') as consents, to_regclass('public.legal_pages') as legal, to_regclass('public.users') as users`,
    )
    assert.ok(tables.rows[0].consents, 'consents table exists after migrate')
    assert.ok(tables.rows[0].legal, 'legal_pages table exists after migrate')
    const stillThere = await pool.query(`select id, email, role from users where id = $1`, [learnerId])
    assert.equal(stillThere.rows[0].email, 'live-learner@hearts.test')
  } finally {
    await pool.end().catch(() => undefined)
  }

  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const { ensureLegalPages, learnerNeedsConsent, grantCurrentConsents } = await import('../src/server/consent')
  const payload = await getPayload({ config })
  try {
    await ensureLegalPages(payload)
    const pages = await payload.find({
      collection: 'legal-pages',
      overrideAccess: true,
      limit: 10,
      where: { published: { equals: true } },
    })
    assert.ok(pages.docs.length >= 2, 'published legal pages exist so existing people are asked')

    const learnerUser = {
      id: learnerId,
      email: 'live-learner@hearts.test',
      role: 'learner' as const,
      tenants: [{ tenant: portalId }],
    }
    const teacherUser = {
      id: teacherId,
      email: 'live-teacher@hearts.test',
      role: 'teacher' as const,
      tenants: [{ tenant: portalId }],
    }
    assert.equal(await learnerNeedsConsent(payload, learnerUser), true, 'existing learner is asked once')
    assert.equal(await learnerNeedsConsent(payload, teacherUser), false, 'staff are not locked behind consent')

    const home = await payload.find({ collection: 'users', overrideAccess: true, limit: 1, where: { id: { equals: learnerId } } })
    assert.equal(home.docs.length, 1, 'existing learner is still readable after migrate')

    await grantCurrentConsents(payload, learnerId, portalId)
    assert.equal(await learnerNeedsConsent(payload, learnerUser), false, 'after agreeing they are not asked again')
  } finally {
    await payload.destroy().catch(() => undefined)
  }
}

async function record(pool: import('pg').Pool, name: string) {
  const have = await pool.query(`select to_regclass('public.payload_migrations') as t`)
  if (!have.rows[0]?.t) return
  await pool.query(`insert into payload_migrations (name, batch) values ($1, 1)`, [name])
}
