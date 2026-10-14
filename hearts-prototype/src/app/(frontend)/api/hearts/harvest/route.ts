import { hit } from '@/lib/rate-limit'
import { portalIdOf } from '@/lib/ids'
import { json, portalOf, readBody, viewAsRefusal } from '@/server/api'
import { getSession } from '@/server/context'
import { captureMoment } from '@/server/harvest'

export const dynamic = 'force-dynamic'

/**
 * A short clip (hors d'oeuvre or appetiser) asks for the line at one timestamp to be kept.
 * The words come from the talk transcript on the server. This route does not mark a part watched,
 * and it does not write a completion, a lesson visit, or a watch session.
 */
export async function POST(req: Request) {
  const session = await getSession({ touch: false })
  if (!session.user) return json({ error: 'Sign in first.' }, 401)
  const refusal = await viewAsRefusal(session, 'harvest')
  if (refusal) return refusal
  const limit = hit(`harvest:${session.user.id}`, 40, 60_000)
  if (!limit.allowed) return json({ saved: false, reason: 'slow' }, 429)
  const body = await readBody(req)
  const lessonId = Number(body.lessonId)
  const seconds = Number(body.seconds)
  const surface = body.surface === 'appetiser' ? 'appetiser' : body.surface === 'hors' ? 'hors' : null
  if (!lessonId || !Number.isFinite(seconds) || seconds < 0 || seconds > 6 * 60 * 60 || !surface) {
    return json({ error: 'That moment could not be read.' }, 400)
  }
  const portal = await portalOf(session, req)
  const result = await captureMoment(session.payload, session.user, portal?.id || portalIdOf(session.user), { lessonId, seconds, surface })
  return json(result)
}
