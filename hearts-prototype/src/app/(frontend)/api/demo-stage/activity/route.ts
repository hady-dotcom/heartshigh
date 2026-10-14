import { NextResponse } from 'next/server'
import { getSession } from '@/server/context'
import { listDemoActivity } from '@/server/demo-activity'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { user, payload } = await getSession({ touch: false })
  if (!user || user.role !== 'master') {
    return NextResponse.json({ error: 'The demo stage is for the master desk.' }, { status: 403 })
  }
  const since = Number(new URL(req.url).searchParams.get('since') || 0)
  const cursorIn = Number.isFinite(since) ? since : 0
  const events = await listDemoActivity(payload, cursorIn)
  const cursor = events.length ? events[events.length - 1].id : cursorIn
  return NextResponse.json({ events, cursor })
}
