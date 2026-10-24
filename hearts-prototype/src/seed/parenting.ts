import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Payload } from 'payload'
import { randomCode } from '@/lib/access-codes'
import { sequenceFeatureDefaults } from '@/lib/sequence-features'
import { syncCourseSheet } from '@/server/sequence-desk'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const WELCOME = 'Welcome. Watch the films in order.'
const COURSE_TITLE = 'Guiding Home Learning'
const COURSE_SUMMARY = 'Watch the films in order.'

function codesFile() {
  const url = process.env.DATABASE_URL || ''
  if (process.env.HEARTS_E2E === '1' || /hearts-test\.db|_e2e/.test(url)) return 'data/seed-codes-test.json'
  return 'data/seed-codes.json'
}

function rememberCodes(extra: Record<string, string>) {
  const file = path.join(root, codesFile())
  const current = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>) : {}
  writeFileSync(file, `${JSON.stringify({ ...current, ...extra }, null, 2)}\n`)
}

async function ensureUser(payload: Payload, data: { email: string; password: string; name: string; role: 'portal-admin' | 'teacher' | 'learner'; accessCode?: number; tenants?: { tenant: number }[]; courseList?: number[] }) {
  const found = await payload.find({ collection: 'users', overrideAccess: true, limit: 1, where: { email: { equals: data.email } } })
  if (found.docs[0]) return found.docs[0]
  return payload.create({
    collection: 'users',
    overrideAccess: true,
    data: { ...data, onboarded: true, seenWelcome: true },
  })
}

/**
 * The Guiding Home Learning course on its own portal.
 * Safe to run again. It does not touch East London or Leeds.
 * Re-reads uploads/videos.csv so a later sheet replaces the films in place.
 */
export async function seedParentingPortal(payload: Payload) {
  const features = sequenceFeatureDefaults()
  const found = await payload.find({ collection: 'portals', overrideAccess: true, limit: 1, where: { slug: { equals: 'parenting' } } })
  const look = {
    shape: 'sequence' as const,
    features,
    kineticOn: true,
    minTalkSeconds: 0,
    welcome: WELCOME,
    description: 'A course you watch in order.',
  }
  const portal = found.docs[0]
    ? await payload.update({
        collection: 'portals',
        id: found.docs[0].id,
        overrideAccess: true,
        data: look,
      })
    : await payload.create({
        collection: 'portals',
        overrideAccess: true,
        data: {
          name: 'Parenting',
          organisationName: 'Parenting',
          slug: 'parenting',
          kind: 'other',
          colour: '#1f3a5f',
          accent: '#e07a5f',
          lockOrder: true,
          wizardDone: true,
          ...look,
        },
      })

  const courseFound = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    limit: 1,
    where: { and: [{ portal: { equals: portal.id } }, { origin: { equals: 'local' } }] },
  })
  const courseFields = {
    title: COURSE_TITLE,
    summary: COURSE_SUMMARY,
    origin: 'local' as const,
    portal: portal.id,
    importable: false,
    hidden: false,
    visibility: 'published' as const,
  }
  const course = courseFound.docs[0]
    ? await payload.update({ collection: 'courses', id: courseFound.docs[0].id, overrideAccess: true, data: courseFields })
    : await payload.create({ collection: 'courses', overrideAccess: true, data: courseFields })

  const sheet = readFileSync(path.join(root, 'uploads/videos.csv'), 'utf8')
  const synced = await syncCourseSheet(payload, portal.id, sheet)
  if (synced.error) throw new Error(synced.error)

  const packFound = await payload.find({
    collection: 'packs',
    overrideAccess: true,
    limit: 1,
    where: { and: [{ portal: { equals: portal.id } }, { owner: { equals: 'portal' } }] },
  })
  const pack = packFound.docs[0] || (await payload.create({
    collection: 'packs',
    overrideAccess: true,
    data: { title: 'Parenting course', summary: 'The films in this course.', owner: 'portal', portal: portal.id, courses: [course.id] },
  }))

  async function ensureCode(label: string, role: 'admin' | 'teacher' | 'learner', linked?: number) {
    const existing = await payload.find({
      collection: 'access-codes',
      overrideAccess: true,
      limit: 1,
      where: { and: [{ label: { equals: label } }, { portal: { equals: portal.id } }] },
    })
    if (existing.docs[0]) return existing.docs[0]
    return payload.create({
      collection: 'access-codes',
      overrideAccess: true,
      data: {
        code: randomCode('PNT'),
        label,
        role,
        portal: portal.id,
        packs: [pack.id],
        courses: [course.id],
        linkedTeacherCode: linked,
        uses: 0,
        disabled: false,
      },
    })
  }

  const teacher = await ensureCode('parenting-teacher', 'teacher')
  const admin = await ensureCode('parenting-admin', 'admin')
  const learner = await ensureCode('parenting-learner', 'learner', teacher.id)
  rememberCodes({
    'parenting-admin': String(admin.code),
    'parenting-teacher': String(teacher.code),
    'parenting-learner': String(learner.code),
  })

  await ensureUser(payload, {
    email: 'parenting-admin@hearts.test',
    password: 'portal-admin',
    name: 'Parenting admin',
    role: 'portal-admin',
    accessCode: admin.id,
    tenants: [{ tenant: portal.id }],
    courseList: [course.id],
  })
  await ensureUser(payload, {
    email: 'parenting-teacher@hearts.test',
    password: 'portal-teacher',
    name: 'Parenting teacher',
    role: 'teacher',
    accessCode: teacher.id,
    tenants: [{ tenant: portal.id }],
    courseList: [course.id],
  })
  await ensureUser(payload, {
    email: 'parenting-learner@hearts.test',
    password: 'portal-learner',
    name: 'Parenting learner',
    role: 'learner',
    accessCode: learner.id,
    tenants: [{ tenant: portal.id }],
    courseList: [course.id],
  })
}
