import { NextResponse } from 'next/server'
import { portalIdOf } from '@/lib/ids'
import { getSession } from '@/server/context'
import {
  canEditMissions,
  closeMission,
  createMission,
  finishMission,
  joinMission,
  openMission,
  postSupport,
  shareResult,
  updateMission,
} from '@/server/missions'

export const dynamic = 'force-dynamic'

function redirectTo(req: Request, path: string, error?: string, notice?: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const safe = path.startsWith('/') && !path.startsWith('//') ? path : '/master/missions'
  const url = new URL(safe, host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error.slice(0, 400))
  if (notice) url.searchParams.set('notice', notice.slice(0, 400))
  return NextResponse.redirect(url, 303)
}

function text(form: FormData, name: string) {
  return String(form.get(name) || '')
}

function ids(form: FormData, name: string) {
  return form.getAll(name).map((value) => Number(value)).filter((id) => Number.isFinite(id) && id > 0)
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
  const next = text(form, 'next') || '/master/missions'
  const action = text(form, 'action')
  const fail = (message: string, status = 400) => (wantsJson ? NextResponse.json({ error: message }, { status }) : redirectTo(req, next, message))
  const ok = (notice: string, extra?: Record<string, unknown>) => (wantsJson ? NextResponse.json({ ok: true, notice, ...extra }) : redirectTo(req, next, undefined, notice))
  if (!user) return fail('Sign in first.', 401)
  try {
    if (action === 'create') {
      if (!canEditMissions(user)) return fail('Only the master can write a mission.', 403)
      const created = await createMission(payload, user, {
        title: text(form, 'title'),
        ask: text(form, 'ask'),
        why: text(form, 'why'),
        minutesAsked: Number(text(form, 'minutesAsked') || 60),
        startsAt: text(form, 'startsAt'),
        endsAt: text(form, 'endsAt'),
        target: Number(text(form, 'target') || 500),
        portalIds: ids(form, 'portal'),
        experimentId: Number(text(form, 'experiment')) || null,
        tryPath: text(form, 'tryPath'),
      })
      const dest = next.includes('/missions') ? `${next.replace(/\/new$/, '')}/${created.id}` : `/master/missions/${created.id}`
      return wantsJson ? NextResponse.json({ ok: true, id: created.id }) : redirectTo(req, dest, undefined, 'Draft saved. Open it when you are ready to ask.')
    }
    if (action === 'update') {
      await updateMission(payload, user, Number(text(form, 'id')), {
        title: text(form, 'title'),
        ask: text(form, 'ask'),
        why: text(form, 'why'),
        minutesAsked: Number(text(form, 'minutesAsked') || 60),
        startsAt: text(form, 'startsAt'),
        endsAt: text(form, 'endsAt'),
        target: Number(text(form, 'target') || 500),
        portalIds: ids(form, 'portal'),
        experimentId: Number(text(form, 'experiment')) || null,
        tryPath: text(form, 'tryPath'),
      })
      return ok('Saved.')
    }
    if (action === 'open') {
      await openMission(payload, user, Number(text(form, 'id')))
      return ok('The mission is open. Learners will see a warm card, never a scolding.')
    }
    if (action === 'close') {
      await closeMission(payload, user, Number(text(form, 'id')))
      return ok('Closed. Nobody new can join.')
    }
    if (action === 'result') {
      const shared = await shareResult(payload, user, Number(text(form, 'id')), text(form, 'result'))
      return ok(`Thank you notes went to ${shared.thanked} ${shared.thanked === 1 ? 'learner' : 'learners'}.`, { thanked: shared.thanked })
    }
    if (action === 'join') {
      await joinMission(payload, user, Number(text(form, 'id')), portalIdOf(user) || Number(text(form, 'portal')) || null)
      return ok('Thank you for joining. Take it at your own pace.')
    }
    if (action === 'finish') {
      await finishMission(payload, user, Number(text(form, 'id')))
      return ok('You did it. Thank you.')
    }
    if (action === 'support') {
      await postSupport(payload, user, text(form, 'body'), portalIdOf(user), user.role !== 'learner')
      return ok(user.role === 'learner' ? 'Sent. Someone on the team will write back here.' : 'Reply sent.')
    }
    return fail('That action is not one the missions desk knows.')
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'That did not work.')
  }
}
