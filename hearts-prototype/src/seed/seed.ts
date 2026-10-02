import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import config from '../payload.config'
import { dualExtract } from '../lib/extractor'

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
  [36, 'He left', 'Trunk', 'The guest goes. The teaching stays.'],
  [37, 'I stayed a while', 'Trunk', 'Do not rush the meaning.'],
  [38, 'Then he said', 'Trunk', 'Umar reports. We receive.'],
  [39, 'O Umar', 'Trunk', 'The question returns to the one who stayed.'],
  [40, 'Do you know who the questioner was', 'Trunk', 'It was Jibril.'],
  [41, 'He came to teach you your religion', 'Trunk', 'The whole sitting was the lesson.'],
]

const PLACING = [
  {
    prompt: 'When you picture the people you answer to, who is closest?',
    why: 'So the path can start with company, not with a rank.',
    options: ['My Lord', 'The Prophet', 'The people I treat', 'I am still in flux'],
  },
  {
    prompt: 'What are you most wanting from a sitting like this?',
    why: 'A tender start is different from a syllabus.',
    options: ['Prayer that holds', 'How to treat people', 'The names of Allah', 'A gentle pace'],
  },
  {
    prompt: 'How does a hard week usually meet you?',
    why: 'The heart needs a door, not a diagnosis.',
    options: ['I go quiet', 'I get sharp with people', 'I look for a verse', 'I keep moving'],
  },
  {
    prompt: 'Where would you like the first real talk to stand?',
    why: 'We begin near the thing you already care about.',
    options: ['With the Prophet', 'With prayer', 'With Allah as Lord', 'With how I treat people'],
  },
]

async function ensureUser(payload: Awaited<ReturnType<typeof getPayload>>, data: Record<string, unknown> & { email: string }) {
  const found = await payload.find({ collection: 'users', overrideAccess: true, limit: 1, where: { email: { equals: data.email } } })
  if (found.docs[0]) return found.docs[0]
  return payload.create({ collection: 'users', overrideAccess: true, data })
}

async function main() {
  const payload = await getPayload({ config })
  const clauseIds = new Map<number, number>()
  for (const [number, fragment, core, teaching] of CLAUSES) {
    const found = await payload.find({ collection: 'clauses', overrideAccess: true, limit: 1, where: { number: { equals: number } } })
    const doc = found.docs[0]
      ? found.docs[0]
      : await payload.create({ collection: 'clauses', overrideAccess: true, data: { number, fragment, core, teaching, series: '' } })
    clauseIds.set(number, doc.id)
    const seats = await payload.find({ collection: 'seats', overrideAccess: true, limit: 1, where: { clause: { equals: doc.id } } })
    if (!seats.docs.length) {
      for (const position of [1, 2, 3]) {
        await payload.create({
          collection: 'seats',
          overrideAccess: true,
          data: { clause: doc.id, position, text: `${fragment} — Ghunya seat ${position}. A place to return, not a second syllabus.` },
        })
      }
    }
  }

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
      await payload.create({ collection: 'placing-questions', overrideAccess: true, data: { ...question, order: index + 1 } })
    }
  }

  await ensureUser(payload, {
    email: 'master@hearts.test',
    password: 'hearts-master',
    name: 'Master desk',
    role: 'master',
    onboarded: true,
    seenWelcome: true,
  })

  const portals = [
    {
      name: 'East London Mosque',
      slug: 'east-london',
      kind: 'mosque',
      welcome: 'A quiet room for whoever is sent to East London.',
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
      welcome: 'Leeds keeps its own door.',
      organisationName: 'Leeds Chapter',
      wizardDone: true,
      colour: '#6b3a2f',
    },
  ]
  const portalIds = new Map<string, number>()
  for (const portal of portals) {
    const found = await payload.find({ collection: 'portals', overrideAccess: true, limit: 1, where: { slug: { equals: portal.slug } } })
    const doc = found.docs[0] || (await payload.create({ collection: 'portals', overrideAccess: true, data: portal }))
    portalIds.set(portal.slug, doc.id)
  }

  const films = [
    {
      title: 'How to Live Like the Prophet — Session 6',
      speaker: 'Yasir Fahmy',
      file: 'fahmy-session6.md',
      youtubeUrl: '',
      youtubeId: '',
      importToken: 'FAHMY-S6',
    },
    {
      title: 'The Names Class 19: Ar-Rabb',
      speaker: 'Shaykh Mikaeel Smith',
      file: 'mikaeel-ar-rabb.md',
      youtubeUrl: 'https://www.youtube.com/watch?v=ECaTWkof57E',
      youtubeId: 'ECaTWkof57E',
      importToken: 'AR-RABB',
    },
    {
      title: 'The Names Class 20: Al-Nur',
      speaker: 'Shaykh Mikaeel Smith',
      file: 'mikaeel-al-nur.md',
      youtubeUrl: 'https://www.youtube.com/watch?v=MK5q_zMiX1g',
      youtubeId: 'MK5q_zMiX1g',
      importToken: 'AL-NUR',
    },
  ]

  const courseIds: number[] = []
  for (const film of films) {
    const found = await payload.find({ collection: 'courses', overrideAccess: true, limit: 1, where: { importToken: { equals: film.importToken } } })
    if (found.docs[0]) {
      courseIds.push(found.docs[0].id)
      continue
    }
    const transcript = readFileSync(path.join(root, 'content/transcripts', film.file), 'utf8')
    const course = await payload.create({
      collection: 'courses',
      overrideAccess: true,
      data: {
        title: film.title,
        speaker: film.speaker,
        summary: `A real lecture. Transcript seeded from content/transcripts/${film.file}.`,
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
        durationSeconds: 600,
        transcript,
        transcriptSource: 'upload',
        transcriptNote: 'Seeded from the transcript file. YouTube captions are often blocked from cloud machines, so the upload path is what the extractor uses.',
      },
    })
    if (film.importToken === 'FAHMY-S6') {
      const cards = CLAUSES.map(([number, fragment, core, teaching]) => ({ number, fragment, core, teaching }))
      const extracted = dualExtract(transcript, cards)
      const first = extracted.cuts[0]
      if (first) {
        const cut = await payload.create({
          collection: 'cuts',
          overrideAccess: true,
          data: {
            lesson: lesson.id,
            course: course.id,
            status: 'approved',
            start: Math.round(first.start),
            end: Math.round(first.end),
            timestamp: first.timestamp,
            hook: first.hook,
            turn: first.turn,
            land: first.land,
            fullContext: first.fullContext,
            theme: first.theme,
            device: first.device,
            whyItAllures: first.whyItAllures,
            bestClause: first.bestClause,
            clauseFragment: first.clauseFragment,
            hangStrength: first.hangStrength,
            whyHang: first.whyHang,
            seatHint: first.seatHint,
            stage2Form: first.stage2Form,
            currencyNote: first.currencyNote,
            quoteConfidence: first.quoteConfidence,
            exemplarAffinity: first.exemplarAffinity,
            kind: first.kind,
            engine: extracted.engine,
          },
        })
        if (first.bestClause && clauseIds.get(first.bestClause)) {
          await payload.create({
            collection: 'tags',
            overrideAccess: true,
            data: { item: { relationTo: 'cuts', value: cut.id }, clause: clauseIds.get(first.bestClause), state: 'confirmed', note: first.whyHang },
          })
        }
      }
      await payload.create({
        collection: 'engagement-points',
        overrideAccess: true,
        data: {
          lesson: lesson.id,
          second: 20,
          kind: 'reflection',
          prompt: 'What would it mean, this week, to emulate one small manner of the Prophet?',
          timing: 'immediate',
          audience: 'everyone',
        },
      })
    }
    courseIds.push(course.id)
  }

  const elm = portalIds.get('east-london')!
  const leeds = portalIds.get('leeds')!
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
  if (!parentPack) {
    parentPack = await payload.create({
      collection: 'packs',
      overrideAccess: true,
      data: { title: 'One Names class', summary: 'A single course for a parent code.', owner: 'portal', portal: elm, courses: [parentCourse] },
    })
  }

  for (const portalId of [elm, leeds]) {
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

  const codeSpecs = [
    { code: 'ELM-TEACH', role: 'teacher', portal: elm, packs: [pack.id] },
    { code: 'ELM-ADMIN', role: 'admin', portal: elm, packs: [pack.id] },
    { code: 'ELM-LEARN', role: 'learner', portal: elm, packs: [pack.id], link: 'ELM-TEACH' },
    { code: 'ELM-PARENT', role: 'parent', portal: elm, packs: [parentPack.id], link: 'ELM-TEACH' },
    { code: 'LEEDS-TEACH', role: 'teacher', portal: leeds, packs: [pack.id] },
    { code: 'LEEDS-LEARN', role: 'learner', portal: leeds, packs: [pack.id], link: 'LEEDS-TEACH' },
  ]
  const codeIds = new Map<string, number>()
  for (const spec of codeSpecs) {
    const found = await payload.find({ collection: 'access-codes', overrideAccess: true, limit: 1, where: { code: { equals: spec.code } } })
    if (found.docs[0]) {
      codeIds.set(spec.code, found.docs[0].id)
      continue
    }
    const linked = spec.link ? codeIds.get(spec.link) : undefined
    const created = await payload.create({
      collection: 'access-codes',
      overrideAccess: true,
      data: {
        code: spec.code,
        role: spec.role,
        portal: spec.portal,
        packs: spec.packs,
        linkedTeacherCode: linked,
        parentMentorCode: spec.role === 'parent' ? linked : undefined,
      },
    })
    codeIds.set(spec.code, created.id)
  }

  const learnerList = courseIds
  await ensureUser(payload, {
    email: 'elm-admin@hearts.test',
    password: 'portal-admin',
    name: 'Amina Yusuf',
    role: 'portal-admin',
    accessCode: codeIds.get('ELM-ADMIN'),
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
    accessCode: codeIds.get('ELM-TEACH'),
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
    audience: 'learner',
    accessCode: codeIds.get('ELM-LEARN'),
    tenants: [{ tenant: elm }],
    onboarded: true,
    seenWelcome: true,
    startingClause: 25,
    courseList: learnerList,
  })
  await ensureUser(payload, {
    email: 'leeds-learner@hearts.test',
    password: 'portal-learner',
    name: 'Yusuf Khan',
    role: 'learner',
    accessCode: codeIds.get('LEEDS-LEARN'),
    tenants: [{ tenant: leeds }],
    onboarded: true,
    seenWelcome: true,
    courseList: learnerList,
  })

  const nights = await payload.find({ collection: 'events', overrideAccess: true, limit: 1, where: { title: { equals: 'Thursday circle' } } })
  if (!nights.docs.length) {
    await payload.create({
      collection: 'events',
      overrideAccess: true,
      data: { title: 'Thursday circle', place: 'East London Mosque, side room', note: 'Tea first. No ticket.', portal: elm },
    })
  }

  const local = await payload.find({ collection: 'courses', overrideAccess: true, limit: 1, where: { title: { equals: 'East London circle notes' } } })
  if (!local.docs.length) {
    const course = await payload.create({
      collection: 'courses',
      overrideAccess: true,
      data: { title: 'East London circle notes', speaker: 'Amina Yusuf', origin: 'local', portal: elm, importable: false, visibility: 'published', summary: 'A course this portal made.' },
    })
    const unit = await payload.create({ collection: 'units', overrideAccess: true, data: { title: 'Notes', course: course.id, order: 1 } })
    await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: { title: 'How we sit', unit: unit.id, course: course.id, portal: elm, order: 1, durationSeconds: 8, transcriptSource: 'none' },
    })
  }

  console.log('Seeded HEARTS. Master: master@hearts.test / hearts-master')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
