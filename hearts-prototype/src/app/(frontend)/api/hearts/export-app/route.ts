import { NextResponse } from 'next/server'
import { portalIdOf } from '@/lib/ids'
import { isSequencePortal } from '@/lib/sequence'
import { getSession, loadPortal } from '@/server/context'
import { exportSequenceApp } from '@/server/sequence-desk'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('portal') || ''
  const { payload, user } = await getSession()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const portal = await loadPortal(payload, slug)
  if (!portal) return NextResponse.json({ error: 'Missing portal.' }, { status: 404 })
  if (!isSequencePortal(portal)) return NextResponse.json({ error: 'This portal does not use a sequenced course.' }, { status: 400 })
  const allowed = user.role === 'master' || (user.role === 'portal-admin' && portalIdOf(user) === portal.id)
  if (!allowed) return NextResponse.json({ error: 'Only a portal admin can export this app.' }, { status: 403 })
  const result = await exportSequenceApp(payload, portal)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return new NextResponse(new Uint8Array(result.zip), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${result.filename}"`,
      'cache-control': 'no-store',
    },
  })
}
