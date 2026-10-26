import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'
import { WORKBOOK_FILMS, workbookParentEmail } from '@/lib/demo-workbook'
import { questionsMatch } from '@/lib/swarm-plan'

/**
 * Puts the handwritten parent lines on the first ten Guiding Home Learning films.
 * It does not invent any other answers.
 */
export async function seedWorkbookAnswers(payload: Payload, portalId: number) {
  const courses = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { and: [{ portal: { equals: portalId } }, { sheetTitle: { equals: 'Guiding Home Learning' } }, { hidden: { not_equals: true } }] },
  })
  const courseIds = courses.docs.map((row) => row.id)
  if (!courseIds.length) return { created: 0 }
  const lessons = await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 30,
    where: { and: [{ course: { in: courseIds } }, { vimeoId: { in: WORKBOOK_FILMS.map((film) => film.vimeoId) } }, { binned: { not_equals: true } }] },
  })
  const byVimeo = new Map(lessons.docs.map((row) => [String(row.vimeoId || ''), row]))
  const lessonIds = lessons.docs.map((row) => row.id)
  if (!lessonIds.length) return { created: 0 }
  const points = await payload.find({
    collection: 'engagement-points',
    overrideAccess: true,
    depth: 0,
    limit: 40,
    where: { lesson: { in: lessonIds } },
  })
  const users = new Map<string, number>()
  const ensure = async (name: string) => {
    const email = workbookParentEmail(name)
    const known = users.get(email)
    if (known) return known
    const found = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 1, where: { email: { equals: email } } })
    if (found.docs[0]) {
      users.set(email, found.docs[0].id)
      return found.docs[0].id
    }
    const created = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email,
        password: randomBytes(18).toString('base64url'),
        name,
        role: 'learner',
        onboarded: true,
        seenWelcome: true,
        shareWithLearners: true,
        tenants: [{ tenant: portalId }],
      },
    })
    users.set(email, created.id)
    return created.id
  }
  let created = 0
  for (const film of WORKBOOK_FILMS) {
    const lesson = byVimeo.get(film.vimeoId)
    if (!lesson) continue
    const point = points.docs.find((row) => {
      const lessonId = typeof row.lesson === 'object' && row.lesson ? row.lesson.id : Number(row.lesson)
      return lessonId === lesson.id && questionsMatch(String(row.prompt || ''), film.prompt)
    }) || points.docs.find((row) => {
      const lessonId = typeof row.lesson === 'object' && row.lesson ? row.lesson.id : Number(row.lesson)
      return lessonId === lesson.id
    })
    if (!point) continue
    for (const other of film.others) {
      const userId = await ensure(other.name)
      const existing = await payload.find({
        collection: 'answers',
        overrideAccess: true,
        depth: 0,
        limit: 1,
        where: { and: [{ user: { equals: userId } }, { point: { equals: point.id } }] },
      })
      if (existing.docs[0]) continue
      await payload.create({
        collection: 'answers',
        overrideAccess: true,
        data: {
          point: point.id,
          user: userId,
          lesson: lesson.id,
          body: other.body,
          keepPrivate: false,
          shareWithTeacher: false,
          shareWithLearners: true,
          swarmHidden: false,
          portal: portalId,
          answeredAt: new Date().toISOString(),
        },
      })
      created += 1
    }
  }
  return { created }
}
