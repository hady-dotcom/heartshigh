import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { portalIdOf } from '@/lib/ids'
import { cookiesSecure } from '@/lib/env'
import { getSession } from '@/server/context'
import {
  addSuggestedVariants,
  assignVariant,
  canEditExperiments,
  canViewExperiments,
  createExperiment,
  createLabelExperiment,
  csvFor,
  experimentsKilled,
  fillTestNumbers,
  finishExperiment,
  logExposure,
  parseVariants,
  pauseExperiment,
  promoteWinner,
  recordLearnerEvent,
  resultsFor,
  setKillSwitch,
  setVariantApproval,
  startExperiment,
  subjectFrom,
  suggestFor,
  updateExperiment,
} from '@/server/experiments'

export const dynamic = 'force-dynamic'

const DEVICE = 'hearts_device'

const DRAFT_FIELDS = ['key', 'name', 'description', 'slot', 'slotOverride', 'portal', 'allocation', 'primaryMetric', 'secondary', 'variants'] as const

function redirectTo(req: Request, path: string, error?: string, notice?: string, form?: FormData) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const safe = path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : '/'
  const url = new URL(safe, host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error.slice(0, 400))
  if (notice) url.searchParams.set('notice', notice.slice(0, 400))
  if (error && form) {
    for (const name of DRAFT_FIELDS) {
      const value = String(form.get(name) || '')
      if (value) url.searchParams.set(name, value.slice(0, 800))
    }
  }
  return NextResponse.redirect(url, 303)
}

function text(form: FormData, name: string) {
  return String(form.get(name) || '')
}

function newId() {
  return `d${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 24)
}

async function deviceId(response?: NextResponse) {
  const jar = await cookies()
  const held = jar.get(DEVICE)?.value
  if (held && /^[a-zA-Z0-9_-]{8,80}$/.test(held)) return held
  const next = newId()
  const secure = cookiesSecure() ? '; Secure' : ''
  if (response) response.headers.append('Set-Cookie', `${DEVICE}=${next}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 400}${secure}`)
  else {
    try {
      jar.set(DEVICE, next, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 400, secure: cookiesSecure() })
    } catch {
      // Setting cookies from a Server Component context can fail; the middleware will fill it next.
    }
  }
  return next
}

function json(data: unknown, status = 200, extra?: NextResponse) {
  const response = NextResponse.json(data, { status })
  extra?.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') response.headers.append(key, value)
  })
  return response
}

export async function GET(req: Request) {
  const { payload, user } = await getSession()
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || 'assign'
  const device = await deviceId()
  const portal = portalIdOf(user)
  if (action === 'export') {
    if (!user || !canViewExperiments(user)) return NextResponse.json({ error: 'Sign in on the desk first.' }, { status: 401 })
    const id = Number(url.searchParams.get('id'))
    try {
      const results = await resultsFor(payload, user, id)
      return new NextResponse(csvFor(results), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${results.experiment.key}-results.csv"`,
        },
      })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'That export failed.' }, { status: 400 })
    }
  }
  if (action === 'assign') {
    const slot = String(url.searchParams.get('slot') || '')
    const subject = subjectFrom(user, device, portal)
    const view = await assignVariant(payload, slot, subject)
    const response = NextResponse.json(view)
    return response
  }
  if (action === 'status') {
    return NextResponse.json({ killed: await experimentsKilled(payload) })
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
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
  const next = text(form, 'next') || '/master/experiments'
  const action = text(form, 'action')
  const device = await deviceId()
  const portal = portalIdOf(user)

  const fail = (message: string, status = 400) => (wantsJson ? NextResponse.json({ ok: false, error: message }, { status: action === 'create' || action === 'update' || action === 'suggest' ? 200 : status }) : redirectTo(req, next, message, undefined, action === 'create' || action === 'update' ? form : undefined))
  const ok = (notice: string, extra?: unknown) => (wantsJson ? NextResponse.json({ ok: true, notice, ...(extra && typeof extra === 'object' ? extra : {}) }) : redirectTo(req, next, undefined, notice))

  try {
    if (action === 'track') {
      const event = text(form, 'event')
      const props: Record<string, string> = {}
      for (const [key, value] of form.entries()) {
        if (key.startsWith('prop_')) props[key.slice(5)] = String(value)
      }
      await recordLearnerEvent(payload, { user, deviceId: device, event, props, sessionId: text(form, 'session') || undefined, portalId: portal })
      return ok('Recorded.', { event })
    }
    if (action === 'expose') {
      const subject = subjectFrom(user, device, portal)
      const result = await logExposure(payload, text(form, 'slot'), subject, text(form, 'session') || undefined)
      return ok(result.ok ? 'Exposed.' : 'Skipped.', result)
    }
    if (!user) return wantsJson ? NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) : redirectTo(req, `/login?next=${encodeURIComponent(next)}`, 'Sign in first.')
    if (action === 'from-label') {
      if (!canEditExperiments(user)) return fail('Only the master can create an experiment.', 403)
      const created = await createLabelExperiment(payload, user, {
        slot: text(form, 'slot'),
        label: text(form, 'label'),
        reason: text(form, 'reason'),
        portalId: Number(text(form, 'portal')) || null,
      })
      const dest = `/master/experiments/${created.id}`
      return wantsJson ? NextResponse.json({ ok: true, id: created.id, key: created.key }) : redirectTo(req, dest, undefined, 'Draft saved. Approve the versions, then start it.')
    }
    if (action === 'create') {
      if (!canEditExperiments(user)) return fail('Only the master can create an experiment.', 403)
      const slot = text(form, 'slotOverride').trim() || text(form, 'slot')
      const created = await createExperiment(payload, user, {
        key: text(form, 'key').trim(),
        name: text(form, 'name'),
        description: text(form, 'description'),
        slot,
        portalId: Number(text(form, 'portal')) || null,
        allocation: text(form, 'allocation') === 'auto' ? 'auto' : 'fixed',
        primaryMetric: text(form, 'primaryMetric'),
        secondaryMetrics: text(form, 'secondary').split(/[, ]+/).map((item) => item.trim()).filter(Boolean),
        variants: parseVariants(text(form, 'variants'), slot),
      })
      const dest = next.includes('/experiments') ? `${next.replace(/\/new$/, '')}/${created.id}` : `/master/experiments/${created.id}`
      return wantsJson ? NextResponse.json({ ok: true, id: created.id, key: created.key }) : redirectTo(req, dest, undefined, 'Draft saved. Approve the versions, then start it.')
    }
    if (action === 'update') {
      if (!canEditExperiments(user)) return fail('Only the master can change an experiment.', 403)
      await updateExperiment(payload, user, Number(text(form, 'id')), {
        name: text(form, 'name'),
        description: text(form, 'description'),
        allocation: text(form, 'allocation') === 'auto' ? 'auto' : 'fixed',
        primaryMetric: text(form, 'primaryMetric'),
        secondaryMetrics: text(form, 'secondary').split(/[, ]+/).map((item) => item.trim()).filter(Boolean),
        variants: parseVariants(text(form, 'variants'), text(form, 'slot') || (await resultsFor(payload, user, Number(text(form, 'id')))).experiment.slot),
        portalId: text(form, 'portal') === '' ? null : Number(text(form, 'portal')) || undefined,
      })
      return ok('Saved.')
    }
    if (action === 'start') {
      await startExperiment(payload, user, Number(text(form, 'id')))
      return ok('The experiment is running. Learners are not told.')
    }
    if (action === 'pause') {
      await pauseExperiment(payload, user, Number(text(form, 'id')))
      return ok('Paused. Learners see the usual default again.')
    }
    if (action === 'finish') {
      await finishExperiment(payload, user, Number(text(form, 'id')), text(form, 'variant') || undefined)
      return ok('Finished.')
    }
    if (action === 'promote') {
      await promoteWinner(payload, user, Number(text(form, 'id')), text(form, 'variant') || undefined)
      return ok('That version is now the default for this slot.')
    }
    if (action === 'approve-variant' || action === 'reject-variant') {
      await setVariantApproval(payload, user, Number(text(form, 'id')), text(form, 'variant'), action === 'approve-variant')
      return ok(action === 'approve-variant' ? 'Approved. It can run when you start the experiment.' : 'Held back. It will not receive traffic.')
    }
    if (action === 'suggest') {
      const suggested = await suggestFor(payload, user, Number(text(form, 'id')), text(form, 'current'))
      await addSuggestedVariants(payload, user, Number(text(form, 'id')), suggested.drafts)
      return ok(suggested.engine === 'mock' || suggested.engine.startsWith('mock') ? 'Mock drafts added. Approve each one before it can run.' : `Drafts from ${suggested.engine}. Approve each one before it can run.`)
    }
    if (action === 'kill') {
      const off = text(form, 'value') !== 'off'
      await setKillSwitch(payload, user, off)
      return ok(off ? 'The kill switch is on. Every running test is paused.' : 'The kill switch is off.')
    }
    if (action === 'test-data') {
      const n = await fillTestNumbers(payload, user, Number(text(form, 'id')))
      return ok(`Added ${n} labelled test events on this development database.`)
    }
    return fail('That action is not one the experiments desk knows.')
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'That did not work.')
  }
}
