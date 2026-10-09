import { getSession } from '@/server/context'
import { json, readBody, viewAsRefusal } from '@/server/api'
import { READ_ONLY } from '@/server/viewas'

export const dynamic = 'force-dynamic'

async function mine(session: Awaited<ReturnType<typeof getSession>>) {
  const found = await session.payload.find({ collection: 'heart-states', overrideAccess: true, depth: 0, limit: 1, where: { user: { equals: session.actor!.id } } })
  return found.docs[0] as { id: number; state?: unknown } | undefined
}

/** P3: the owner's own copy. Never readable while viewing as someone, and never by staff. */
export async function GET() {
  const session = await getSession({ touch: false })
  if (!session.actor) return json({ error: 'Sign in first.' }, 401)
  if (session.viewAs) return json({ error: READ_ONLY }, 403)
  const row = await mine(session)
  return json({ state: row?.state || null })
}

export async function PUT(req: Request) {
  const session = await getSession()
  if (!session.actor) return json({ error: 'Sign in first.' }, 401)
  const refused = await viewAsRefusal(session, 'heart-state', true)
  if (refused) return refused
  if (!session.actor.keepPlace) return json({ error: 'Turn on Keep my place across devices first.' }, 409)
  const body = await readBody(req)
  const state = body.state
  if (!state || typeof state !== 'object' || JSON.stringify(state).length > 60_000) return json({ error: 'That state could not be read.' }, 400)
  const row = await mine(session)
  if (row) await session.payload.update({ collection: 'heart-states', id: row.id, overrideAccess: true, data: { state } as never })
  else await session.payload.create({ collection: 'heart-states', overrideAccess: true, data: { user: session.actor.id, state } as never })
  return json({ ok: true })
}

export async function DELETE() {
  const session = await getSession()
  if (!session.actor) return json({ error: 'Sign in first.' }, 401)
  const refused = await viewAsRefusal(session, 'heart-state', true)
  if (refused) return refused
  await session.payload.delete({ collection: 'heart-states', overrideAccess: true, where: { user: { equals: session.actor.id } } })
  return json({ ok: true })
}
