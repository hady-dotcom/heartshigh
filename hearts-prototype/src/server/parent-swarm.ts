import type { Payload } from 'payload'
import { loadRealAnswers } from '@/lib/parent-feedback'
import { initialsOf } from '@/lib/swarm-sort'
import { isHandwrittenAnswer } from '@/lib/demo-workbook'
import { isRealAnswerBody, SWARM_PARENTS } from '@/lib/swarm-plan'

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
 * Takes down answers that were built from question words.
 * A line is kept only when it is a real 2021 parent answer, word for word.
 */
export async function removeGeneratedSwarm(payload: Payload, portalId: number) {
  const emails = SWARM_PARENTS.map((parent) => parent.email)
  const users = await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { email: { in: emails } },
  })
  const userIds = users.docs.map((row) => row.id)
  if (!userIds.length) return { removed: 0, kept: 0, portalId }
  const realTexts = loadRealAnswers().map((row) => row.text)
  const drop: number[] = []
  let kept = 0
  let page = 1
  for (;;) {
    const found = await payload.find({
      collection: 'answers',
      overrideAccess: true,
      depth: 0,
      limit: 100,
      page,
      where: { and: [{ user: { in: userIds } }, { portal: { equals: portalId } }] },
    })
    for (const row of found.docs) {
      const body = String(row.body || row.choice || '')
      if (isRealAnswerBody(body, realTexts) || isHandwrittenAnswer(body)) kept += 1
      else drop.push(row.id)
    }
    if (!found.hasNextPage) break
    page += 1
    if (page > 80) break
  }
  for (const id of drop) {
    await payload.delete({ collection: 'answers', id, overrideAccess: true })
  }
  return { removed: drop.length, kept, portalId }
}
