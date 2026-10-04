import { NextResponse } from 'next/server'
import config from '@payload-config'
import { REST_GET } from '@payloadcms/next/routes'
import { getSession } from '@/server/context'
import { json, readBody, viewAsRefusal } from '@/server/api'
import { saveAnswer, type AnswerInput } from '@/server/handle'

export const dynamic = 'force-dynamic'

const restGet = REST_GET(config)

/** Reading stays Payload's REST list, so the collection's own access rules (P9) apply. */
export function GET(req: Request) {
  return restGet(req, { params: Promise.resolve({ slug: ['answers'] }) })
}

function inputOf(row: Record<string, unknown>, pending: boolean): AnswerInput {
  const number = (value: unknown) => (value === undefined || value === null || value === '' ? undefined : Number(value))
  const answeredAt = row.answeredAt ? new Date(String(row.answeredAt)) : null
  return {
    pointId: Number(row.pointId ?? row.point),
    body: typeof row.body === 'string' ? row.body : undefined,
    choice: typeof row.choice === 'string' ? row.choice : undefined,
    image: row.image instanceof File ? row.image : null,
    audio: row.audio instanceof File ? row.audio : null,
    video: row.video instanceof File ? row.video : null,
    keepPrivate: row.keepPrivate === true || row.keepPrivate === 'on',
    shareWithTeacher: row.shareWithTeacher === true || row.shareWithTeacher === 'on',
    shareWithLearners: row.shareWithLearners === true || row.shareWithLearners === 'on',
    answeredAt: answeredAt && !Number.isNaN(answeredAt.getTime()) ? answeredAt.toISOString() : undefined,
    atSecond: number(row.atSecond),
    viewingId: typeof row.viewingId === 'string' ? row.viewingId.slice(0, 64) : undefined,
    cutId: number(row.cutId) || null,
    level: row.level === 'hors' || row.level === 'appetiser' ? row.level : undefined,
    pendingSync: pending,
  }
}

/**
 * Pop-up answers (spec 7A.11). One answer, or `{ pending: [...] }` to sync answers held on the device before
 * sign-up with their original times. `{ later: true, lessonId }` keeps the question open without a row.
 */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session.actor || !session.user) return json({ error: 'Sign in first.' }, 401)
  const refused = await viewAsRefusal(session, 'answers', true)
  if (refused) return refused
  const { payload, user } = session
  const body = await readBody(req)

  if (body.later) {
    const lessonId = Number(body.lessonId)
    if (!lessonId) return json({ error: 'Name the lesson.' }, 400)
    const seen = await payload.find({ collection: 'lesson-visits', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ user: { equals: user.id } }, { lesson: { equals: lessonId } }] } })
    if (!seen.docs.length) await payload.create({ collection: 'lesson-visits', overrideAccess: true, data: { user: user.id, lesson: lessonId } })
    return json({ ok: true, open: true })
  }

  if (Array.isArray(body.pending)) {
    const results = []
    for (const row of body.pending.slice(0, 50)) {
      if (row && typeof row === 'object') results.push(await saveAnswer(payload, user, inputOf(row as Record<string, unknown>, true)))
    }
    return json({ ok: true, saved: results.filter((row) => row.ok).length, results })
  }

  const result = await saveAnswer(payload, user, inputOf(body, false))
  const accept = req.headers.get('accept') || ''
  const page = accept.includes('text/html') && !accept.includes('application/json')
  const next = typeof body.next === 'string' && body.next.startsWith('/') && !body.next.startsWith('//') ? body.next : ''
  if (page && next) {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
    const proto = req.headers.get('x-forwarded-proto') || 'http'
    const url = new URL(next, host ? `${proto}://${host}` : req.url)
    url.searchParams.set(result.ok ? 'notice' : 'error', result.ok ? 'Saved in your workbook.' : result.error)
    return NextResponse.redirect(url, 303)
  }
  if (!result.ok) return json({ error: result.error }, result.status)
  return json(result, result.updated ? 200 : 201)
}
