/**
 * Seeds a small portal, prints db:orphans, wipes the learner then the portal,
 * and prints db:orphans again. Read-only except for the wipe itself.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { findOrphans, formatOrphanReport, wipePortal, wipeUser } from '../src/server/erase'
import { closePayload } from '../src/lib/prepare-db'

const outDir = path.resolve(process.cwd(), process.argv[2] || 'artifacts/delete-and-wipe')
mkdirSync(outDir, { recursive: true })

const payload = await getPayload({ config })
await payload.db.migrate()

const suffix = randomUUID().slice(0, 8)
const master = (await payload.find({ collection: 'users', overrideAccess: true, limit: 1, where: { role: { equals: 'master' } } })).docs[0]
  || (await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: { email: `proof-master-${suffix}@hearts.test`, password: 'erase-master-pass', name: 'Proof Master', role: 'master' },
  }))

const keep = await payload.create({
  collection: 'portals',
  overrideAccess: true,
  data: { name: `Keep Proof ${suffix}`, slug: `keep-proof-${suffix}`, kind: 'mosque' },
})
const wipe = await payload.create({
  collection: 'portals',
  overrideAccess: true,
  data: { name: `Wipe Proof ${suffix}`, slug: `wipe-proof-${suffix}`, kind: 'mosque' },
})
const course = await payload.create({
  collection: 'courses',
  overrideAccess: true,
  data: { title: `Proof talk ${suffix}`, origin: 'master', importable: true },
})
const unit = await payload.create({
  collection: 'units',
  overrideAccess: true,
  data: { title: 'Part one', course: course.id, order: 1 },
})
const lesson = await payload.create({
  collection: 'lessons',
  overrideAccess: true,
  data: { title: `Shared proof ${suffix}`, course: course.id, unit: unit.id, order: 1, master: true },
})
await payload.create({ collection: 'adoptions', overrideAccess: true, data: { kind: 'course', course: course.id, portal: keep.id } })
await payload.create({ collection: 'adoptions', overrideAccess: true, data: { kind: 'course', course: course.id, portal: wipe.id } })

const learner = await payload.create({
  collection: 'users',
  overrideAccess: true,
  data: {
    email: `proof-learner-${suffix}@hearts.test`,
    password: 'portal-learner',
    name: `Proof Learner ${suffix}`,
    role: 'learner',
    tenants: [{ tenant: wipe.id }],
  },
})
const keepLearner = await payload.create({
  collection: 'users',
  overrideAccess: true,
  data: {
    email: `proof-keep-${suffix}@hearts.test`,
    password: 'portal-learner',
    name: `Keep Learner ${suffix}`,
    role: 'learner',
    tenants: [{ tenant: keep.id }],
  },
})
const point = await payload.create({
  collection: 'engagement-points',
  overrideAccess: true,
  data: { lesson: lesson.id, second: 10, prompt: 'What stayed with you?', kind: 'reflection', status: 'published' },
})
await payload.create({
  collection: 'answers',
  overrideAccess: true,
  data: { point: point.id, user: learner.id, portal: wipe.id, lesson: lesson.id, body: 'A proof answer' },
})
await payload.create({
  collection: 'answers',
  overrideAccess: true,
  data: { point: point.id, user: keepLearner.id, portal: keep.id, lesson: lesson.id, body: 'A keep answer' },
})

const before = await findOrphans(payload)
writeFileSync(path.join(outDir, 'orphans-before.txt'), `${formatOrphanReport(before)}\n`)
console.log('BEFORE\n' + formatOrphanReport(before))

const userResult = await wipeUser(payload, {
  actor: master as never,
  userId: learner.id,
  portalId: wipe.id,
  mode: 'account',
  confirmName: String((learner as { name?: string }).name),
})
if (!userResult.ok) throw new Error(userResult.error)

const mid = await findOrphans(payload)
writeFileSync(path.join(outDir, 'orphans-after-user.txt'), `${formatOrphanReport(mid)}\n`)
console.log('AFTER USER\n' + formatOrphanReport(mid))

const portalResult = await wipePortal(payload, {
  actor: master as never,
  portalId: wipe.id,
  confirmName: String((wipe as { name?: string }).name),
})
if (!portalResult.ok) throw new Error(portalResult.error)

const after = await findOrphans(payload)
writeFileSync(path.join(outDir, 'orphans-after.txt'), `${formatOrphanReport(after)}\n`)
console.log('AFTER PORTAL\n' + formatOrphanReport(after))

const talk = await payload.findByID({ collection: 'lessons', id: lesson.id, overrideAccess: true })
const other = await payload.findByID({ collection: 'portals', id: keep.id, overrideAccess: true })
writeFileSync(
  path.join(outDir, 'orphans-proof.json'),
  JSON.stringify(
    {
      beforeClean: before.clean,
      afterUserClean: mid.clean,
      afterPortalClean: after.clean,
      libraryTalkSurvived: Boolean(talk),
      otherPortalSurvived: Boolean(other),
      userWipe: userResult,
      portalWipe: portalResult,
    },
    null,
    2,
  ) + '\n',
)

await closePayload(payload)
process.exit(before.clean && mid.clean && after.clean && talk && other ? 0 : 1)
