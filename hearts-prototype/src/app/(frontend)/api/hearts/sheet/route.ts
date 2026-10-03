import { NextResponse } from 'next/server'
import { idOf, portalIdOf } from '@/lib/ids'
import { templateWorkbook } from '@/lib/master-sheet'
import { getSession, loadPortal } from '@/server/context'
import { applyPlan, exportBuffer, planBuffer, scopeFrom, summaryOf, undoSnapshot, writeAudit, type SheetScope } from '@/server/master-sheet'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 8 * 1024 * 1024

function redirectTo(req: Request, path: string, error?: string, notice?: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const safe = path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : '/'
  const url = new URL(safe, host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error)
  if (notice) url.searchParams.set('notice', notice)
  return NextResponse.redirect(url, 303)
}

function wantsJson(req: Request, form?: FormData) {
  return form?.get('response') === 'json' || (req.headers.get('accept') || '').includes('application/json')
}

async function resolveScope(form: FormData | URLSearchParams): Promise<{ scope: SheetScope } | { error: string; status: number }> {
  const { payload, user, viewAs } = await getSession()
  if (!user) return { error: 'Sign in first.', status: 401 }
  if (viewAs) return { error: 'Sign out of view-as before using the master sheet.', status: 403 }
  if (user.role !== 'master' && user.role !== 'portal-admin') return { error: 'The master sheet is for the master desk and portal admins.', status: 403 }
  const value = (key: string) => String(form.get(key) || '')
  const desk = user.role === 'portal-admin' ? 'portal' : value('desk') === 'portal' ? 'portal' : 'master'
  let portalId: number | null = user.role === 'portal-admin' ? portalIdOf(user) : null
  const slug = value('portal') || value('portalSlug')
  if (desk === 'portal' || value('scope') === 'portal') {
    if (user.role === 'master') {
      const portal = slug ? await loadPortal(payload, slug) : null
      if (!portal && value('portalId')) portalId = Number(value('portalId')) || null
      else if (!portal) return { error: 'Name the portal this sheet belongs to.', status: 400 }
      else portalId = portal.id
    }
    if (!portalId) return { error: 'Your account is not in a portal.', status: 403 }
  }
  if (user.role === 'portal-admin' && value('scope') === 'library') return { error: 'Portal admins cannot import the master library.', status: 403 }
  const courseId = Number(value('course') || value('courseId')) || null
  const asked = value('scope') || (value('kind') === 'export' ? 'library' : value('kind'))
  const kind = courseId && (asked === 'course' || value('kind') === 'export') ? 'course' : asked
  const scope = scopeFrom(kind, portalId, courseId, desk)
  if (scope.kind === 'course') {
    if (!courseId) return { error: 'Choose a course.', status: 400 }
    const course = await payload.findByID({ collection: 'courses', id: courseId, depth: 0, overrideAccess: true }).catch(() => null)
    if (!course) return { error: 'That course was not found.', status: 404 }
    const origin = (course as { origin?: string }).origin
    const coursePortal = idOf((course as { portal?: unknown }).portal)
    if (user.role === 'portal-admin' && (origin !== 'local' || coursePortal !== portalIdOf(user))) return { error: 'Portal admins can only use courses made in their own portal.', status: 403 }
    scope.portalId = origin === 'local' ? coursePortal : null
    scope.courseId = courseId
  }
  if (user.role === 'portal-admin' && scope.kind === 'library') return { error: 'Portal admins cannot import the master library.', status: 403 }
  return { scope }
}

function fileResponse(buffer: Buffer, name: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const kind = url.searchParams.get('kind') || 'template'
  if (kind === 'template') {
    const { user } = await getSession()
    if (!user || (user.role !== 'master' && user.role !== 'portal-admin')) return NextResponse.json({ error: 'Sign in on a desk first.' }, { status: 401 })
    return fileResponse(await templateWorkbook(), 'hearts-master-sheet-template.xlsx')
  }
  const resolved = await resolveScope(url.searchParams)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const { payload } = await getSession()
  const buffer = await exportBuffer(payload, resolved.scope)
  const name = resolved.scope.kind === 'course' ? `hearts-course-${resolved.scope.courseId}.xlsx` : resolved.scope.kind === 'portal' ? `hearts-portal-${resolved.scope.portalId}.xlsx` : 'hearts-library.xlsx'
  return fileResponse(buffer, name)
}

async function readUpload(form: FormData) {
  const file = form.get('file')
  if (!(file instanceof File) || !file.size) return { error: 'Choose the .xlsx file to upload.' }
  if (file.size > MAX_BYTES) return { error: 'That workbook is larger than 8 MB. Split it and upload the parts.' }
  const buffer = Buffer.from(await file.arrayBuffer())
  return { buffer, name: file.name || 'sheet.xlsx' }
}

export async function POST(req: Request) {
  const form = await req.formData()
  const intent = String(form.get('intent') || 'preview')
  const next = String(form.get('next') || '/master/sheet')
  const json = wantsJson(req, form)
  const fail = (message: string, status = 400) => (json ? NextResponse.json({ error: message }, { status }) : redirectTo(req, next, message))
  const resolved = await resolveScope(form)
  if ('error' in resolved) return fail(resolved.error, resolved.status)
  const { payload, user } = await getSession()
  if (!user) return fail('Sign in first.', 401)
  const scope = resolved.scope

  if (intent === 'undo') {
    const where = scope.desk === 'portal'
      ? { and: [{ state: { equals: 'applied' } }, { desk: { equals: 'portal' } }, { portal: { equals: scope.portalId } }] }
      : { and: [{ state: { equals: 'applied' } }, { desk: { equals: 'master' } }] }
    const found = await payload.find({ collection: 'sheet-imports', overrideAccess: true, depth: 0, limit: 1, sort: '-createdAt', where: where as never })
    const row = found.docs[0] as { id: number; snapshot?: unknown; fileName?: string } | undefined
    if (!row?.snapshot) return fail('There is no import to undo.')
    try {
      await undoSnapshot(payload, row.snapshot as never)
    } catch {
      return fail('The last import could not be undone.')
    }
    await payload.update({ collection: 'sheet-imports', id: row.id, overrideAccess: true, data: { state: 'undone' } as never })
    await writeAudit(payload, 'sheet.undo', user, scope.portalId, { importId: row.id, fileName: row.fileName || '' })
    const notice = 'The last import has been undone.'
    return json ? NextResponse.json({ ok: true, notice, importId: row.id }) : redirectTo(req, next, undefined, notice)
  }

  let buffer: Buffer
  let fileName = 'sheet.xlsx'
  let importId = Number(form.get('import') || 0) || null
  if (intent === 'apply' && importId) {
    const stored = await payload.findByID({ collection: 'sheet-imports', id: importId, depth: 0, overrideAccess: true }).catch(() => null) as { workbook?: string; fileName?: string; desk?: string; portal?: unknown; summary?: { scope?: string; portalId?: number | null; courseId?: number | null } } | null
    if (!stored?.workbook) return fail('Upload the sheet again. That preview is no longer here.')
    if (stored.desk !== scope.desk) return fail('That preview belongs to another desk.')
    if (stored.summary?.scope === 'library' || stored.summary?.scope === 'portal' || stored.summary?.scope === 'course') {
      scope.kind = stored.summary.scope
      scope.portalId = stored.summary.portalId ?? scope.portalId
      scope.courseId = stored.summary.courseId ?? null
    }
    buffer = Buffer.from(stored.workbook, 'base64')
    fileName = stored.fileName || fileName
  } else {
    const upload = await readUpload(form)
    if ('error' in upload) return fail(upload.error || 'Choose the .xlsx file to upload.')
    buffer = upload.buffer!
    fileName = upload.name!
  }

  const { plan, counts } = await planBuffer(payload, scope, buffer)
  const summary = { ...summaryOf(plan, fileName), scope: scope.kind, portalId: scope.portalId, courseId: scope.courseId }
  if (intent !== 'apply') {
    const doc = await payload.create({
      collection: 'sheet-imports', overrideAccess: true,
      data: { desk: scope.desk, portal: scope.portalId || undefined, actor: user.id, actorRole: user.role, fileName, state: 'preview', at: new Date().toISOString(), summary, workbook: buffer.toString('base64') } as never,
    })
    if (json) return NextResponse.json({ ok: true, importId: doc.id, ...summary })
    const url = new URL(next, 'http://localhost')
    url.searchParams.set('preview', String(doc.id))
    return redirectTo(req, `${url.pathname}${url.search}`)
  }
  if (plan.errors.length) {
    if (json) return NextResponse.json({ ok: false, ...summary }, { status: 422 })
    return redirectTo(req, next, 'The sheet still has rows to fix. Nothing was saved.')
  }
  if (!plan.ops.length) {
    const notice = 'Nothing to change. The sheet matches what is already here.'
    return json ? NextResponse.json({ ok: true, notice, ...summary }) : redirectTo(req, next, undefined, notice)
  }
  let snapshot
  try {
    snapshot = await applyPlan(payload, plan, user.id)
  } catch (error) {
    const partial = (error as { snapshot?: unknown }).snapshot
    if (partial) {
      await payload.create({ collection: 'sheet-imports', overrideAccess: true, data: { desk: scope.desk, portal: scope.portalId || undefined, actor: user.id, actorRole: user.role, fileName, state: 'applied', at: new Date().toISOString(), summary, snapshot: partial, workbook: buffer.toString('base64') } as never }).catch(() => undefined)
    }
    return fail(error instanceof Error ? error.message : 'The import stopped before it finished. Undo is there if any rows were saved.')
  }
  const saved = importId
    ? await payload.update({ collection: 'sheet-imports', id: importId, overrideAccess: true, data: { state: 'applied', at: new Date().toISOString(), summary, snapshot } as never })
    : await payload.create({ collection: 'sheet-imports', overrideAccess: true, data: { desk: scope.desk, portal: scope.portalId || undefined, actor: user.id, actorRole: user.role, fileName, state: 'applied', at: new Date().toISOString(), summary, snapshot, workbook: buffer.toString('base64') } as never })
  await writeAudit(payload, 'sheet.import', user, scope.portalId, { importId: saved.id, fileName, scope: scope.kind, counts })
  const notice = `Imported ${fileName}: ${counts.create} added, ${counts.update} updated, ${counts.delete} removed.`
  return json ? NextResponse.json({ ok: true, notice, importId: saved.id, ...summary }) : redirectTo(req, next, undefined, notice)
}
