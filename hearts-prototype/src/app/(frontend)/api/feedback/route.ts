import { NextResponse } from 'next/server'
import { anonymiseFromQuery, canNameExport, canReadFeedback, parseFilters } from '@/lib/feedback'
import { json, portalOf, viewAsRefusal } from '@/server/api'
import { getSession } from '@/server/context'
import { portalDisplayName } from '@/lib/portal-name'
import { featureGoneJson } from '@/server/features'
import { checkQuestions, draftQuestionSummary, exportFilename, feedbackFor, includeSummary, includedSummaries, recordExport, renderExport } from '@/server/feedback'
import { clientForPortal } from '@/server/portal-ai'

export const dynamic = 'force-dynamic'

function redirectTo(req: Request, path: string, error?: string, notice?: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const safe = path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : '/'
  const url = new URL(safe, host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error.slice(0, 400))
  if (notice) url.searchParams.set('notice', notice.slice(0, 400))
  return NextResponse.redirect(url, 303)
}

function text(form: FormData, name: string) {
  return String(form.get(name) || '')
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session.user || !canReadFeedback(session.user.role)) return json({ error: 'Sign in on the desk first.' }, 401)
  const refused = await viewAsRefusal(session, 'feedback-export', true)
  if (refused) return refused
  const portal = await portalOf(session, req)
  if (!portal) return json({ error: 'That portal is not yours.' }, 403)
  const gone = featureGoneJson(portal, 'feedback')
  if (gone) return gone
  const url = new URL(req.url)
  const format = url.searchParams.get('format') || ''
  const query = Object.fromEntries(url.searchParams.entries())
  const named = query.named === '1'
  if (named && !canNameExport(session.user.role)) return json({ error: 'A named export needs a teacher or admin on this portal.' }, 403)
  const anonymised = !named
  const filters = parseFilters(query)
  const built = await feedbackFor(session.payload, portal.id, filters, anonymised)
  const summaries = format === 'pdf' ? await includedSummaries(session.payload, portal.id, built) : []
  const rendered = await renderExport(built, format, summaries, { portal: portalDisplayName(portal), from: filters.from, to: filters.to })
  if (!rendered) return json({ error: 'Choose CSV, Excel or PDF.' }, 400)
  await recordExport(session.payload, session.user, portal.id, format, filters, built)
  const filename = exportFilename(anonymised, rendered.ext)
  const body = typeof rendered.body === 'string' ? rendered.body : new Uint8Array(rendered.body)
  return new Response(body, {
    headers: {
      'content-type': rendered.type,
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session.user || !canReadFeedback(session.user.role)) return json({ error: 'Sign in on the desk first.' }, 401)
  const refused = await viewAsRefusal(session, 'feedback', true)
  if (refused) return refused
  const portal = await portalOf(session, req)
  if (!portal) return redirectTo(req, '/', 'That portal is not yours.')
  const gone = featureGoneJson(portal, 'feedback')
  if (gone) return gone
  const form = await req.formData().catch(() => null)
  if (!form) return json({ error: 'The form was empty.' }, 400)
  const next = text(form, 'next') || `/p/${portal.slug}/admin/feedback`
  const action = text(form, 'action')
  try {
    if (action === 'summarise') {
      const query = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]))
      const built = await feedbackFor(session.payload, portal.id, parseFilters(query), anonymiseFromQuery(query))
      const wantAi = text(form, 'usePortalAi') === 'yes'
      const client = wantAi ? await clientForPortal(session.payload, portal.id, session.user.role, session.actor?.role) : null
      const result = await draftQuestionSummary(session.payload, session.user, portal.id, built, text(form, 'questionKey'), client)
      if ('error' in result && result.error) return redirectTo(req, next, result.error)
      const notice = result.paidFallback
        ? result.paidFallback
        : client
          ? 'A summary from this portal’s AI account is ready as a draft. Include it when you want it in the digest.'
          : 'A built-in summary is ready as a draft. Include it when you want it in the digest.'
      return redirectTo(req, next, undefined, notice)
    }
    if (action === 'include-summary') {
      const result = await includeSummary(session.payload, portal.id, Number(text(form, 'id')))
      if ('error' in result && result.error) return redirectTo(req, next, result.error)
      return redirectTo(req, next, undefined, 'The summary is included in the PDF digest.')
    }
    if (action === 'check-questions') {
      const wantAi = text(form, 'usePortalAi') === 'yes'
      const client = wantAi ? await clientForPortal(session.payload, portal.id, session.user.role, session.actor?.role) : null
      const result = await checkQuestions(session.payload, session.user, client)
      const paid = result.paidFallback ? ` ${result.paidFallback}` : ''
      return redirectTo(req, next, undefined, `Checked ${result.checked} questions. ${result.flagged} weak ones have a draft rewrite. Nothing was published.${paid}`)
    }
    return redirectTo(req, next, 'That action is not known.')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The feedback desk could not finish that.'
    return redirectTo(req, next, message)
  }
}
