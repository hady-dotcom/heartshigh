import { NextResponse } from 'next/server'
import { getSession } from '@/server/context'
import { canEditCalendar, saveCopy, saveSeason, setCopyApproval, setHijriOffset, setPopularFlag, suggestSeasonal } from '@/server/calendar'

export const dynamic = 'force-dynamic'

function redirectTo(req: Request, path: string, error?: string, notice?: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const safe = path.startsWith('/') && !path.startsWith('//') ? path : '/master/calendar'
  const url = new URL(safe, host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error.slice(0, 400))
  if (notice) url.searchParams.set('notice', notice.slice(0, 400))
  return NextResponse.redirect(url, 303)
}

function text(form: FormData, name: string) {
  return String(form.get(name) || '')
}

export async function POST(req: Request) {
  const { payload, user } = await getSession()
  const wantsJson = (req.headers.get('accept') || '').includes('application/json')
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'That request was incomplete.' }, { status: 400 })
  }
  const next = text(form, 'next') || '/master/calendar'
  const action = text(form, 'action')
  const fail = (message: string, status = 400) => (wantsJson ? NextResponse.json({ error: message }, { status }) : redirectTo(req, next, message))
  const ok = (notice: string) => (wantsJson ? NextResponse.json({ ok: true, notice }) : redirectTo(req, next, undefined, notice))
  if (!user) return fail('Sign in first.', 401)
  if (!canEditCalendar(user)) return fail('Only the master can change the calendar desk.', 403)
  try {
    if (action === 'offset') {
      await setHijriOffset(payload, user, Number(text(form, 'offset') || 0))
      return ok('Moon-sighting offset saved.')
    }
    if (action === 'popular') {
      await setPopularFlag(payload, user, text(form, 'value') === 'on')
      return ok(text(form, 'value') === 'on' ? 'Popular talks can nudge the order.' : 'Popular talks are off.')
    }
    if (action === 'season') {
      await saveSeason(payload, user, {
        id: Number(text(form, 'id')) || undefined,
        key: text(form, 'key'),
        name: text(form, 'name'),
        theme: text(form, 'theme'),
        start: text(form, 'start'),
        end: text(form, 'end'),
      })
      return ok('Season saved.')
    }
    if (action === 'copy') {
      await saveCopy(payload, user, { slot: text(form, 'slot'), context: text(form, 'context'), label: text(form, 'label'), source: 'staff' })
      return ok('Draft saved. Approve it before learners see it.')
    }
    if (action === 'approve' || action === 'hold') {
      await setCopyApproval(payload, user, Number(text(form, 'id')), action === 'approve')
      return ok(action === 'approve' ? 'Approved. It can show on that day.' : 'Held back.')
    }
    if (action === 'suggest') {
      await suggestSeasonal(payload, user, text(form, 'slot'), text(form, 'context'))
      return ok('A draft was added. Approve it before it can run.')
    }
    return fail('That action is not one the calendar desk knows.')
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'That did not work.')
  }
}
