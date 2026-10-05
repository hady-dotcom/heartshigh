import type { Payload } from 'payload'
import { DEMO_PORTAL_SLUG, demoPortalGuard, linkLabel } from '@/lib/gather'
import { DOORS, doorCode } from '@/lib/doors'
import { portalIdOf } from '@/lib/ids'
import type { SessionUser } from '@/server/context'
import { grantCurrentConsents } from '@/server/consent'

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
  entryCode: string
  linkCourse?: boolean
}

const PLAN: Plan[] = [
  { seedKey: 'gather-demo-isha', title: 'Circle after Isha', kind: 'circle', audience: 'all', days: 2, place: 'The prayer hall', bring: 'Nothing. Just come as you are.', note: 'A short circle once the prayer is done.', door: 16, capacity: 24, entryCode: 'NUR4' },
  { seedKey: 'gather-demo-tea', title: 'Tea and talk', kind: 'tea', audience: 'all', days: 5, place: 'The sisters’ and brothers’ tea room, sitting separately', bring: 'A cup is poured for you.', note: 'We take one door from the hadith and sit with it.', door: 7, capacity: 16, entryCode: 'KRM7', linkCourse: true },
  { seedKey: 'gather-demo-food', title: 'Food bank run', kind: 'volunteer', audience: 'all', days: 8, place: 'Meet at the masjid gate, then the food bank', bring: 'Closed shoes and a water bottle.', note: 'An hour of carrying and sorting. No speech, just the work.', door: 6, capacity: 12, entryCode: 'ZKT6' },
  { seedKey: 'gather-demo-walk', title: 'Sisters’ walk', kind: 'walk', audience: 'sisters', days: 10, place: 'The park gate beside the masjid', bring: 'A coat if the evening is cool.', note: 'A walk and a quiet conversation. Sisters only.', door: 5, capacity: 18, entryCode: 'SLM5' },
  { seedKey: 'gather-demo-youth', title: 'Youth football and a talk', kind: 'youth', audience: 'youth', days: 12, place: 'The astroturf, then the hall', bring: 'Trainers if you have them.', note: 'Kickabout first, then twenty minutes on the week’s door.', door: 13, capacity: 2, entryCode: 'FTB2' },
  { seedKey: 'gather-demo-picnic', title: 'Family picnic', kind: 'picnic', audience: 'family', days: 18, place: 'The green behind the masjid', bring: 'A blanket and something to share.', note: 'Children are welcome. We finish before Maghrib.', door: 1, capacity: 40, entryCode: 'DY14' },
  { seedKey: 'gather-demo-past-circle', title: 'Thursday circle on gratitude', kind: 'circle', audience: 'all', days: -17, place: 'The prayer hall', bring: 'Nothing.', note: 'We sat with gratitude after Isha.', door: 10, capacity: 20, entryCode: 'SHKR' },
  { seedKey: 'gather-demo-past-brothers', title: 'Brothers’ tea', kind: 'tea', audience: 'brothers', days: -15, place: 'The brothers’ room', bring: 'Nothing.', note: 'Tea, and one question from the talk.', door: 3, capacity: 14, entryCode: 'AKH3' },
  { seedKey: 'gather-demo-past-walk', title: 'Evening walk', kind: 'walk', audience: 'all', days: -13, place: 'The park gate beside the masjid', bring: 'A coat if the evening is cool.', note: 'A short walk after the prayer.', door: 5, capacity: 16, entryCode: 'WLK5' },
  { seedKey: 'gather-demo-past-food', title: 'Saturday food bank', kind: 'volunteer', audience: 'all', days: -12, place: 'Meet at the masjid gate', bring: 'Closed shoes.', note: 'An hour of carrying and sorting.', door: 6, capacity: 12, entryCode: 'FD12' },
  { seedKey: 'gather-demo-past-youth', title: 'Youth night', kind: 'youth', audience: 'youth', days: -9, place: 'The hall', bring: 'Trainers if you have them.', note: 'A kickabout, then one question.', door: 13, capacity: 18, entryCode: 'YTH9' },
  { seedKey: 'gather-demo-past-picnic', title: 'Family afternoon', kind: 'picnic', audience: 'family', days: -8, place: 'The green behind the masjid', bring: 'A blanket.', note: 'We finished before Maghrib.', door: 1, capacity: 30, entryCode: 'FAM8' },
  { seedKey: 'gather-demo-past-tea', title: 'Tea after Maghrib', kind: 'tea', audience: 'all', days: -6, place: 'The tea room', bring: 'Nothing.', note: 'One door, and a cup of tea.', door: 9, capacity: 16, entryCode: 'TEA6' },
  { seedKey: 'gather-demo-past-sisters', title: 'Sisters’ circle', kind: 'circle', audience: 'sisters', days: -3, place: 'The sisters’ room', bring: 'Nothing.', note: 'A quiet circle after Isha.', door: 12, capacity: 14, entryCode: 'SIS3' },
]

const BRINGERS = [
  { email: 'gather-maryam@hearts.foundation', name: 'Maryam Ali' },
  { email: 'gather-yusuf@hearts.foundation', name: 'Yusuf Khan' },
  { email: 'gather-amina@hearts.foundation', name: 'Amina Begum' },
  { email: 'gather-layla@hearts.foundation', name: 'Layla Noor' },
  { email: 'gather-hassan@hearts.foundation', name: 'Hassan Rahman' },
  { email: 'gather-khadija@hearts.foundation', name: 'Khadija Omar' },
]

const GUESTS = [
  'Idris Rahman',
  'Sara Begum',
  'Hamza Ali',
  'Omar Farooq',
  'Fatima Shah',
  'Bilal Malik',
  'Zayd Qureshi',
  'Hana Karim',
  'Noor Hassan',
  'Adam Osman',
  'Leila Ahmed',
  'Sami Rahman',
  'Khalid Saleh',
  'Rania Farooq',
]

/** Extra regulars on each past night, so the attendance bars are not one height. */
const EXTRA_REGULARS = [2, 6, 3, 8, 4, 11, 5, 9]

function guestFor(planIndex: number, bringerName: string) {
  const taken = new Set(['Amina', 'Yusuf', bringerName.split(/\s+/)[0] || ''])
  for (let step = 0; step < GUESTS.length; step += 1) {
    const name = GUESTS[(planIndex + step) % GUESTS.length]
    if (!taken.has(name.split(/\s+/)[0] || '')) return name
  }
  return GUESTS[planIndex % GUESTS.length]
}

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
  const bringers: { id: number; name: string }[] = []
  for (const person of BRINGERS) {
    let row = await one(payload, 'users', { email: { equals: person.email } })
    if (!row) {
      const made = await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: { email: person.email, password: 'a-long-demo-password', name: person.name, role: 'learner', tenants: [{ tenant: portalId }] } as never,
      })
      row = { id: made.id }
    }
    await grantCurrentConsents(payload, row.id, portalId)
    bringers.push({ id: row.id, name: person.name })
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
  for (const [planIndex, item] of PLAN.entries()) {
    const door = DOORS.find((row) => row.number === item.door)!
    let row = await one(payload, 'gatherings', { and: [{ seedKey: { equals: item.seedKey } }, { portal: { equals: portalId } }] })
    if (row) {
      reused += 1
      const current = await payload.findByID({ collection: 'gatherings', id: row.id, depth: 0, overrideAccess: true })
      if (!String((current as { entryCode?: string }).entryCode || '')) {
        await payload.update({ collection: 'gatherings', id: row.id, overrideAccess: true, data: { entryCode: item.entryCode } as never })
      }
    } else {
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
          entryCode: item.entryCode,
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
    const bringer = bringers[planIndex % bringers.length]
    const guestName = guestFor(planIndex, bringer?.name || '')
    const guestSlug = guestName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const guests = [
      { key: `${item.seedKey}-brought`, name: guestName, contact: `${guestSlug}.${item.seedKey}@example.net`, status: 'going' as const, broughtBy: bringer?.id },
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
      const broughtBy = guest.broughtBy
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
              newcomer: true,
              guestLabel: guest.name,
              seedKey: checkKey,
              portal: portalId,
            } as never,
          })
        }
      }
    }
    if (past) {
      const pastIndex = PLAN.slice(0, planIndex + 1).filter((row) => row.days < 0).length - 1
      const extra = EXTRA_REGULARS[pastIndex] || 0
      for (let n = 0; n < extra; n += 1) {
        const checkKey = `${item.seedKey}-extra-${n}`
        if (await one(payload, 'gather-checkins', { and: [{ seedKey: { equals: checkKey } }, { portal: { equals: portalId } }] })) continue
        await payload.create({
          collection: 'gather-checkins',
          overrideAccess: true,
          data: {
            gathering: row.id,
            method: 'host',
            newcomer: false,
            guestLabel: 'Regular',
            seedKey: checkKey,
            portal: portalId,
          } as never,
        })
      }
    }
    if (past && bringer) {
      const checkKey = `${item.seedKey}-bringer-${bringer.id}`
      if (!(await one(payload, 'gather-checkins', { seedKey: { equals: checkKey } }))) {
        await payload.create({
          collection: 'gather-checkins',
          overrideAccess: true,
          data: {
            gathering: row.id,
            user: bringer.id,
            method: 'qr',
            newcomer: false,
            guestLabel: bringer.name,
            seedKey: checkKey,
            portal: portalId,
          } as never,
        })
      }
    }
  }
  const other = await payload.find({ collection: 'gatherings', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ seedKey: { like: 'gather-demo-' } }, { portal: { not_equals: portalId } }] } })
  if (other.docs.length) {
    return { ok: false as const, reason: 'Demo gatherings were found outside hearts-demo. Nothing further was written.' }
  }
  return { ok: true as const, created, reused, portalId }
}
