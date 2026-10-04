import type { Payload } from 'payload'
import { DEMO_PORTAL_SLUG, demoPortalGuard, linkLabel } from '@/lib/gather'
import { DOORS, doorCode } from '@/lib/doors'
import { portalIdOf } from '@/lib/ids'
import type { SessionUser } from '@/server/context'

const LEARNERS = ['demo-learner@hearts.foundation', 'demo-complete@hearts.foundation']

type Plan = {
  seedKey: string
  title: string
  kind: 'circle' | 'tea' | 'volunteer' | 'walk' | 'youth' | 'picnic'
  audience: 'brothers' | 'sisters' | 'family' | 'youth' | 'all'
  days: number
  place: string
  bring: string
  note: string
  door: number
  capacity: number
  linkCourse?: boolean
}

const PLAN: Plan[] = [
  { seedKey: 'gather-demo-isha', title: 'Circle after Isha', kind: 'circle', audience: 'all', days: 2, place: 'The prayer hall', bring: 'Nothing. Just come as you are.', note: 'A short circle once the prayer is done.', door: 16, capacity: 24 },
  { seedKey: 'gather-demo-tea', title: 'Tea and talk', kind: 'tea', audience: 'all', days: 5, place: 'The sisters’ and brothers’ tea room, sitting separately', bring: 'A cup is poured for you.', note: 'We take one door from the hadith and sit with it.', door: 7, capacity: 16, linkCourse: true },
  { seedKey: 'gather-demo-food', title: 'Food bank run', kind: 'volunteer', audience: 'all', days: 8, place: 'Meet at the masjid gate, then the food bank', bring: 'Closed shoes and a water bottle.', note: 'An hour of carrying and sorting. No speech, just the work.', door: 6, capacity: 12 },
  { seedKey: 'gather-demo-walk', title: 'Sisters’ walk', kind: 'walk', audience: 'sisters', days: 10, place: 'The park gate beside the masjid', bring: 'A coat if the evening is cool.', note: 'A walk and a quiet conversation. Sisters only.', door: 5, capacity: 18 },
  { seedKey: 'gather-demo-youth', title: 'Youth football and a talk', kind: 'youth', audience: 'youth', days: 12, place: 'The astroturf, then the hall', bring: 'Trainers if you have them.', note: 'Kickabout first, then twenty minutes on the week’s door.', door: 13, capacity: 2 },
  { seedKey: 'gather-demo-picnic', title: 'Family picnic', kind: 'picnic', audience: 'family', days: 18, place: 'The green behind the masjid', bring: 'A blanket and something to share.', note: 'Children are welcome. We finish before Maghrib.', door: 1, capacity: 40 },
  { seedKey: 'gather-demo-past-circle', title: 'Thursday circle on gratitude', kind: 'circle', audience: 'all', days: -10, place: 'The prayer hall', bring: 'Nothing.', note: 'We sat with gratitude after Isha.', door: 10, capacity: 20 },
  { seedKey: 'gather-demo-past-brothers', title: 'Brothers’ tea', kind: 'tea', audience: 'brothers', days: -3, place: 'The brothers’ room', bring: 'Nothing.', note: 'Tea, and one question from the talk.', door: 3, capacity: 14 },
]

function at(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  date.setUTCHours(18, 30, 0, 0)
  return date.toISOString()
}

async function one(payload: Payload, collection: 'portals' | 'gatherings' | 'gather-rsvps' | 'gather-checkins' | 'users' | 'courses' | 'lessons', where: unknown) {
  const found = await payload.find({ collection, overrideAccess: true, depth: 0, limit: 1, where: where as never })
  return (found.docs[0] as { id: number } | undefined) || null
}

export async function seedGatherDemo(payload: Payload) {
  const portal = await one(payload, 'portals', { slug: { equals: DEMO_PORTAL_SLUG } })
  const guard = demoPortalGuard(portal ? DEMO_PORTAL_SLUG : null)
  if (!portal || guard) {
    return { ok: false as const, reason: guard || `Refusing to seed Gather. This script only touches ${DEMO_PORTAL_SLUG}.` }
  }
  const portalId = portal.id
  const learners: { id: number; email: string }[] = []
  for (const email of LEARNERS) {
    const user = await one(payload, 'users', { email: { equals: email } })
    if (!user) continue
    const full = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true })
    if (portalIdOf(full as SessionUser) !== portalId) continue
    learners.push({ id: user.id, email })
  }
  let courseId: number | null = null
  let lessonId: number | null = null
  let courseTitle = ''
  let lessonTitle = ''
  const course = await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ title: { contains: 'Names' } }, { portal: { equals: portalId } }] } })
  if (course.docs[0]) {
    courseId = course.docs[0].id
    courseTitle = String((course.docs[0] as { title?: string }).title || '')
    const lesson = await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 1, where: { course: { equals: courseId } }, sort: 'order' })
    if (lesson.docs[0]) {
      lessonId = lesson.docs[0].id
      lessonTitle = String((lesson.docs[0] as { title?: string }).title || '')
    }
  }
  let created = 0
  let reused = 0
  for (const item of PLAN) {
    const door = DOORS.find((row) => row.number === item.door)!
    let row = await one(payload, 'gatherings', { and: [{ seedKey: { equals: item.seedKey } }, { portal: { equals: portalId } }] })
    if (row) reused += 1
    else {
      const made = await payload.create({
        collection: 'gatherings',
        overrideAccess: true,
        data: {
          title: item.title,
          kind: item.kind,
          audience: item.audience,
          startsAt: at(item.days),
          place: item.place,
          capacity: item.capacity,
          bring: item.bring,
          note: item.note,
          hostLabel: item.audience === 'sisters' ? 'A sister from the circle' : 'Imam of the masjid',
          door: item.door,
          course: item.linkCourse ? courseId || undefined : undefined,
          lesson: item.linkCourse ? lessonId || undefined : undefined,
          linkLabel: linkLabel({
            doorCode: doorCode(door.number),
            doorTitle: door.title,
            courseTitle: item.linkCourse ? courseTitle : '',
            lessonTitle: item.linkCourse ? lessonTitle : '',
          }),
          slug: item.seedKey,
          checkinToken: `demo-${item.seedKey}`,
          prompts: ['What stayed with you from the talk?', 'Where could this show up before next week?'],
          status: 'published',
          seedKey: item.seedKey,
          portal: portalId,
        } as never,
      })
      row = { id: made.id }
      created += 1
    }
    const past = item.days < 0
    const guests = past
      ? [
          { key: `${item.seedKey}-yusuf`, name: 'Yusuf', contact: 'yusuf.guest@example.net', status: 'going' as const },
          { key: `${item.seedKey}-maryam`, name: 'Maryam', contact: 'maryam.guest@example.net', status: 'going' as const },
        ]
      : [
          { key: `${item.seedKey}-idris`, name: 'Idris', contact: 'idris.guest@example.net', status: 'going' as const },
          { key: `${item.seedKey}-sara`, name: 'Sara', contact: 'sara.guest@example.net', status: item.capacity <= 2 ? 'waitlist' as const : 'maybe' as const },
        ]
    for (const [index, learner] of learners.entries()) {
      const seedKey = `${item.seedKey}-user-${learner.id}`
      const existing = await one(payload, 'gather-rsvps', { and: [{ seedKey: { equals: seedKey } }, { portal: { equals: portalId } }] })
      if (!existing) {
        await payload.create({
          collection: 'gather-rsvps',
          overrideAccess: true,
          data: {
            gathering: row.id,
            user: learner.id,
            status: item.capacity <= 2 && index > 0 ? 'waitlist' : 'going',
            seedKey,
            portal: portalId,
          } as never,
        })
      }
      if (past) {
        const checkKey = `${item.seedKey}-in-${learner.id}`
        const checked = await one(payload, 'gather-checkins', { and: [{ seedKey: { equals: checkKey } }, { portal: { equals: portalId } }] })
        if (!checked) {
          const earlier = await payload.find({
            collection: 'gather-checkins',
            overrideAccess: true,
            depth: 0,
            limit: 1,
            where: { and: [{ portal: { equals: portalId } }, { user: { equals: learner.id } }] },
          })
          await payload.create({
            collection: 'gather-checkins',
            overrideAccess: true,
            data: {
              gathering: row.id,
              user: learner.id,
              method: 'qr',
              newcomer: earlier.totalDocs === 0,
              guestLabel: learner.email.startsWith('demo-learner') ? 'Learner' : 'Complete',
              seedKey: checkKey,
              portal: portalId,
            } as never,
          })
        }
      }
    }
    for (const guest of guests) {
      const existing = await one(payload, 'gather-rsvps', { and: [{ seedKey: { equals: guest.key } }, { portal: { equals: portalId } }] })
      if (existing) continue
      const broughtBy = guest.key.endsWith('idris') ? learners[0]?.id : undefined
      await payload.create({
        collection: 'gather-rsvps',
        overrideAccess: true,
        data: {
          gathering: row.id,
          status: guest.status,
          guestName: guest.name,
          guestContact: guest.contact,
          guestToken: `demo-${guest.key}`,
          broughtBy,
          seedKey: guest.key,
          portal: portalId,
        } as never,
      })
      if (past && guest.status === 'going') {
        const checkKey = `${guest.key}-in`
        if (!(await one(payload, 'gather-checkins', { seedKey: { equals: checkKey } }))) {
          await payload.create({
            collection: 'gather-checkins',
            overrideAccess: true,
            data: {
              gathering: row.id,
              method: 'qr',
              newcomer: guest.name === 'Maryam',
              guestLabel: guest.name,
              seedKey: checkKey,
              portal: portalId,
            } as never,
          })
        }
      }
    }
  }
  const other = await payload.find({ collection: 'gatherings', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ seedKey: { like: 'gather-demo-' } }, { portal: { not_equals: portalId } }] } })
  if (other.docs.length) {
    return { ok: false as const, reason: 'Demo gatherings were found outside hearts-demo. Nothing further was written.' }
  }
  return { ok: true as const, created, reused, portalId }
}
