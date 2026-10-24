import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Payload } from 'payload'
import { randomCode } from '@/lib/access-codes'
import { EXAMPLE_LINES, EXAMPLE_TRANSCRIPT, PARENTING_EXAMPLES } from '@/lib/parenting-examples'
import { sequenceFeatureDefaults } from '@/lib/sequence-features'
import { validateTrack } from '@/lib/framing/validate'
import type { FramingTrack } from '@/lib/framing/types'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

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

function exampleTrack(youtubeId: string, duration: number): FramingTrack | null {
  const end = Math.max(duration, 4)
  const track: FramingTrack = {
    version: 1,
    youtubeId,
    start: 0,
    end,
    segments: [{ start: 0, end, mode: 'F', confidence: 0.5, focus: { x: 0.5, y: 0.45 } }],
    sentences: [
      {
        text: EXAMPLE_LINES.hook,
        s: 0,
        e: 4,
        words: [
          { w: 'Listen', t: 0, e: 0.4 },
          { w: 'first.', t: 0.5, e: 1.2 },
        ],
      },
      {
        text: EXAMPLE_LINES.turn,
        s: 8,
        e: 12,
        words: [
          { w: 'Turn', t: 8, e: 8.4 },
          { w: 'toward', t: 8.5, e: 8.9 },
          { w: 'what', t: 9, e: 9.3 },
          { w: 'they', t: 9.4, e: 9.7 },
          { w: 'need.', t: 9.8, e: 10.4 },
        ],
      },
      {
        text: EXAMPLE_LINES.land,
        s: 16,
        e: 20,
        words: [
          { w: 'Land', t: 16, e: 16.4 },
          { w: 'on', t: 16.5, e: 16.7 },
          { w: 'one', t: 16.8, e: 17 },
          { w: 'small', t: 17.1, e: 17.4 },
          { w: 'thing', t: 17.5, e: 17.9 },
          { w: 'you', t: 18, e: 18.2 },
          { w: 'can', t: 18.3, e: 18.5 },
          { w: 'try', t: 18.6, e: 18.9 },
          { w: 'this', t: 19, e: 19.2 },
          { w: 'week.', t: 19.3, e: 19.8 },
        ],
      },
    ],
  }
  return validateTrack(track).length ? null : track
}

/** A 17 second kinetic clip inside a stored window the learner never sees. */
const KINETIC_TIER = {
  horsStart: 1,
  horsEnd: 18,
  horsQuote: EXAMPLE_LINES.hook,
  appetiserStart: 0,
  appetiserEnd: 20,
  hook: EXAMPLE_LINES.hook,
  turn: EXAMPLE_LINES.turn,
  land: EXAMPLE_LINES.land,
  hookAt: 1,
  turnAt: 8,
  landAt: 16,
  typographyStyle: 'kinetic' as const,
  typographyInPlace: false,
  offerResume: false,
  status: 'checked' as const,
  source: 'example',
  note: EXAMPLE_LINES.note,
}

async function ensureKineticClip(payload: Payload, lessonId: number) {
  const existing = await payload.find({ collection: 'talk-tiers', overrideAccess: true, limit: 1, where: { lesson: { equals: lessonId } } })
  if (existing.docs[0]) return existing.docs[0]
  return payload.create({
    collection: 'talk-tiers',
    overrideAccess: true,
    data: { ...KINETIC_TIER, lesson: lessonId },
  })
}

/**
 * A parenting course that is not a HEARTS portal: its own films, in order.
 * Safe to run again. It does not touch East London or Leeds.
 */
export async function seedParentingPortal(payload: Payload) {
  const features = sequenceFeatureDefaults()
  const found = await payload.find({ collection: 'portals', overrideAccess: true, limit: 1, where: { slug: { equals: 'parenting' } } })
  const portal = found.docs[0]
    ? await payload.update({
        collection: 'portals',
        id: found.docs[0].id,
        overrideAccess: true,
        data: { shape: 'sequence', features, kineticOn: true, minTalkSeconds: 0 },
      })
    : await payload.create({
        collection: 'portals',
        overrideAccess: true,
        data: {
          name: 'Parenting',
          organisationName: 'Parenting',
          slug: 'parenting',
          kind: 'other',
          shape: 'sequence',
          welcome: 'Welcome. Watch the films in order. These example films stay until the real videos arrive.',
          description: 'A course you watch in order.',
          colour: '#1f3a5f',
          accent: '#e07a5f',
          lockOrder: true,
          minTalkSeconds: 0,
          wizardDone: true,
          kineticOn: true,
          features,
        },
      })

  const courseFound = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    limit: 1,
    where: { and: [{ portal: { equals: portal.id } }, { origin: { equals: 'local' } }] },
  })
  let course = courseFound.docs[0]
  if (!course) {
    course = await payload.create({
      collection: 'courses',
      overrideAccess: true,
      data: {
        title: 'Parenting, in order',
        summary: 'Example films until the real videos arrive. Watch them from 1 to 10.',
        origin: 'local',
        portal: portal.id,
        importable: false,
        hidden: false,
        visibility: 'published',
      },
    })
    const unit = await payload.create({
      collection: 'units',
      overrideAccess: true,
      data: { title: 'Films', course: course.id, order: 1 },
    })
    for (let index = 0; index < PARENTING_EXAMPLES.length; index++) {
      const film = PARENTING_EXAMPLES[index]
      const first = index === 0
      const track = first ? exampleTrack(film.youtubeId, film.durationSeconds) : null
      const lesson = await payload.create({
        collection: 'lessons',
        overrideAccess: true,
        data: {
          title: film.title,
          unit: unit.id,
          course: course.id,
          portal: portal.id,
          master: false,
          order: index + 1,
          speaker: film.speaker,
          sourceTitle: film.title.replace(/^Example \d+ · /, ''),
          youtubeUrl: `https://www.youtube.com/watch?v=${film.youtubeId}`,
          youtubeId: film.youtubeId,
          videoProvider: 'youtube',
          durationSeconds: film.durationSeconds,
          transcript: first ? EXAMPLE_TRANSCRIPT : undefined,
          transcriptSource: first ? 'upload' : 'none',
          transcriptNote: first ? EXAMPLE_LINES.note : undefined,
          framingTrack: track || undefined,
          tooShort: false,
          publishState: 'published',
        },
      })
      if (first) {
        await payload.create({
          collection: 'cuts',
          overrideAccess: true,
          data: {
            lesson: lesson.id,
            course: course.id,
            status: 'approved',
            start: 1,
            end: 20,
            hook: EXAMPLE_LINES.hook,
            turn: EXAMPLE_LINES.turn,
            land: EXAMPLE_LINES.land,
            playable: true,
          },
        })
        await payload.create({
          collection: 'engagement-points',
          overrideAccess: true,
          data: {
            lesson: lesson.id,
            triggerType: 'timestamp',
            second: 12,
            kind: 'reflection',
            prompt: EXAMPLE_LINES.question,
            timing: 'immediate',
            audience: 'everyone',
            status: 'published',
          },
        })
        await ensureKineticClip(payload, lesson.id)
      }
    }
  } else {
    const first = await payload.find({ collection: 'lessons', overrideAccess: true, limit: 1, sort: 'order', where: { course: { equals: course.id } } })
    if (first.docs[0]) await ensureKineticClip(payload, first.docs[0].id)
  }

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
