import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Payload } from 'payload'
import { randomCode } from '@/lib/access-codes'
import { isProduction, isRemoteDatabase } from '@/lib/env'
import { OPENING_QUESTIONS, loadRealAnswers, phaseLabel } from '@/lib/parent-feedback'
import { parentOpeningScenes } from '@/lib/parent-opening'
import { cleanPortalScenes } from '@/lib/portal-scenes'
import { fillSampleGaps, readSaidAnswers } from '@/lib/said-answers'
import { defaultFeatures } from '@/lib/features'
import { parseCourseSheet } from '@/lib/sequence'
import { syncCourseSheet, syncPortalFilmQuestions } from '@/server/sequence-desk'
import { applyStoredVimeoMeta, loadStoredVimeoMetas } from '@/server/vimeo-backfill'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const WELCOME = 'Welcome. Watch the films in order.'
const BRAND = 'Hady Home'
const COURSE_TITLE = 'Guiding Home Learning'
const BOOK_TITLE = 'Book Summaries'
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

async function ensureOpeningQuestions(payload: Payload, portalId: number) {
  for (const [index, question] of OPENING_QUESTIONS.entries()) {
    const found = await payload.find({
      collection: 'placing-questions',
      overrideAccess: true,
      limit: 1,
      where: { and: [{ portal: { equals: portalId } }, { prompt: { equals: question.prompt } }] },
    })
    if (found.docs[0]) continue
    await payload.create({
      collection: 'placing-questions',
      overrideAccess: true,
      data: { prompt: question.prompt, why: question.why, options: question.options, order: index + 1, portal: portalId },
    })
  }
}

async function ensureParentScenes(payload: Payload, portalId: number) {
  const scenes = parentOpeningScenes()
  const found = await payload.find({
    collection: 'opening-configs',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { portal: { equals: portalId } },
  })
  if (cleanPortalScenes(found.docs[0]?.extraScenes).scenes.length) return
  if (found.docs[0]) {
    await payload.update({ collection: 'opening-configs', id: found.docs[0].id, overrideAccess: true, data: { extraScenes: scenes } as never })
    return
  }
  await payload.create({ collection: 'opening-configs', overrideAccess: true, data: { portal: portalId, extraScenes: scenes } as never })
}

async function ensureSaidAnswers(payload: Payload, courseId: number) {
  const course = await payload.findByID({ collection: 'courses', id: courseId, depth: 0, overrideAccess: true })
  if (readSaidAnswers((course as { sampleAnswers?: unknown }).sampleAnswers).length) return
  const rows = fillSampleGaps(loadRealAnswers().map((row) => ({
    order: row.videoOrder,
    phase: row.phase,
    label: phaseLabel(row.phase),
    question: row.question,
    text: row.text,
  })))
  await payload.update({ collection: 'courses', id: courseId, overrideAccess: true, data: { sampleAnswers: rows } as never })
}

function hadyLook(existing?: { accent?: string | null; colour?: string | null; fontPair?: string | null; logoUrl?: string | null; sceneKey?: string | null }) {
  const accent = String(existing?.accent || '').trim().toLowerCase()
  const colour = String(existing?.colour || '').trim().toLowerCase()
  const font = String(existing?.fontPair || '').trim()
  const scene = String(existing?.sceneKey || '').trim()
  return {
    shell: 'modern' as const,
    courseHome: 'cards' as const,
    ...(!scene ? { sceneKey: 'plain' as const } : {}),
    ...(!font ? { fontPair: 'system' as const } : {}),
    ...(!accent || accent === '#e07a5f' ? { accent: '#2563EB' } : {}),
    ...(!colour || colour === '#1f3a5f' ? { colour: '#2563EB' } : {}),
    ...(String(existing?.logoUrl || '').trim() ? {} : { logoUrl: '/icons/hady-home.svg' }),
  }
}

/** The live course picked up three extra films and the old Vimeo ids, which come back without a length. */
async function parentingFilmsNeedRepair(payload: Payload, portalId: number) {
  const courses = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { and: [{ portal: { equals: portalId } }, { sheetTitle: { equals: COURSE_TITLE } }, { hidden: { not_equals: true } }] },
  })
  const ids = courses.docs.map((row) => row.id)
  if (!ids.length) return false
  const lessons = await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 200,
    where: { course: { in: ids } },
  })
  const open = lessons.docs.filter((row) => row.binned !== true)
  const stale = open.some((row) => /^496/.test(String(row.vimeoId || '')))
  const bare = open.filter((row) => String(row.vimeoId || '').trim() && !Number(row.durationSeconds)).length
  return open.length > 107 || stale || bare > 15
}

/**
 * The Guiding Home Learning course on its own portal.
 * Safe to run again. It does not create people or join codes.
 * Films load once. A later boot leaves changes an admin has already made.
 * Pass refresh to read uploads/videos.csv again and replace the films in place.
 */
export async function ensureParentingCourse(payload: Payload, opts?: { refresh?: boolean }) {
  const refresh = opts?.refresh === true
  const features = defaultFeatures()
  const found = await payload.find({ collection: 'portals', overrideAccess: true, limit: 1, where: { slug: { equals: 'parenting' } } })
  const look = {
    shape: 'sequence' as const,
    features,
    kineticOn: true,
    minTalkSeconds: 0,
    welcome: WELCOME,
    description: 'A course you watch in order.',
    brandName: BRAND,
    logoUrl: '/icons/hady-home.svg',
  }
  const saved = found.docs[0]?.features
  const switchesOff = !saved || typeof saved !== 'object' || Object.values(saved as Record<string, unknown>).every((value) => value !== true)
  const portal = found.docs[0]
    ? await payload.update({
        collection: 'portals',
        id: found.docs[0].id,
        overrideAccess: true,
        data: refresh || switchesOff ? { ...look, ...hadyLook(found.docs[0]) } : { brandName: BRAND, ...hadyLook(found.docs[0]) },
      })
    : await payload.create({
        collection: 'portals',
        overrideAccess: true,
        data: {
          name: 'Parenting',
          organisationName: 'Parenting',
          slug: 'parenting',
          kind: 'other',
          lockOrder: true,
          wizardDone: true,
          ...look,
          ...hadyLook(),
        },
      })
  const { removeGeneratedSwarm } = await import('@/server/parent-swarm')
  void removeGeneratedSwarm(payload, Number(portal.id)).then((result) => {
    if (result.removed) payload.logger.info(`Removed ${result.removed} generated parent answers. Kept ${result.kept} real ones.`)
  }).catch((error) => {
    payload.logger.error({ err: error, msg: 'Could not remove the generated parent answers.' })
  })
  const { seedWorkbookAnswers } = await import('@/server/workbook-seed')
  void seedWorkbookAnswers(payload, Number(portal.id)).then((result) => {
    if (result.created) payload.logger.info(`Shared ${result.created} handwritten answers on the first ten films.`)
  }).catch((error) => {
    payload.logger.error({ err: error, msg: 'Could not share the workbook answers.' })
  })
  await ensureOpeningQuestions(payload, Number(portal.id))
  await ensureParentScenes(payload, Number(portal.id))

  const guidingReady = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    limit: 1,
    where: { and: [{ portal: { equals: portal.id } }, { sheetTitle: { equals: COURSE_TITLE } }, { hidden: { not_equals: true } }] },
  })
  const booksReady = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    limit: 1,
    where: { and: [{ portal: { equals: portal.id } }, { sheetTitle: { equals: BOOK_TITLE } }, { hidden: { not_equals: true } }] },
  })
  const bookPath = path.join(root, 'uploads/book-summaries.csv')
  const storedMetas = loadStoredVimeoMetas()
  const needsSheets = refresh || guidingReady.totalDocs < 8 || (existsSync(bookPath) && booksReady.totalDocs < 4)
  const needsRepair = !needsSheets && await parentingFilmsNeedRepair(payload, Number(portal.id))
  let courseIds: number[] = []
  if (needsSheets || needsRepair) {
    const sheet = readFileSync(path.join(root, 'uploads/videos.csv'), 'utf8')
    const synced = await syncCourseSheet(payload, Number(portal.id), sheet, { title: COURSE_TITLE, vimeoMetas: storedMetas })
    if (synced.error) throw new Error(synced.error)
    courseIds = synced.courseIds || []
    if (existsSync(bookPath)) {
      const books = await syncCourseSheet(payload, Number(portal.id), readFileSync(bookPath, 'utf8'), { title: BOOK_TITLE, vimeoMetas: storedMetas })
      if (books.error) throw new Error(books.error)
      courseIds = [...courseIds, ...(books.courseIds || [])]
    }
  }
  if (!courseIds.length) {
    const found = await payload.find({
      collection: 'courses',
      overrideAccess: true,
      limit: 40,
      sort: 'sheetOrder',
      where: { and: [{ portal: { equals: portal.id } }, { sheetTitle: { in: [COURSE_TITLE, BOOK_TITLE] } }, { hidden: { not_equals: true } }] },
    })
    courseIds = found.docs.map((row) => Number(row.id))
  }
  const course = courseIds[0]
    ? await payload.findByID({ collection: 'courses', id: courseIds[0], overrideAccess: true, depth: 0 })
    : await payload.create({
        collection: 'courses',
        overrideAccess: true,
        data: {
          title: COURSE_TITLE,
          summary: COURSE_SUMMARY,
          origin: 'local',
          portal: portal.id,
          importable: false,
          hidden: false,
          visibility: 'published',
        },
      })
  await ensureSaidAnswers(payload, Number(course.id))
  const { backfillVimeoFilms, clearMisplacedHomeAnswers } = await import('@/server/vimeo-backfill')
  await clearMisplacedHomeAnswers(payload)
  await applyStoredVimeoMeta(payload, storedMetas)
  await backfillVimeoFilms(payload)
  const masterPath = path.join(root, 'uploads/hady-home-master-sheet.csv')
  if (!existsSync(masterPath)) throw new Error('The Hady Home master sheet is missing.')
  const sheetFilms = [
    ...parseCourseSheet(readFileSync(masterPath, 'utf8')).films,
    ...(existsSync(bookPath) ? parseCourseSheet(readFileSync(bookPath, 'utf8')).films : []),
  ]
  const questions = await syncPortalFilmQuestions(payload, Number(portal.id), sheetFilms)
  if (questions.updated) payload.logger.info(`Updated the sheet questions on ${questions.updated} films.`)
  const packFound = await payload.find({
    collection: 'packs',
    overrideAccess: true,
    limit: 1,
    where: { and: [{ portal: { equals: portal.id } }, { owner: { equals: 'portal' } }] },
  })
  const packCourses = courseIds.length ? courseIds : [Number(course.id)]
  const pack = packFound.docs[0]
    ? await payload.update({ collection: 'packs', id: packFound.docs[0].id, overrideAccess: true, data: { courses: packCourses } })
    : await payload.create({
        collection: 'packs',
        overrideAccess: true,
        data: { title: 'Parenting course', summary: 'The films in this course.', owner: 'portal', portal: portal.id, courses: packCourses },
      })

  const { ensureParentingDemoCode } = await import('@/server/parenting-demo')
  await ensureParentingDemoCode(payload, Number(portal.id), packCourses, Number(pack.id))

  return { portal, course, courseIds: packCourses, pack }
}

/**
 * Local demo only. Production and any database that is not on this computer
 * get the course, and never the sample sign-ins.
 */
export async function seedParentingPortal(payload: Payload) {
  const live = isProduction() || isRemoteDatabase()
  const { portal, course, courseIds, pack } = await ensureParentingCourse(payload, { refresh: !live })
  const granted = courseIds.length ? courseIds : [Number(course.id)]
  if (live) return

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
        courses: granted,
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
    courseList: granted,
  })
  const teacherUser = await ensureUser(payload, {
    email: 'parenting-teacher@hearts.test',
    password: 'portal-teacher',
    name: 'Hannah Price',
    role: 'teacher',
    accessCode: teacher.id,
    tenants: [{ tenant: portal.id }],
    courseList: granted,
  })
  if (teacherUser.name !== 'Hannah Price') {
    await payload.update({ collection: 'users', id: teacherUser.id, overrideAccess: true, data: { name: 'Hannah Price' } })
  }
  await ensureUser(payload, {
    email: 'parenting-learner@hearts.test',
    password: 'portal-learner',
    name: 'Parenting learner',
    role: 'learner',
    accessCode: learner.id,
    tenants: [{ tenant: portal.id }],
    courseList: granted,
  })
}
