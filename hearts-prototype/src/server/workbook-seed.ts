import { randomBytes } from 'node:crypto'
import type { DataFromCollectionSlug, Payload, Where } from 'payload'
import { WORKBOOK_FILMS, workbookParentEmail, type WorkbookFilm } from '@/lib/demo-workbook'
import { questionsMatch } from '@/lib/swarm-plan'

async function collect<C extends 'courses' | 'lessons' | 'engagement-points'>(payload: Payload, collection: C, where: Where) {
  const docs: DataFromCollectionSlug<C>[] = []
  let page = 1
  for (;;) {
    const found = await payload.find({ collection, overrideAccess: true, depth: 0, limit: 100, page, where })
    docs.push(...found.docs)
    if (!found.hasNextPage) break
    page += 1
    if (page > 20) break
  }
  return docs
}

/**
 * Puts the handwritten parent lines on the first ten Guiding Home Learning films.
 * It does not invent any other answers.
 */
export async function seedWorkbookAnswers(payload: Payload, portalId: number, films: readonly WorkbookFilm[] = WORKBOOK_FILMS, sheetTitle: string | null = 'Guiding Home Learning') {
  const courses = await collect(payload, 'courses', {
    and: [
      { portal: { equals: portalId } },
      { hidden: { not_equals: true } },
      ...(sheetTitle ? [{ sheetTitle: { equals: sheetTitle } }] : []),
    ],
  })
  const courseIds = courses.map((row) => row.id)
  if (!courseIds.length) return { created: 0 }
  const lessons = await collect(payload, 'lessons', {
    and: [{ course: { in: courseIds } }, { vimeoId: { in: films.map((film) => film.vimeoId) } }, { binned: { not_equals: true } }],
  })
  const byVimeo = new Map(lessons.map((row) => [String(row.vimeoId || ''), row]))
  const lessonIds = lessons.map((row) => row.id)
  if (!lessonIds.length) return { created: 0 }
  const points = await collect(payload, 'engagement-points', { lesson: { in: lessonIds } })
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
  for (const film of films) {
    const lesson = byVimeo.get(film.vimeoId)
    if (!lesson) continue
    const point = points.find((row) => {
      const lessonId = typeof row.lesson === 'object' && row.lesson ? row.lesson.id : Number(row.lesson)
      return lessonId === lesson.id && questionsMatch(String(row.prompt || ''), film.prompt)
    }) || points.find((row) => {
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
