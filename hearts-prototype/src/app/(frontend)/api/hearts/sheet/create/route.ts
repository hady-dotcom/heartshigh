import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { idOf, portalIdOf } from '@/lib/ids'
import { parsePastedSources, searchTalks } from '@/lib/sheet-search'
import { getSession } from '@/server/context'
import { planBuffer, summaryOf, writeAudit, type SheetScope } from '@/server/master-sheet'
import { draftWorkbook, type CreatorSource } from '@/server/sheet-creator'
import { resolveScope } from '@/server/sheet-scope'

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
      const media = await payload.create({
        collection: 'media', overrideAccess: true,
        data: { alt: file.name.slice(0, 120), portal: portal || undefined, owner: user!.id, purpose: 'film' },
        file: { data: Buffer.from(await file.arrayBuffer()), mimetype: mime, name: `${randomUUID()}${(file.name.match(/\.[a-z0-9]{1,5}$/i)?.[0] || '.mp4').toLowerCase()}`, size: file.size },
      })
      return NextResponse.json({ ok: true, mediaId: media.id, name: file.name })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'That video could not be stored.'
      return fail(message.includes('invalid') ? 'That video file could not be stored. Use an mp4, webm or mov.' : message)
    }
  }

  if (intent === 'search') {
    const found = await searchTalks({
      topic: String(body.topic || ''),
      speaker: String(body.speaker || ''),
      limit: numberOrNull(body.count) || 8,
      minSeconds: numberOrNull(body.minSeconds ?? body.min),
      maxSeconds: numberOrNull(body.maxSeconds ?? body.max),
    })
    if (!found.ok) return fail(found.error)
    return NextResponse.json({ ok: true, via: found.via, candidates: found.candidates })
  }

  const scopeFields = fieldsOf({ ...body, scope: 'course', desk: user!.role === 'portal-admin' ? 'portal' : 'master' })
  const resolved = await resolveScope(scopeFields)
  if ('error' in resolved) return fail(resolved.error, resolved.status)
  const scope: SheetScope = resolved.scope
  if (scope.kind !== 'course' || !scope.courseId) return fail('Choose the course this sheet is for.')
  const course = await payload.findByID({ collection: 'courses', id: scope.courseId, depth: 0, overrideAccess: true }).catch(() => null) as { title?: string } | null
  if (!course?.title) return fail('That course was not found.', 404)

  const chosen = Array.isArray(body.sources) ? (body.sources as CreatorSource[]) : []
  const pasted = parsePastedSources(String(body.pasted || ''))
  if (!pasted.ok) return fail(pasted.error)
  const sources = [...chosen, ...pasted.sources].slice(0, 25)
  if (!sources.length) return fail('Choose at least one talk, or paste a link.')
  for (const source of sources) {
    if (source.provider !== 'youtube' && source.provider !== 'vimeo' && source.provider !== 'file') return fail('A source is youtube, vimeo or an uploaded file.')
    if (source.provider === 'file' && !source.mediaId) return fail('An uploaded film is missing its media id. Upload it again.')
  }
  const draft = await draftWorkbook(payload, scope, { topic: String(body.topic || ''), course: course.title, part: String(body.part || 'Talks'), sources })
  const fileName = 'hearts-draft.xlsx'
  const { plan, counts } = await planBuffer(payload, scope, draft.buffer)
  const summary = { ...summaryOf(plan, fileName), scope: scope.kind, portalId: scope.portalId, courseId: scope.courseId }
  const doc = await payload.create({
    collection: 'sheet-imports', overrideAccess: true,
    data: { desk: scope.desk, portal: scope.portalId || undefined, actor: user!.id, actorRole: user!.role, fileName, state: 'preview', at: new Date().toISOString(), summary, workbook: draft.buffer.toString('base64') },
  })
  await writeAudit(payload, 'sheet.draft', user, scope.portalId, { importId: doc.id, fileName, counts })
  return NextResponse.json({ ok: true, importId: doc.id, ...summary, talks: draft.talks, questions: draft.questions, resources: draft.resources })
}
