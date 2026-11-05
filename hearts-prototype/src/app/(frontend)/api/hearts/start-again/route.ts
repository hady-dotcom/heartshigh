import { getSession } from '@/server/context'
import { json, viewAsRefusal } from '@/server/api'
import { startAgain } from '@/server/workbook'

export const dynamic = 'force-dynamic'

/** P8: clears the server side of the opening. The device clears hearts.heart.v1 itself. */
export async function POST() {
  const session = await getSession()
  if (!session.actor) return json({ error: 'Sign in first.' }, 401)
  const refused = await viewAsRefusal(session, 'start-again', true)
  if (refused) return refused
  await startAgain(session.payload, session.actor.id)
  return json({ ok: true })
}
