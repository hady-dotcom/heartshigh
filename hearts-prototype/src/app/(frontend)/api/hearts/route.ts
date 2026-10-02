import { NextResponse } from 'next/server'
import { now } from '@/lib/clock'
import { portalIdOf } from '@/lib/ids'
import { getSession, loadPortal } from '@/server/context'
import { handlePost } from '@/server/handle'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handlePost(req)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const probe = url.searchParams.get('probe')
  const { payload, user } = await getSession()
  if (url.searchParams.get('clock') === '1') {
    return NextResponse.json({ now: now().toISOString() })
  }
  if (!probe) return NextResponse.json({ ok: true, user: user?.email || null })
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const portal = await loadPortal(payload, probe)
  if (!portal) return NextResponse.json({ error: 'Missing portal.' }, { status: 404 })
  if (user.role !== 'master' && portalIdOf(user) !== portal.id) {
    return NextResponse.json({ error: 'That portal is not yours.' }, { status: 403 })
  }
  const messages = await payload.find({
    collection: 'messages',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { portal: { equals: portal.id } },
  })
  return NextResponse.json({
    portal: portal.slug,
    messages: messages.docs.map((doc) => (doc as { body?: string }).body),
  })
}
