import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Payload } from 'payload'
import { randomCode } from '@/lib/access-codes'
import { FEATURE_KEYS, lockBeginner, type FeatureMap } from '@/lib/features'
import { EXAMPLE_LINES, EXAMPLE_TRANSCRIPT, PARENTING_EXAMPLES } from '@/lib/parenting-examples'
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
    ],
  }
  return validateTrack(track).length ? null : track
}

/**
 * A parenting course that is not a HEARTS portal: its own films, in order.
 * Safe to run again. It does not touch East London or Leeds.
 */
export async function seedParentingPortal(payload: Payload) {
  const features = lockBeginner(Object.fromEntries(FEATURE_KEYS.map((key) => [key, false])) as FeatureMap)
  const found = await payload.find({ collection: 'portals', overrideAccess: true, limit: 1, where: { slug: { equals: 'parenting' } } })
  const portal = found.docs[0] || (await payload.create({
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
      features,
    },
  }))

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
      }
    }
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
        code: randomCode('PARENT'),
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
