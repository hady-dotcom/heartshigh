import { getSession } from '@/server/context'
import { json } from '@/server/api'
import { workbookFor } from '@/server/workbook'

export const dynamic = 'force-dynamic'

/**
 * The signed-in learner's own workbook. During view-as the screens are the target's, but rows are read as the
 * actor, so private opening rows and unshared answers never come back.
 */
export async function GET() {
  const session = await getSession()
  if (!session.user || !session.actor) return json({ error: 'Sign in first.' }, 401)
  const book = await workbookFor(session.payload, session.user, session.actor)
  return json(book)
}
