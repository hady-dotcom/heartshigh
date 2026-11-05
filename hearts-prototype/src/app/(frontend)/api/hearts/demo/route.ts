import { NextResponse } from 'next/server'
import { isDemoRole, safeDemoNext } from '@/lib/parenting-demo'
import { getSession } from '@/server/context'
import { applyDemoForm, demoRedirect, loadDemoRoom, openDemoRoom, saveDemoRoom } from '@/server/parenting-demo'

export const dynamic = 'force-dynamic'

function text(form: FormData, name: string) {
  return String(form.get(name) || '').trim()
}

function redirectTo(req: Request, path: string, notice?: string, error?: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const safe = path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : '/demo'
  const url = new URL(safe, host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error)
  if (notice) url.searchParams.set('notice', notice)
  return NextResponse.redirect(url, 303)
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') || ''
  const { payload, user } = await getSession()
  if (!user || user.role !== 'master') return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const room = await loadDemoRoom(payload, token)
  if (!room) return NextResponse.json({ error: 'That practice room is not here.' }, { status: 404 })
  return NextResponse.json({ seq: room.state.seq })
}

export async function POST(req: Request) {
  const form = await req.formData()
  const action = text(form, 'action')
  const { payload, user } = await getSession()
  if (action === 'open') {
    if (!user || user.role !== 'master') {
      return redirectTo(req, '/login?next=/demo')
    }
    const room = await openDemoRoom(payload, {
      master: text(form, 'master'),
      portalAdmin: text(form, 'portalAdmin'),
      portalName: text(form, 'portalName'),
      teacher: text(form, 'teacher'),
      learner: text(form, 'learner'),
    })
    const step = text(form, 'step')
    return redirectTo(req, demoRedirect('open', isDemoRole(step) ? step : '', room.token, ''))
  }

  if (!user || user.role !== 'master') return redirectTo(req, '/login?next=/demo')
  const token = text(form, 'demo')
  const room = await loadDemoRoom(payload, token)
  if (!room) return redirectTo(req, '/demo', undefined, 'That practice room is not here.')
  const next = safeDemoNext(text(form, 'next'), demoRedirect(action, '', room.token, ''))
  if (action === 'logout') return redirectTo(req, next)
  const nextState = applyDemoForm(room, action, form)
  if (!nextState) return redirectTo(req, next, undefined, 'This practice view cannot change the real course.')
  if (nextState !== room.state) await saveDemoRoom(payload, { ...room, state: nextState })
  const notice = action === 'reset' ? 'The practice room is back to the start.' : action === 'note' || action === 'announce' || action === 'announce-create' ? 'The note is on the learner’s home.' : action === 'answer' ? 'Your answer is saved.' : action === 'sequence-features' || action === 'demo-features' ? 'Saved.' : action === 'reply' ? 'Your reply is saved.' : ''
  return redirectTo(req, next, notice || undefined)
}
