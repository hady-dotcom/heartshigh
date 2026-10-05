// Idempotent demo for the hearts-demo portal only. Re-running adds nothing that is already there,
// and it never writes to another portal or to a learner who already belongs somewhere else.

import { getPayload, type Payload } from 'payload'
import config from '../payload.config'
import { formForRound } from '../lib/compass-bank'
import { lifeForDemo, passwordForNewAccount } from '../lib/compass-demo-plan'
import { DEFAULT_MIX, SCALE_DOOR, whyDeficit } from '../lib/compass-feed'
import { DOORS } from '../lib/doors'
import { SCALE_KEYS, type ScaleKey } from '../lib/heart'
import { idOf } from '../lib/ids'
import { midpointReading, PERSONA_V2 } from '../lib/persona-v2'
import type { PersonaBand } from '../lib/persona'

const SLUG = 'hearts-demo'
const DAY = 24 * 60 * 60 * 1000

const TITLES: Record<ScaleKey, string> = {
  gratitude: 'Noticing a small gift',
  anger: 'Letting the heat pass',
  worry: 'Leaving the outcome',
  faith: 'A word before sleep',
  belonging: 'Sitting with the circle',
  greed: 'A portion set aside',
  desire: 'Putting the screen down',
  ego: 'Passing the credit on',
  compassion: 'Stopping for a stranger',
  discipline: 'Praying it on time',
}

type Person = { email: string; name: string; role: 'learner' | 'portal-admin' | 'teacher'; persona?: string; lastDays?: number }

const PEOPLE: Person[] = [
  { email: 'demo-admin@hearts.foundation', name: 'Huda Karim', role: 'portal-admin' },
  { email: 'demo-imam@hearts.foundation', name: 'Imam Sami El-Masri', role: 'teacher' },
  { email: 'demo-learner@hearts.foundation', name: 'Amina Yusuf', role: 'learner', persona: 'devout', lastDays: 40 },
  { email: 'demo-complete@hearts.foundation', name: 'Yusuf Rahman', role: 'learner', persona: 'seeker', lastDays: 3 },
  { email: 'compass-01@hearts.foundation', name: 'Safiya Khan', role: 'learner', persona: 'traditionalist', lastDays: 12 },
  { email: 'compass-02@hearts.foundation', name: 'Bilal Hussain', role: 'learner', persona: 'traditionalist', lastDays: 18 },
  { email: 'compass-03@hearts.foundation', name: 'Maryam Begum', role: 'learner', persona: 'activist', lastDays: 14 },
  { email: 'compass-04@hearts.foundation', name: 'Omar Farooq', role: 'learner', persona: 'activist', lastDays: 9 },
  { email: 'compass-05@hearts.foundation', name: 'Hana Ali', role: 'learner', persona: 'family-centred', lastDays: 16 },
  { email: 'compass-06@hearts.foundation', name: 'Ibrahim Noor', role: 'learner', persona: 'family-centred', lastDays: 11 },
  { email: 'compass-07@hearts.foundation', name: 'Zaynab Shah', role: 'learner', persona: 'new-muslim', lastDays: 20 },
  { email: 'compass-08@hearts.foundation', name: 'Harun Malik', role: 'learner', persona: 'cultural', lastDays: 8 },
  { email: 'compass-09@hearts.foundation', name: 'Layla Qureshi', role: 'learner', persona: 'secular', lastDays: 15 },
  { email: 'compass-10@hearts.foundation', name: 'Tariq Ahmed', role: 'learner', persona: 'progressive', lastDays: 13 },
  { email: 'compass-11@hearts.foundation', name: 'Noor Jamil', role: 'learner', persona: 'academic', lastDays: 7 },
  { email: 'compass-12@hearts.foundation', name: 'Samir Chowdhury', role: 'learner', persona: 'devout', lastDays: 22 },
]

type Doc = Record<string, unknown> & { id: number }

async function one(payload: Payload, collection: string, where: Record<string, unknown>) {
  const found = await payload.find({ collection: collection as never, overrideAccess: true, depth: 0, limit: 1, where: where as never })
  return (found.docs[0] as unknown as Doc | undefined) || null
}

function tenantsOf(user: Doc) {
  const rows = Array.isArray(user.tenants) ? user.tenants : []
  return rows.map((row) => idOf((row as { tenant?: unknown }).tenant)).filter((id): id is number => Boolean(id))
}

/** Days of the five months before the latest look. Not the 15th, so the chart does not look stamped. */
const LOOK_DAYS = [3, 18, 9, 27, 2]

/** Those five days, then the latest look itself. */
function lookAges(lastDays: number, nowMs: number) {
  const last = new Date(nowMs - lastDays * DAY)
  const ages: number[] = []
  for (let back = 5; back >= 1; back -= 1) {
    const day = LOOK_DAYS[5 - back]
    const at = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - back, day, 12, 0, 0))
    const age = Math.round((nowMs - at.getTime()) / DAY)
    if (age > lastDays + 5) ages.push(age)
  }
  ages.push(lastDays)
  return ages
}

/** A scale that can sit below zero and then rise, still inside the persona band. */
function liftScale(band: PersonaBand): ScaleKey {
  const room = band.ranges
    .filter((row) => row.min != null && row.max != null && row.min < 0 && row.max > row.min)
    .sort((a, b) => (b.max! - b.min!) - (a.max! - a.min!) || SCALE_KEYS.indexOf(a.scale) - SCALE_KEYS.indexOf(b.scale))
  return room[0]?.scale || SCALE_KEYS[0]
}

function drifted(band: PersonaBand, month: number, months: number, lift: ScaleKey) {
  const reading = midpointReading(band)
  for (const row of band.ranges) {
    if (row.min == null || row.max == null) continue
    const mid = Math.round((row.min + row.max) / 2)
    const wobble = ((month * 2) % 3) - 1
    const rung = Math.min(row.max, Math.max(row.min, mid + wobble))
    reading[row.scale] = rung / 10
  }
  const span = band.ranges.find((row) => row.scale === lift)
  const low = span?.min != null && span.min < 0 ? span.min : -5
  const high = span?.max != null && span.max > low ? span.max : low + 4
  reading[lift] = (month < months - 1 ? low : high) / 10
  return reading
}

function sameUtcDay(stored: unknown, wanted: string) {
  const left = new Date(String(stored || ''))
  const right = new Date(wanted)
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return false
  return left.getUTCFullYear() === right.getUTCFullYear() && left.getUTCMonth() === right.getUTCMonth() && left.getUTCDate() === right.getUTCDate()
}

function scalesDiffer(stored: unknown, wanted: Partial<Record<ScaleKey, number>>) {
  const current = stored && typeof stored === 'object' ? stored as Record<string, unknown> : {}
  return SCALE_KEYS.some((key) => wanted[key] != null && Number(current[key]) !== wanted[key])
}

async function main() {
  const payload = await getPayload({ config })
  let portal = await one(payload, 'portals', { slug: { equals: SLUG } })
  if (!portal) {
    portal = (await payload.create({
      collection: 'portals',
      overrideAccess: true,
      data: { name: 'Hearts demo', slug: SLUG, kind: 'mosque', welcome: 'A quiet room for a short talk, when you have a moment.', timeZone: 'America/Toronto' },
    })) as unknown as Doc
    console.log(`Created portal ${SLUG}.`)
  } else if (portal.timeZone !== 'America/Toronto') {
    await payload.update({ collection: 'portals', id: portal.id, overrideAccess: true, data: { timeZone: 'America/Toronto' } })
    portal.timeZone = 'America/Toronto'
    console.log(`Portal ${SLUG} is already there. Time zone set to America/Toronto.`)
  } else {
    console.log(`Portal ${SLUG} is already there. Time zone is America/Toronto.`)
  }
  const portalId = portal.id

  const scaleIds = new Map<string, number>()
  for (const key of SCALE_KEYS) {
    const scale = await one(payload, 'heart-scales', { key: { equals: key } })
    if (!scale) throw new Error(`Heart scale “${key}” is missing. Run the main seed before demo:compass. Nothing else was written.`)
    scaleIds.set(key, scale.id)
  }

  const lessons = new Map<ScaleKey, number>()
  for (const scale of SCALE_KEYS) {
    const token = `compass-demo-${scale}`
    let course = await one(payload, 'courses', { importToken: { equals: token } })
    if (course && idOf(course.portal) !== portalId) {
      throw new Error(`Course ${token} belongs to another portal. Stopping so nothing else is touched.`)
    }
    if (!course) {
      course = (await payload.create({
        collection: 'courses',
        overrideAccess: true,
        data: {
          title: TITLES[scale],
          summary: 'A short sitting for the demo circle.',
          speaker: 'The demo circle',
          origin: 'local',
          portal: portalId,
          importable: false,
          isPublic: false,
          importToken: token,
          visibility: 'published',
        },
      })) as unknown as Doc
    }
    let unit = await one(payload, 'units', { course: { equals: course.id } })
    if (!unit) {
      unit = (await payload.create({ collection: 'units', overrideAccess: true, data: { title: 'The sitting', course: course.id, order: 1 } })) as unknown as Doc
    }
    let lesson = await one(payload, 'lessons', { and: [{ course: { equals: course.id } }, { title: { equals: TITLES[scale] } }] })
    const seconds = scale === 'discipline' ? 180 : scale === 'gratitude' || scale === 'worry' ? 25 : 180
    if (!lesson) {
      lesson = (await payload.create({
        collection: 'lessons',
        overrideAccess: true,
        data: {
          title: TITLES[scale],
          unit: unit.id,
          course: course.id,
          portal: portalId,
          master: false,
          order: 1,
          speaker: 'The demo circle',
          durationSeconds: seconds,
          transcriptSource: 'none',
        },
      })) as unknown as Doc
    }
    const door = DOORS.find((row) => row.number === SCALE_DOOR[scale])
    const clause = door ? await one(payload, 'clauses', { number: { equals: door.clauses[0] } }) : null
    const tagNote = `compass-demo:${scale}`
    const tag = await one(payload, 'tags', { note: { equals: tagNote } })
    if (!tag) {
      await payload.create({
        collection: 'tags',
        overrideAccess: true,
        data: {
          item: { relationTo: 'lessons', value: lesson.id },
          clause: clause?.id,
          scale: scaleIds.get(scale),
          weight: 1,
          state: 'confirmed',
          note: tagNote,
        },
      })
    }
    lessons.set(scale, lesson.id)
  }

  const nowMs = Date.now()
  let createdAccounts = 0
  for (const [personIndex, person] of PEOPLE.entries()) {
    const existing = await one(payload, 'users', { email: { equals: person.email } })
    let user = existing
    if (existing) {
      const homes = tenantsOf(existing)
      if (homes.some((id) => id !== portalId)) {
        console.log(`Skipping ${person.email}: they already belong to another portal.`)
        continue
      }
      // An account that already exists keeps its password. demo-learner and demo-complete are live.
    } else {
      const password = passwordForNewAccount(true)
      createdAccounts += 1
      user = (await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          email: person.email,
          password,
          name: person.name,
          role: person.role,
          audience: person.role === 'learner' ? 'learner' : undefined,
          tenants: [{ tenant: portalId }],
          onboarded: true,
          seenWelcome: true,
        },
      })) as unknown as Doc
    }
    if (!user || person.role !== 'learner' || !person.persona) continue
    const band = PERSONA_V2.find((row) => row.key === person.persona)
    if (!band) continue
    const ages = lookAges(person.lastDays || 12, nowMs)
    const lift = liftScale(band)
    for (let month = 0; month < ages.length; month += 1) {
      const demoKey = `${SLUG}:${person.email}:${month}`
      const already = await one(payload, 'compass-attempts', { demoKey: { equals: demoKey } })
      const at = new Date(nowMs - ages[month] * DAY).toISOString()
      const life = lifeForDemo(personIndex, month)
      const monthRound = month === 0 ? null : formForRound(month - 1)
      const scales = drifted(band, month, ages.length, lift)
      if (!already) {
        await payload.create({
          collection: 'compass-attempts',
          overrideAccess: true,
          data: {
            user: user.id,
            portal: portalId,
            at,
            bank: month === 0 ? 'opening' : 'month',
            formKey: monthRound?.id,
            lifeKey: life.keys[0],
            lifeKeys: life.keys,
            lifeNote: life.note || undefined,
            demoKey,
            scales,
          },
        } as never)
      } else {
        const data: Record<string, unknown> = {}
        if (!sameUtcDay(already.at, at)) data.at = at
        if (scalesDiffer(already.scales, scales)) data.scales = scales
        if (String(already.lifeNote || '') !== life.note || JSON.stringify(already.lifeKeys || []) !== JSON.stringify(life.keys)) {
          data.lifeKey = life.keys[0]
          data.lifeKeys = life.keys
          data.lifeNote = life.note || undefined
        }
        if (Object.keys(data).length) {
          await payload.update({ collection: 'compass-attempts', id: already.id, overrideAccess: true, data } as never)
        }
      }
      if (month < 2) continue
      const scale = SCALE_KEYS[month % SCALE_KEYS.length]
      const serveKey = `${SLUG}:serve:${person.email}:${month}`
      const served = await one(payload, 'compass-serves', { demoKey: { equals: serveKey } })
      const lessonId = lessons.get(scale)
      if (served && lessonId && String(served.why || '') !== whyDeficit(scale)) {
        await payload.update({
          collection: 'compass-serves',
          id: served.id,
          overrideAccess: true,
          data: { why: whyDeficit(scale), kind: scale === 'gratitude' || scale === 'worry' ? 'hors' : 'appetiser' },
        } as never)
      }
      if (!served && lessonId) {
        const serveAt = new Date(nowMs - ages[month] * DAY + DAY).toISOString()
        await payload.create({
          collection: 'compass-serves',
          overrideAccess: true,
          data: {
            user: user.id,
            portal: portalId,
            lesson: lessonId,
            title: TITLES[scale],
            kind: scale === 'gratitude' || scale === 'worry' ? 'hors' : 'appetiser',
            why: whyDeficit(scale),
            mix: DEFAULT_MIX,
            at: serveAt,
            door: SCALE_DOOR[scale],
            bucket: 'deficit',
            demoKey: serveKey,
          },
        } as never)
        if (month % 2 === 0) {
          const watched = await one(payload, 'completions', { and: [{ user: { equals: user.id } }, { lesson: { equals: lessonId } }] })
          if (!watched) {
            await payload.create({
              collection: 'completions',
              overrideAccess: true,
              data: { user: user.id, lesson: lessonId, portal: portalId, percent: 100, sourceLevel: 'appetiser', watchedAt: new Date(nowMs - ages[month] * DAY + 2 * DAY).toISOString() },
            })
          }
        }
      }
    }
    const liftLesson = lessons.get(lift)
    if (ages.length >= 2 && liftLesson) {
      const prevAt = nowMs - ages[ages.length - 2] * DAY
      const lastAt = nowMs - ages[ages.length - 1] * DAY
      const watchedAt = new Date(prevAt + Math.round((lastAt - prevAt) * 0.45)).toISOString()
      const watched = await one(payload, 'completions', { and: [{ user: { equals: user.id } }, { lesson: { equals: liftLesson } }] })
      if (!watched) {
        await payload.create({
          collection: 'completions',
          overrideAccess: true,
          data: { user: user.id, lesson: liftLesson, portal: portalId, percent: 100, sourceLevel: 'appetiser', watchedAt },
        })
      } else {
        const when = new Date(String(watched.watchedAt || watched.createdAt || '')).getTime()
        if (!(when >= prevAt && when < lastAt)) {
          await payload.update({ collection: 'completions', id: watched.id, overrideAccess: true, data: { watchedAt } })
        }
      }
    }
  }
  console.log(`Compass demo is in place on ${SLUG}. ${createdAccounts ? `New accounts use ${passwordForNewAccount(true)}.` : 'No new accounts.'} Existing accounts keep their password.`)
}

main().catch((error) => {
  const detail = error && typeof error === 'object' && 'data' in error ? (error as { data?: unknown }).data : undefined
  console.error(error instanceof Error ? error.message : error)
  if (detail) console.error(JSON.stringify(detail, null, 2))
  process.exit(1)
})
