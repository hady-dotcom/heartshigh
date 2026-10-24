import { NextResponse } from 'next/server'
import { idOf, portalIdOf } from '@/lib/ids'
import { creatorMinSeconds, searchTalks } from '@/lib/sheet-search'
import { getSession } from '@/server/context'
import { planBuffer, summaryOf, writeAudit, type SheetScope } from '@/server/master-sheet'
import { buildWorkbook } from '@/lib/master-sheet'
import { collectCreatorSources, draftOne, draftWorkbook, type CreatorSource } from '@/server/sheet-creator'
import { resolveScope } from '@/server/sheet-scope'
import { saveOwnedMedia } from '@/server/media'

export const dynamic = 'force-dynamic'

const MAX_VIDEO = 200 * 1024 * 1024

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function gate() {
  const session = await getSession()
  if (!session.user) return { error: fail('Sign in first.', 401) }
  if (session.viewAs) return { error: fail('Sign out of view-as before building a sheet.', 403) }
  if (session.user.role !== 'master' && session.user.role !== 'portal-admin') return { error: fail('The sheet creator is for the master desk and portal admins.', 403) }
  return { session }
}

function fieldsOf(body: Record<string, unknown>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(body)) if (value != null && typeof value !== 'object') form.set(key, String(value))
  return form
}

function numberOrNull(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(req: Request) {
  const gateResult = await gate()
  if ('error' in gateResult && gateResult.error) return gateResult.error
  const url = new URL(req.url)
  const id = Number(url.searchParams.get('preview') || 0)
  if (!id) return fail('Name the draft to download.')
  const { payload, user } = (await getSession())
  const doc = await payload.findByID({ collection: 'sheet-imports', id, depth: 0, overrideAccess: true }).catch(() => null) as { workbook?: string; fileName?: string; desk?: string; portal?: unknown } | null
  if (!doc?.workbook) return fail('That draft is no longer here.', 404)
  if (user!.role === 'portal-admin' && idOf(doc.portal) !== portalIdOf(user)) return fail('That draft belongs to another portal.', 403)
  return new NextResponse(new Uint8Array(Buffer.from(doc.workbook, 'base64')), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${doc.fileName || 'hearts-draft.xlsx'}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(req: Request) {
  const gateResult = await gate()
  if ('error' in gateResult && gateResult.error) return gateResult.error
  const { payload, user } = (await getSession())
  const type = req.headers.get('content-type') || ''
  const form = type.includes('application/json') ? null : await req.formData().catch(() => null)
  const body = form ? Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === 'string')) as Record<string, unknown> : ((await req.json().catch(() => null)) as Record<string, unknown> | null) || {}
  const intent = String(body.intent || form?.get('intent') || 'search')

  if (intent === 'upload') {
    const file = form?.get('file')
    if (!(file instanceof File) || !file.size) return fail('Choose a video file.')
    if (file.size > MAX_VIDEO) return fail('That video is over 200 MB.')
    const mime = file.type || 'video/mp4'
    if (!mime.startsWith('video/') && !/\.(mp4|webm|mov|m4v)$/i.test(file.name)) return fail('That file needs to be a video.')
    const portal = user!.role === 'portal-admin' ? portalIdOf(user) : null
    try {
      const mediaId = await saveOwnedMedia(payload, file, { portal, owner: user!.id, purpose: 'film', fallbackType: mime, alt: file.name })
      return NextResponse.json({ ok: true, mediaId, name: file.name })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'That video could not be stored.'
      return fail(message.includes('invalid') ? 'That video file could not be stored. Use an mp4, webm or mov.' : message)
    }
  }

  try {
    if (intent === 'search') {
      const found = await searchTalks({
        topic: String(body.topic || ''),
        speaker: String(body.speaker || ''),
        limit: numberOrNull(body.count) || 8,
        minSeconds: creatorMinSeconds(numberOrNull(body.minSeconds ?? body.min)),
        maxSeconds: numberOrNull(body.maxSeconds ?? body.max),
      })
      if (!found.ok) return fail(found.error)
      return NextResponse.json({ ok: true, via: found.via, candidates: found.candidates })
    }

    const placed = await place(payload, user!, body)
    if ('error' in placed) return placed.error
    const { scope, course, part } = placed
    const topic = String(body.topic || '')

    if (intent === 'collect') {
      const collected = collectCreatorSources({ sources: body.sources ?? form?.get('sources'), pasted: body.pasted })
      if (!collected.ok) return fail(collected.error)
      return NextResponse.json({ ok: true, sources: collected.sources, course: course.title, part })
    }

    if (intent === 'draft-one') {
      const source = normaliseOne(body.source)
      if (!source) return fail('A source is youtube, vimeo or an uploaded file.')
      const one = await draftOne(payload, { topic, course: course.title, part }, source)
      return NextResponse.json({ ok: true, ...one })
    }

    if (intent === 'assemble') {
      const saved = await saveDraft(payload, user!, scope, course.title, part, body)
      if ('error' in saved) return saved.error
      return saved.response
    }

    const collected = collectCreatorSources({ sources: body.sources ?? form?.get('sources'), pasted: body.pasted })
    if (!collected.ok) return fail(collected.error)
    const draft = await draftWorkbook(payload, scope, { topic, course: course.title, part, sources: collected.sources })
    const saved = await saveDraft(payload, user!, scope, course.title, part, {
      talks: draft.results.filter((result) => result.included && result.talk).map((result) => result.talk),
      questions: draft.results.flatMap((result) => result.questions || []),
      resources: draft.results.flatMap((result) => result.resources || []),
      notices: draft.results.filter((result) => result.warn).map((result) => `${result.title}: ${result.detail}`),
    })
    if ('error' in saved) return saved.error
    return saved.response
  } catch (error) {
    console.error('[sheet-creator]', intent, error)
    const message = error instanceof Error && error.message ? error.message : 'The draft could not be built.'
    return fail(message)
  }
}

function normaliseOne(value: unknown): CreatorSource | null {
  const collected = collectCreatorSources({ sources: [value], pasted: '' })
  return collected.ok ? collected.sources[0] || null : null
}

async function place(payload: Awaited<ReturnType<typeof getSession>>['payload'], user: NonNullable<Awaited<ReturnType<typeof getSession>>['user']>, body: Record<string, unknown>) {
  const scopeFields = fieldsOf({ ...body, scope: 'course', desk: user.role === 'portal-admin' ? 'portal' : 'master' })
  const resolved = await resolveScope(scopeFields)
  if ('error' in resolved) return { error: fail(resolved.error, resolved.status) }
  const scope: SheetScope = resolved.scope
  if (scope.kind !== 'course' || !scope.courseId) return { error: fail('Choose the course this sheet is for.') }
  const course = await payload.findByID({ collection: 'courses', id: scope.courseId, depth: 0, overrideAccess: true }).catch(() => null) as { title?: string } | null
  if (!course?.title) return { error: fail('That course was not found.', 404) }
  const part = String(body.part || '').trim() || 'Talks'
  return { scope, course: { title: course.title }, part }
}

async function saveDraft(
  payload: Awaited<ReturnType<typeof getSession>>['payload'],
  user: NonNullable<Awaited<ReturnType<typeof getSession>>['user']>,
  scope: SheetScope,
  course: string,
  part: string,
  body: { talks?: unknown; questions?: unknown; resources?: unknown; notices?: unknown },
) {
  const talks = rowsOf(body.talks).map((talk) => ({ ...talk, course, part }))
  const questions = rowsOf(body.questions)
  const resources = rowsOf(body.resources)
  const notices = Array.isArray(body.notices) ? body.notices.map((item) => String(item || '').trim()).filter(Boolean) : []
  if (!talks.length) return { error: fail(notices.join('\n') || 'Choose at least one talk, or paste a link.') }
  const buffer = await buildWorkbook({ talks, questions, resources })
  const fileName = 'hearts-draft.xlsx'
  const { plan, counts } = await planBuffer(payload, scope, buffer)
  const summary = { ...summaryOf(plan, fileName), scope: scope.kind, portalId: scope.portalId, courseId: scope.courseId }
  const extra = notices.map((message) => ({ tab: 'Talks' as const, row: 0, column: 'notes', message }))
  summary.warnings = [...(summary.warnings || []), ...extra]
  summary.warningTotal = summary.warnings.length
  const doc = await payload.create({
    collection: 'sheet-imports', overrideAccess: true,
    data: { desk: scope.desk, portal: scope.portalId || undefined, actor: user.id, actorRole: user.role, fileName, state: 'preview', at: new Date().toISOString(), summary, workbook: buffer.toString('base64') },
  })
  await writeAudit(payload, 'sheet.draft', user, scope.portalId, { importId: doc.id, fileName, counts })
  return { response: NextResponse.json({ ok: true, importId: doc.id, ...summary, talks: talks.length, questions: questions.length, resources: resources.length, notices }) }
}

function rowsOf(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, string | number | null> => Boolean(item) && typeof item === 'object')
}
