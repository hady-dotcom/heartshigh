import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Payload } from 'payload'
import { loadRealAnswers } from '@/lib/parent-feedback'
import { initialsOf } from '@/lib/swarm-sort'
import { isBlankPrompt, planQuestionSwarm, SWARM_PARENTS } from '@/lib/swarm-plan'

const STORE = '/cursor/stores/self/swarm-parents.json'

type SavedParent = { name: string; email: string; password: string }

function passwordFor(parent: { name: string; email: string }) {
  const password = randomBytes(18).toString('base64url')
  try {
    const dir = '/cursor/stores/self'
    const current: { parents: SavedParent[] } = existsSync(STORE) ? JSON.parse(readFileSync(STORE, 'utf8')) : { parents: [] }
    const found = current.parents.find((row) => row.email === parent.email)
    if (found?.password) return found.password
    current.parents.push({ name: parent.name, email: parent.email, password })
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(STORE, `${JSON.stringify(current, null, 2)}\n`)
  } catch {
    // Production has no agent store. The account is still created.
  }
  return password
}

async function parentUsers(payload: Payload, portalId: number) {
  const users: { id: number; email: string }[] = []
  for (const parent of SWARM_PARENTS) {
    const found = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 1, where: { email: { equals: parent.email } } })
    if (found.docs[0]) {
      users.push({ id: found.docs[0].id, email: parent.email })
      continue
    }
    const created = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: parent.email,
        password: passwordFor(parent),
        name: parent.name,
        role: 'learner',
        onboarded: true,
        seenWelcome: true,
        shareWithLearners: true,
        tenants: [{ tenant: portalId }],
      },
    })
    users.push({ id: created.id, email: parent.email })
  }
  return users
}

/** Shared answers for a signed-out visitor. One film is a handful of questions. */
export async function loadFilmSwarm(payload: Payload, portalId: number, pointIds: number[]) {
  const swarm: Record<number, { name: string; body: string; initials: string; id: number; kind: 'answer' }[]> = {}
  if (!pointIds.length) return swarm
  const found = await payload.find({
    collection: 'answers',
    overrideAccess: true,
    depth: 1,
    limit: 80,
    sort: '-createdAt',
    where: {
      and: [
        { point: { in: pointIds } },
        { portal: { equals: portalId } },
        { shareWithLearners: { equals: true } },
        { keepPrivate: { not_equals: true } },
        { swarmHidden: { not_equals: true } },
      ],
    },
  })
  for (const answer of found.docs) {
    const point = typeof answer.point === 'object' && answer.point ? answer.point.id : Number(answer.point)
    const author = answer.user && typeof answer.user === 'object' ? answer.user : null
    const name = author && 'name' in author ? String(author.name || '') : ''
    const body = String(answer.body || answer.choice || '').trim()
    if (!point || !body) continue
    ;(swarm[point] ||= []).push({ name: name || 'A parent', body, initials: initialsOf(name), id: answer.id, kind: 'answer' })
  }
  return swarm
}

/**
 * Puts 4 to 8 shared answers on every Hady Home question.
 * Real 2021 lines are reused under these parents' names. The rest are written for the question.
 */
export async function seedParentSwarm(payload: Payload, portalId: number) {
  const users = await parentUsers(payload, portalId)
  const byEmail = new Map(users.map((user) => [user.email, user.id]))
  const courses = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    depth: 0,
    limit: 40,
    where: { and: [{ portal: { equals: portalId } }, { hidden: { not_equals: true } }] },
  })
  const courseIds = courses.docs.map((row) => row.id)
  if (!courseIds.length) return { created: 0 }
  const lessonIds: number[] = []
  let lessonPage = 1
  for (;;) {
    const lessons = await payload.find({
      collection: 'lessons',
      overrideAccess: true,
      depth: 0,
      limit: 100,
      page: lessonPage,
      where: { and: [{ course: { in: courseIds } }, { binned: { not_equals: true } }] },
    })
    lessonIds.push(...lessons.docs.map((row) => row.id))
    if (!lessons.hasNextPage) break
    lessonPage += 1
  }
  if (!lessonIds.length) return { created: 0 }
  const points: { id: number; lesson: number; prompt: string }[] = []
  for (let index = 0; index < lessonIds.length; index += 40) {
    const slice = lessonIds.slice(index, index + 40)
    let page = 1
    for (;;) {
      const found = await payload.find({
        collection: 'engagement-points',
        overrideAccess: true,
        depth: 0,
        limit: 100,
        page,
        where: { lesson: { in: slice } },
      })
      for (const row of found.docs) {
        const prompt = String(row.prompt || '')
        const lesson = typeof row.lesson === 'object' && row.lesson ? row.lesson.id : Number(row.lesson)
        if (!lesson || isBlankPrompt(prompt)) continue
        points.push({ id: row.id, lesson, prompt })
      }
      if (!found.hasNextPage) break
      page += 1
    }
  }
  const have = new Set<string>()
  const userIds = users.map((user) => user.id)
  let page = 1
  for (;;) {
    const found = await payload.find({
      collection: 'answers',
      overrideAccess: true,
      depth: 0,
      limit: 200,
      page,
      where: { user: { in: userIds } },
    })
    for (const row of found.docs) {
      const point = typeof row.point === 'object' && row.point ? row.point.id : Number(row.point)
      const user = typeof row.user === 'object' && row.user ? row.user.id : Number(row.user)
      if (point && user) have.add(`${user}:${point}`)
    }
    if (!found.hasNextPage) break
    page += 1
    if (page > 40) break
  }
  const real = loadRealAnswers().map((row) => ({ question: row.question, text: row.text }))
  let created = 0
  for (const point of points) {
    const planned = planQuestionSwarm({ prompt: point.prompt, real })
    for (const answer of planned) {
      const userId = byEmail.get(answer.email)
      if (!userId || have.has(`${userId}:${point.id}`)) continue
      await payload.create({
        collection: 'answers',
        overrideAccess: true,
        data: {
          point: point.id,
          user: userId,
          lesson: point.lesson,
          body: answer.body,
          keepPrivate: false,
          shareWithTeacher: false,
          shareWithLearners: true,
          swarmHidden: false,
          portal: portalId,
          answeredAt: new Date().toISOString(),
        },
      })
      have.add(`${userId}:${point.id}`)
      created += 1
    }
  }
  return { created, questions: points.length }
}
