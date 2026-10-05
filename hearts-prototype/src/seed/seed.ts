import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { getPayload } from 'payload'
import config from '../payload.config'
import { randomCode } from '../lib/access-codes'
import { answersForPoint } from '../lib/circle-fill'
import { dualExtract } from '../lib/extractor'
import { DOORS, doorLabel, doorOfClause } from '../lib/doors'
import { parseJibrilMap } from '../lib/seats'
import { alignToCaptions } from '../lib/tiers'
import { parseTranscript } from '../lib/transcript'
import { seedHarvest } from './harvest'
import { seedDoors } from '../server/doors'
import type { User } from '../payload-types'
import { databaseKind, seedRefusal } from '../lib/env'
import { clearDevPushMarker } from '../lib/prepare-db'
import { FILMS } from './films'
import { seedOpening, seedPeople, timingCheck } from './opening'
import { seedSpeakers } from './speakers'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const CLAUSES: [number, string, string, string][] = [
  [1, 'One day', 'Sitting', 'The day is the unit of time you are given.'],
  [2, 'We were sitting', 'Sitting', 'A we: the circle, and contemplation inside it.'],
  [3, 'With the Messenger of Allah', 'Sitting', 'Witnessing. The companions, and us in the same sitting.'],
  [4, 'A man appeared', 'Sitting', 'Do not underrate a guest. Angel in human form.'],
  [5, 'Clothes exceedingly white', 'Sitting', 'Cleanliness and how you look when you sit.'],
  [6, 'Hair exceedingly black', 'Sitting', 'The same care, closer to the body.'],
  [7, 'No signs of travel', 'Sitting', 'How you approach knowledge, and rumour.'],
  [8, 'None of us knew him', 'Sitting', 'The unknown guest is still due the greeting.'],
  [9, 'He sat down by the Prophet', 'Sitting', 'Taking a place in the circle.'],
  [10, 'Knees against his knees', 'Sitting', 'The chain is closeness, not extraction.'],
  [11, 'Palms on his thighs', 'Sitting', 'The same body that will pray.'],
  [12, 'O Muhammad', 'Sitting', 'The praised one. Stop there.'],
  [13, 'Tell me about Islam', 'Islam', 'Classified. It follows itself through.'],
  [14, 'Two testimonies', 'Islam', 'The word is a claim.'],
  [15, 'Establish the prayer', 'Islam', 'Where you pray, and the extra prayers too.'],
  [16, 'Pay zakat', 'Islam', 'Wealth has people it is for.'],
  [17, 'Fast Ramadan', 'Islam', 'Fasting from food, and from a harsh tongue.'],
  [18, 'Hajj if you find a way', 'Islam', 'The walk toward the House, and the ordinary walk that helps.'],
  [19, 'You have spoken the truth', 'Islam', 'What you thought you knew meets the real.'],
  [20, 'Amazed, he asked, then confirmed', 'Islam', 'He waited. No backtalk in the circle.'],
  [21, 'Tell me about iman', 'Iman', 'The six as they are. Islam is not iman.'],
  [22, 'Believe in Allah', 'Iman', 'Knowledge of the Creator.'],
  [23, 'His angels', 'Iman', 'Thin on purpose. Jibril is already in the room.'],
  [24, 'His books', 'Iman', 'The Qur’an as His speech, then opened as lessons.'],
  [25, 'His messengers', 'Iman', 'The Prophet’s miracles, and the Sunna you can walk.'],
  [26, 'The Last Day', 'Iman', 'Stays in iman. Tomb, resurrection, Garden and Fire.'],
  [27, 'Qadar, good and evil', 'Iman', 'Actions created by Allah, acquired by servants.'],
  [28, 'You have spoken the truth', 'Iman', 'Say the articles as real.'],
  [29, 'Tell me about ihsan', 'Ihsan', 'Lived, not only read. A teacher still presents the basics.'],
  [30, 'Worship as though you see Him', 'Ihsan', 'They do what they are supposed to do.'],
  [31, 'If you do not, He sees you', 'Ihsan', 'The inverse of the same act.'],
  [32, 'Tell me about the Hour', 'Hour', 'A time of knowledge, a time that will come.'],
  [33, 'The one asked knows no more', 'Hour', 'Limits of the unseen, and of how we talk.'],
  [34, 'The slave-girl gives birth to her mistress', 'Hour', 'Considerations. Allah knows best.'],
  [35, 'Shepherds competing in buildings', 'Hour', 'How you live in a time, not a checklist of portents.'],
  [36, 'He left', 'Trunk', 'The guest goes, and the teaching stays with the people in the room.'],
  [37, 'I stayed a while', 'Trunk', 'Staying with a meaning before rushing on.'],
  [38, 'Do you know who the questioner was?', 'Trunk', 'The Prophet turns the question back to Umar.'],
  [39, 'Allah and His Messenger know best', 'Trunk', 'The manners of saying you do not know.'],
  [40, 'It was Jibril', 'Trunk', 'The guest was the angel of revelation.'],
  [41, 'He came to teach you your religion', 'Trunk', 'The whole sitting was the lesson.'],
]

const PLACING = [
  {
    prompt: 'When you think about who you answer to, who comes to mind first?',
    why: 'This helps us choose whether your first sitting is about Allah, the Prophet, or the people around you.',
    options: ['My Lord | 22', 'The Prophet | 3', 'The people I look after | 4', 'I am not sure yet | 2'],
  },
  {
    prompt: 'What would you most like to get from a sitting like this?',
    why: 'Some people come for prayer, some for character, some to know Allah better. We start where you are.',
    options: ['Prayer that holds steady | 15', 'Being kinder to people | 31', 'Knowing the names of Allah | 22', 'Somewhere calm to sit | 2'],
  },
  {
    prompt: 'When a hard week comes, what do you usually do?',
    why: 'Knowing this helps us pick a talk that meets you on an ordinary day.',
    options: ['I go quiet | 30', 'I get short with people | 31', 'I look for a verse | 24', 'I keep busy | 13'],
  },
  {
    prompt: 'Where would you like your first proper talk to begin?',
    why: 'This answer counts twice, because it tells us directly where you would like to start.',
    options: ['With the Prophet | 3', 'With prayer | 15', 'With Allah as Lord | 22', 'With how I treat people | 31'],
  },
]

async function ensureUser(payload: Awaited<ReturnType<typeof getPayload>>, data: Partial<User> & { email: string; password: string }) {
  const found = await payload.find({ collection: 'users', overrideAccess: true, limit: 1, where: { email: { equals: data.email } } })
  if (found.docs[0]) return found.docs[0]
  return payload.create({ collection: 'users', overrideAccess: true, data: data as User & { password: string } })
}

/**
 * Drops every table in place before Payload starts, so the schema is pushed fresh and a running dev server, which
 * holds the same file open, sees the new data rather than a deleted file.
 */
/** The e2e database keeps its codes in its own file, so the codes `npm run go` printed stay true. */
function codesFile() {
  const url = process.env.DATABASE_URL || ''
  if (/hearts-test\.db/.test(url) || /hearts_e2e/.test(url) || process.env.HEARTS_E2E === '1') return 'data/seed-codes-test.json'
  return 'data/seed-codes.json'
}

async function wipe() {
  const refusal = seedRefusal(['--reset'])
  if (refusal) throw new Error(refusal)
  const url = process.env.DATABASE_URL || `file:${path.join(root, 'data/hearts.db')}`
  if (databaseKind() === 'postgres') {
    const { default: pg } = await import('pg')
    const pool = new pg.Pool({ connectionString: url, max: 1 })
    try {
      await pool.query('DROP SCHEMA IF EXISTS public CASCADE')
      await pool.query('CREATE SCHEMA public')
      await pool.query('GRANT ALL ON SCHEMA public TO CURRENT_USER')
      await pool.query('GRANT ALL ON SCHEMA public TO public')
    } finally {
      await pool.end()
    }
    console.log('Wiped the Postgres database (dropped the public schema).')
    return
  }
  const client = createClient({ url })
  const objects = (await client.execute("SELECT type, name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'")).rows as unknown as { type: string; name: string }[]
  await client.execute('PRAGMA foreign_keys = OFF')
  for (const row of objects) await client.execute(`DROP ${row.type === 'view' ? 'VIEW' : 'TABLE'} IF EXISTS "${row.name.replace(/"/g, '""')}"`)
  await client.execute('PRAGMA foreign_keys = ON')
  client.close()
  console.log(`Wiped the database (${objects.length} tables).`)
}

async function main() {
  const startersOnly = process.argv.includes('--starters')
  const refusal = seedRefusal(process.argv)
  if (refusal) {
    console.error(refusal)
    process.exit(1)
  }
  mkdirSync(path.join(root, 'data'), { recursive: true })
  if (process.argv.includes('--reset')) await wipe()
  await clearDevPushMarker()
  const payload = await getPayload({ config })
  if (databaseKind() === 'postgres') await payload.db.migrate()
  const clauseIds = new Map<number, number>()
  const covered = new Set(DOORS.flatMap((door) => door.clauses))
  if (DOORS.length !== 20 || covered.size !== 41) throw new Error('Working doors must be W1 to W20 and cover clauses 1 to 41.')
  for (const [number] of CLAUSES) if (!doorOfClause(number)) throw new Error(`Clause ${number} is not on a working door.`)
  const map = parseJibrilMap(readFileSync(path.join(root, 'content/jibril-map.txt'), 'utf8'))
  for (const [number, fragment, core, fallbackTeaching] of CLAUSES) {
    const entry = map.get(number)
    const teaching = entry?.teaching || fallbackTeaching
    const found = await payload.find({ collection: 'clauses', overrideAccess: true, limit: 1, where: { number: { equals: number } } })
    const doc = found.docs[0]
      ? await payload.update({ collection: 'clauses', id: found.docs[0].id, overrideAccess: true, data: { fragment, core, teaching, series: entry?.series || '' } })
      : await payload.create({ collection: 'clauses', overrideAccess: true, data: { number, fragment, core, teaching, series: entry?.series || '' } })
    clauseIds.set(number, doc.id)
    const seats = await payload.find({ collection: 'seats', overrideAccess: true, limit: 3, where: { clause: { equals: doc.id } }, sort: 'position' })
    const texts = entry?.seats || []
    for (const [index, text] of texts.entries()) {
      const existing = seats.docs.find((seat) => (seat as { position?: number }).position === index + 1)
      if (existing) await payload.update({ collection: 'seats', id: existing.id, overrideAccess: true, data: { text } })
      else await payload.create({ collection: 'seats', overrideAccess: true, data: { clause: doc.id, position: index + 1, text } })
    }
  }
  await seedDoors(payload)

  const shelf = readFileSync(path.join(root, 'content/ghunya-shelf.txt'), 'utf8')
  const existingShelf = await payload.count({ collection: 'shelf-items', overrideAccess: true })
  if (!existingShelf.totalDocs) {
    let section = 'Entering the path'
    for (const line of shelf.split('\n')) {
      const heading = line.match(/^\d+\.\s+(.+)/)
      if (heading) section = heading[1].replace(/■/g, '').trim()
      const item = line.match(/^ {2}→\s+(.+)/)
      if (item) {
        await payload.create({
          collection: 'shelf-items',
          overrideAccess: true,
          data: { volume: 'Ghunya', section, title: item[1].replace(/■/g, '').trim(), empty: false },
        })
      }
    }
  }

  const questions = await payload.count({ collection: 'placing-questions', overrideAccess: true })
  if (!questions.totalDocs) {
    for (const [index, question] of PLACING.entries()) {
      await payload.create({ collection: 'placing-questions', overrideAccess: true, data: { ...question, order: index + 1, portal: undefined } })
    }
  }

  if (!startersOnly) {
    await ensureUser(payload, {
      email: 'master@hearts.test',
      password: 'hearts-master',
      name: 'Master desk',
      role: 'master',
      onboarded: true,
      seenWelcome: true,
    })
  }

  const portals: { name: string; slug: string; kind: 'mosque'; welcome: string; organisationName: string; wizardDone: boolean; colour: string; [key: string]: unknown }[] = [
    {
      name: 'East London Mosque',
      slug: 'east-london',
      kind: 'mosque',
      welcome: 'Welcome to the East London circle. Short talks during the week, and a sitting together on Thursday nights.',
      organisationName: 'East London Mosque',
      learnerWelcomeUrl: 'https://www.youtube.com/watch?v=MK5q_zMiX1g',
      learnerIntroUrl: 'https://www.youtube.com/watch?v=ECaTWkof57E',
      teacherWelcomeUrl: 'https://www.youtube.com/watch?v=ECaTWkof57E',
      teacherIntroUrl: 'https://www.youtube.com/watch?v=MK5q_zMiX1g',
      learnerLabel: 'Learner',
      teacherLabel: 'Teacher',
      wizardDone: true,
      colour: '#1f4d3a',
    },
    {
      name: 'Leeds Chapter',
      slug: 'leeds',
      kind: 'mosque',
      welcome: 'Welcome to the Leeds circle. Watch at your own pace and join us when we meet.',
      organisationName: 'Leeds Chapter',
      wizardDone: true,
      colour: '#6b3a2f',
    },
  ]
  const portalIds = new Map<string, number>()
  for (const portal of startersOnly ? [] : portals) {
    const found = await payload.find({ collection: 'portals', overrideAccess: true, limit: 1, where: { slug: { equals: portal.slug } } })
    const doc = found.docs[0] || (await payload.create({ collection: 'portals', overrideAccess: true, data: portal }))
    portalIds.set(portal.slug, doc.id)
  }

  const courseIds: number[] = []
  for (const film of FILMS) {
    const found = await payload.find({ collection: 'courses', overrideAccess: true, limit: 1, where: { importToken: { equals: film.importToken } } })
    if (found.docs[0]) {
      courseIds.push(found.docs[0].id)
      continue
    }
    let transcript = readFileSync(path.join(root, 'content/transcripts', film.file), 'utf8')
    const captionsFile = film.youtubeId ? path.join(root, 'content/transcripts/starters', `${film.youtubeId}.vtt`) : ''
    if (captionsFile && existsSync(captionsFile) && /timestamps:?\**:?\s*estimated/i.test(transcript.slice(0, 800))) {
      const aligned = alignToCaptions(transcript, readFileSync(captionsFile, 'utf8'))
      transcript = aligned.text.replace(/(\*\*Timestamps:\*\*)\s*estimated/i, `$1 aligned to the YouTube captions (${aligned.matched} of ${aligned.total} lines matched by their opening words; the rest placed between them)`)
    }
    const course = await payload.create({
      collection: 'courses',
      overrideAccess: true,
      data: {
        title: film.title,
        speaker: film.speaker,
        summary: film.summary,
        origin: 'master',
        importable: true,
        isPublic: true,
        importToken: film.importToken,
        visibility: 'published',
      },
    })
    const unit = await payload.create({ collection: 'units', overrideAccess: true, data: { title: 'The sitting', course: course.id, order: 1 } })
    const lesson = await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: {
        title: film.title,
        unit: unit.id,
        course: course.id,
        master: true,
        order: 1,
        speaker: film.speaker,
        youtubeUrl: film.youtubeUrl || undefined,
        youtubeId: film.youtubeId || undefined,
        durationSeconds: film.durationSeconds ?? Math.round(Math.max(...parseTranscript(transcript).cues.map((cue) => cue.end))),
        transcript,
        transcriptSource: 'upload',
        transcriptNote: 'Seeded from the transcript file. YouTube captions are often blocked from cloud machines, so the upload path is what the extractor uses.',
      },
    })
    const cards = CLAUSES.map(([number, fragment, core, teaching]) => ({ number, fragment, core, teaching }))
    const extracted = dualExtract(transcript, cards)
    const toApprove = new Set(extracted.cuts.filter((cut) => cut.bestClause).slice(0, 4).map((cut) => cut.id))
    for (const item of extracted.cuts) {
      const approved = toApprove.has(item.id)
      const cut = await payload.create({
        collection: 'cuts',
        overrideAccess: true,
        data: {
          lesson: lesson.id,
          course: course.id,
          status: approved ? 'approved' : 'draft',
          start: Math.round(item.start),
          end: Math.round(item.end),
          timestamp: item.timestamp,
          hook: item.hook,
          turn: item.turn,
          land: item.land,
          fullContext: item.fullContext,
          theme: item.theme,
          device: item.device,
          whyItAllures: item.whyItAllures,
          bestClause: item.bestClause,
          clauseFragment: item.clauseFragment,
          hangStrength: item.hangStrength,
          whyHang: item.whyHang,
          seatHint: item.seatHint,
          stage2Form: item.stage2Form,
          currencyNote: item.currencyNote,
          quoteConfidence: item.quoteConfidence,
          exemplarAffinity: item.exemplarAffinity,
          kind: item.kind,
          engine: extracted.engine,
        },
      })
      if (item.bestClause && clauseIds.get(item.bestClause)) {
        await payload.create({
          collection: 'tags',
          overrideAccess: true,
          data: { item: { relationTo: 'cuts', value: cut.id }, clause: clauseIds.get(item.bestClause), state: approved ? 'confirmed' : 'suggested', note: [doorOfClause(item.bestClause) ? `${doorLabel(doorOfClause(item.bestClause)!)}.` : '', item.whyHang].filter(Boolean).join(' ') },
        })
      }
      for (const rung of extracted.ladder.filter((row) => row.cutId === item.id)) {
        await payload.create({
          collection: 'ladder-items',
          overrideAccess: true,
          data: { lesson: lesson.id, kind: rung.kind, start: Math.round(rung.start), end: Math.round(rung.end), quote: rung.quote, status: approved ? 'approved' : 'draft' },
        })
      }
    }
    const pointIds: number[] = []
    for (const point of film.points) {
      const created = await payload.create({
        collection: 'engagement-points',
        overrideAccess: true,
        data: {
          lesson: lesson.id,
          second: point.second,
          kind: point.kind as 'reflection',
          prompt: point.prompt,
          options: 'options' in point ? point.options : undefined,
          timing: 'future' in point ? 'future' : 'immediate',
          delayAmount: 'future' in point ? 1 : 0,
          delayUnit: 'day',
          contingent: 'future' in point ? pointIds[0] : undefined,
          audience: 'everyone',
        },
      })
      pointIds.push(created.id)
      for (const draft of answersForPoint({ prompt: point.prompt, kind: point.kind, options: point.options })) {
        await payload.create({
          collection: 'circle-answers',
          overrideAccess: true,
          data: { point: created.id, lesson: lesson.id, name: draft.name, body: draft.body, tone: draft.tone, length: draft.length, origin: 'ai', enabled: true },
        })
      }
    }
    courseIds.push(course.id)
  }

  const elm = portalIds.get('east-london')
  const leeds = portalIds.get('leeds')
  let pack = (await payload.find({ collection: 'packs', overrideAccess: true, limit: 1, where: { title: { equals: 'Jibril sittings' } } })).docs[0]
  if (!pack) {
    pack = await payload.create({
      collection: 'packs',
      overrideAccess: true,
      data: { title: 'Jibril sittings', summary: 'Fahmy and the two Names classes.', owner: 'master', courses: courseIds },
    })
  }
  const parentCourse = courseIds[2]
  let parentPack = (await payload.find({ collection: 'packs', overrideAccess: true, limit: 1, where: { title: { equals: 'One Names class' } } })).docs[0]
  if (!startersOnly && elm && !parentPack) {
    parentPack = await payload.create({
      collection: 'packs',
      overrideAccess: true,
      data: { title: 'One Names class', summary: 'A single course for a parent code.', owner: 'portal', portal: elm, courses: [parentCourse] },
    })
  }

  for (const portalId of [elm, leeds].filter((id): id is number => Boolean(id))) {
    const already = await payload.find({
      collection: 'adoptions',
      overrideAccess: true,
      limit: 1,
      where: { and: [{ portal: { equals: portalId } }, { pack: { equals: pack.id } }] },
    })
    if (!already.docs.length) {
      await payload.create({ collection: 'adoptions', overrideAccess: true, data: { kind: 'pack', portal: portalId, pack: pack.id } })
    }
  }

  // Codes are random on every fresh seed, so nobody can guess them from the source. They are found again by label.
  // Starter loads skip this whole block: it creates the demo portals' codes and the accounts whose passwords are in the README.
  const codeValues: Record<string, string> = {}
  if (!startersOnly && elm && leeds && parentPack) {
  const codeSpecs = [
    { label: 'elm-teacher', prefix: 'ELM', role: 'teacher', portal: elm, packs: [pack.id] },
    { label: 'elm-admin', prefix: 'ELM', role: 'admin', portal: elm, packs: [pack.id], maxUses: 1, uses: 1 },
    { label: 'elm-learner', prefix: 'ELM', role: 'learner', portal: elm, packs: [pack.id], link: 'elm-teacher' },
    { label: 'elm-parent', prefix: 'ELM', role: 'parent', portal: elm, packs: [parentPack.id], link: 'elm-teacher' },
    { label: 'leeds-teacher', prefix: 'LEEDS', role: 'teacher', portal: leeds, packs: [pack.id] },
    { label: 'leeds-learner', prefix: 'LEEDS', role: 'learner', portal: leeds, packs: [pack.id], link: 'leeds-teacher' },
  ]
  const codeIds = new Map<string, number>()
  for (const spec of codeSpecs) {
    const found = await payload.find({ collection: 'access-codes', overrideAccess: true, limit: 1, where: { and: [{ label: { equals: spec.label } }, { portal: { equals: spec.portal } }] } })
    if (found.docs[0]) {
      codeIds.set(spec.label, found.docs[0].id)
      codeValues[spec.label] = found.docs[0].code
      continue
    }
    const linked = spec.link ? codeIds.get(spec.link) : undefined
    const created = await payload.create({
      collection: 'access-codes',
      overrideAccess: true,
      data: {
        code: randomCode(spec.prefix),
        label: spec.label,
        role: spec.role as 'learner',
        portal: spec.portal,
        packs: spec.packs,
        linkedTeacherCode: linked,
        parentMentorCode: spec.role === 'parent' ? linked : undefined,
        maxUses: spec.maxUses ?? null,
        uses: spec.uses ?? 0,
      },
    })
    codeIds.set(spec.label, created.id)
    codeValues[spec.label] = created.code
  }
  writeFileSync(path.join(root, codesFile()), `${JSON.stringify(codeValues, null, 2)}\n`)

  const learnerList = courseIds
  await ensureUser(payload, {
    email: 'elm-admin@hearts.test',
    password: 'portal-admin',
    name: 'Amina Yusuf',
    role: 'portal-admin',
    accessCode: codeIds.get('elm-admin'),
    tenants: [{ tenant: elm }],
    onboarded: true,
    seenWelcome: true,
    courseList: learnerList,
  })
  await ensureUser(payload, {
    email: 'elm-teacher@hearts.test',
    password: 'portal-teacher',
    name: 'Idris Rahman',
    role: 'teacher',
    accessCode: codeIds.get('elm-teacher'),
    tenants: [{ tenant: elm }],
    onboarded: true,
    seenWelcome: true,
    courseList: learnerList,
  })
  await ensureUser(payload, {
    email: 'elm-learner@hearts.test',
    password: 'portal-learner',
    name: 'Maryam Begum',
    role: 'learner',
    audience: 'learner' as const,
    accessCode: codeIds.get('elm-learner'),
    tenants: [{ tenant: elm }],
    onboarded: true,
    seenWelcome: true,
    startingClause: 22,
    joinedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    courseList: learnerList,
  })
  await ensureUser(payload, {
    email: 'qa-desk@hearts.foundation',
    password: 'portal-learner',
    name: 'QA Desk Learner',
    role: 'learner',
    audience: 'learner' as const,
    tenants: [{ tenant: elm }],
    onboarded: true,
    seenWelcome: true,
    courseList: learnerList,
  })
  await ensureUser(payload, {
    email: 'leeds-learner@hearts.test',
    password: 'portal-learner',
    name: 'Yusuf Khan',
    role: 'learner',
    accessCode: codeIds.get('leeds-learner'),
    tenants: [{ tenant: leeds }],
    onboarded: true,
    seenWelcome: true,
    courseList: learnerList,
  })

  }

  if (!startersOnly && elm) {
  const nights = await payload.find({ collection: 'events', overrideAccess: true, limit: 1, where: { title: { equals: 'Thursday circle' } } })
  if (!nights.docs.length) {
    await payload.create({
      collection: 'events',
      overrideAccess: true,
      data: { title: 'Thursday circle', place: 'East London Mosque, side room', note: 'Tea is served from half past seven. Come as you are, and bring a friend if you like.', startsAt: nextThursday().toISOString(), portal: elm },
    })
  }

  const local = await payload.find({ collection: 'courses', overrideAccess: true, limit: 1, where: { title: { equals: 'East London circle notes' } } })
  if (!local.docs.length) {
    const course = await payload.create({
      collection: 'courses',
      overrideAccess: true,
      data: { title: 'East London circle notes', speaker: 'Amina Yusuf', origin: 'local', portal: elm, importable: false, visibility: 'published', summary: 'Notes from our own Thursday circle, made here in East London.' },
    })
    const unit = await payload.create({ collection: 'units', overrideAccess: true, data: { title: 'Notes', course: course.id, order: 1 } })
    await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: { title: 'How we sit', unit: unit.id, course: course.id, portal: elm, order: 1, durationSeconds: 8, transcriptSource: 'none' },
    })
  }

  }

  const opening = await seedOpening(payload, { clauseIds, portalIds, now: new Date(), showUnchecked: !startersOnly })
  await seedSpeakers(payload)
  if (!startersOnly) await seedPeople(payload, { portalIds, sceneIds: opening.sceneIds, now: new Date(), courseList: [...courseIds, ...opening.starterCourseIds] })
  await seedHarvest(payload, { now: new Date(), demo: !startersOnly })
  const { seedLegal } = await import('./legal')
  await seedLegal(payload)
  if (!startersOnly) {
    const { seedDemoHarvest } = await import('./harvest-seed')
    await seedDemoHarvest(payload)
    const { seedFeedbackDemo } = await import('./feedback-seed')
    await seedFeedbackDemo(payload, { startersOnly })
  }

  const problems = await timingCheck(payload)
  if (problems.length) {
    console.error(`Timing check failed:\n${problems.join('\n')}`)
    process.exit(1)
  }
  if (startersOnly) {
    console.log('Loaded the starter talks and the library. No demo accounts were created.')
  } else {
    console.log('Seeded HEARTS. Master: master@hearts.test / hearts-master')
    console.log(`Access codes (also on the master desk, and in ${codesFile()}):`)
    for (const [label, value] of Object.entries(codeValues)) console.log(`  ${label.padEnd(14)} ${value}`)
  }
  process.exit(0)
}

function nextThursday() {
  const date = new Date()
  date.setUTCHours(19, 30, 0, 0)
  const ahead = (4 - date.getUTCDay() + 7) % 7 || 7
  date.setUTCDate(date.getUTCDate() + ahead)
  return date
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
