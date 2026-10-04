import { NextResponse } from 'next/server'
import { getSession } from '@/server/context'
import { weekView } from '@/server/week-plan'
import { planIcs } from '@/lib/plan-ics'
import { portalIdOf } from '@/lib/ids'

export async function GET(req: Request) {
  const { payload, user } = await getSession()
  if (!user) return new NextResponse('Sign in to download your plan.', { status: 401 })
  const portalId = portalIdOf(user)
  if (!portalId) return new NextResponse('No portal.', { status: 404 })
  const portal = await payload.findByID({ collection: 'portals', id: portalId, overrideAccess: true, depth: 0 }).catch(() => null)
  if (!portal) return new NextResponse('No portal.', { status: 404 })
  const slug = String((portal as { slug?: string }).slug || '')
  const view = await weekView(payload, user, portal as never, `/p/${slug}`)
  const origin = new URL(req.url).origin
  const slots = view.plans.flatMap((plan) => plan.slots.map((slot) => ({ date: slot.date, title: slot.title, href: slot.href })))
  const body = planIcs({ name: view.plans[0]?.name || 'My week', slots, zone: view.zone, origin })
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="my-week.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
