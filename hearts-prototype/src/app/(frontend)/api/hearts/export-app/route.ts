import { NextResponse } from 'next/server'
import { portalIdOf } from '@/lib/ids'
import { PARENTING_DEMO_CODE } from '@/lib/parenting-demo'
import { isSequencePortal } from '@/lib/sequence'
import { getSession, loadPortal } from '@/server/context'
import { exportSequenceApp } from '@/server/sequence-desk'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const slug = url.searchParams.get('portal') || ''
  const asked = (url.searchParams.get('code') || '').trim()
  const joinCode = asked || (slug === 'parenting' ? PARENTING_DEMO_CODE : '')
  const { payload, user } = await getSession()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const portal = await loadPortal(payload, slug)
  if (!portal) return NextResponse.json({ error: 'Missing portal.' }, { status: 404 })
  if (!isSequencePortal(portal)) return NextResponse.json({ error: 'This portal does not use a sequenced course.' }, { status: 400 })
  const allowed = user.role === 'master' || (user.role === 'portal-admin' && portalIdOf(user) === portal.id)
  if (!allowed) return NextResponse.json({ error: 'Only a portal admin can export this app.' }, { status: 403 })
  const result = await exportSequenceApp(payload, portal, { joinCode })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return new NextResponse(new Uint8Array(result.zip), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${result.filename}"`,
      'cache-control': 'no-store',
    },
  })
}
