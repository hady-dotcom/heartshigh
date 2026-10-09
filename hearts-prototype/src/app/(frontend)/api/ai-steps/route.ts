import { NextResponse } from 'next/server'

const col = (name: string) => name as 'users'
import { portalIdOf } from '@/lib/ids'
import { getSession } from '@/server/context'
import { actorOf, ensureSteps, publishVersion, saveVersion, setGrant, startJob, tryStep } from '@/server/ai-desk'
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

function ids(form: FormData) {
  return form
    .getAll('lesson')
    .flatMap((value) => String(value).split(','))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
}

export async function GET(req: Request) {
  const { payload, user } = await getSession()
  if (!user || (user.role !== 'master' && user.role !== 'portal-admin')) return NextResponse.json({ error: 'Sign in on the desk first.' }, { status: 401 })
  const url = new URL(req.url)
  const jobId = Number(url.searchParams.get('job'))
  if (!jobId) return NextResponse.json({ error: 'Name the job.' }, { status: 400 })
  await ensureSteps(payload)
  const job = await payload.findByID({ collection: col('ai-step-jobs'), id: jobId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!job) return NextResponse.json({ error: 'That job was not found.' }, { status: 404 })
  const row = job as { status?: string; finished?: number; failedCount?: number; total?: number; results?: unknown; error?: string; stepSlug?: string }
  return NextResponse.json({ id: jobId, status: row.status, finished: row.finished, failed: row.failedCount, total: row.total, results: row.results || [], error: row.error || '', step: row.stepSlug })
}

export async function POST(req: Request) {
  const session = await getSession()
  const { payload, user } = session
  const form = await req.formData()
  const next = text(form, 'next') || '/master/ai'
  if (!user) return redirectTo(req, `/login?next=${encodeURIComponent(next)}`, 'Sign in first.')
  const actor = actorOf(user)
  const signedIn = session.actor?.role || user.role
  const portalId = signedIn === 'master' || user.role === 'master' ? null : portalIdOf(user)
  const client = await clientForPortal(payload, portalId, user.role, signedIn)
  const action = text(form, 'action')
  try {
    await ensureSteps(payload)
    if (action === 'save-version') {
      const saved = await saveVersion(payload, actor, {
        slug: text(form, 'slug'),
        prompt: text(form, 'prompt'),
        provider: text(form, 'provider'),
        model: text(form, 'model'),
        temperature: Number(text(form, 'temperature')),
        maxTokens: Number(text(form, 'maxTokens')),
        note: text(form, 'note'),
      })
      return redirectTo(req, next, undefined, `Version ${saved.version.number} saved. It is not live until you mark it.`)
    }
    if (action === 'mark-live' || action === 'rollback') {
      const number = Number(text(form, 'version'))
      await publishVersion(payload, actor, text(form, 'slug'), number, action === 'rollback')
      return redirectTo(req, next, undefined, action === 'rollback' ? `Rolled back to version ${number}.` : `Version ${number} is live.`)
    }
    if (action === 'grant') {
      const allowed = text(form, 'value') === 'on'
      await setGrant(payload, actor, allowed)
      return redirectTo(req, next, undefined, allowed ? 'Portal admins can edit the steps.' : 'Portal admins can read the steps, and no longer edit them.')
    }
    if (action === 'try') {
      const lesson = Number(text(form, 'lesson'))
      const slug = text(form, 'slug')
      await tryStep(payload, actor, slug, lesson, text(form, 'prompt'), client)
      const url = new URL(next, 'http://localhost')
      url.searchParams.set('tried', String(lesson))
      return redirectTo(req, `${url.pathname}${url.search}`, undefined, 'Compared with the live version. Nothing was saved for learners.')
    }
    if (action === 'start-job') {
      const slug = text(form, 'slug') || 'pipeline'
      const scope = text(form, 'scope') || 'talk'
      const lessonIds = ids(form)
      const courseId = Number(text(form, 'course')) || undefined
      const { job, run } = await startJob(payload, actor, { slug, scope, lessonIds, courseId, gapMs: Number(text(form, 'gap')) || 0, portalId: client ? portalId : null })
      if (text(form, 'wait') === '1') await run()
      else {
        void run().catch(async (error: unknown) => {
          await payload.update({ collection: col('ai-step-jobs'), id: job.id, overrideAccess: true, data: { status: 'failed', error: error instanceof Error ? error.message : 'The job stopped.' } as never }).catch(() => undefined)
        })
      }
      const root = text(form, 'jobBase') || '/master/ai'
      return redirectTo(req, `${root}/job/${job.id}`, undefined, 'The re-run is going. This page keeps count.')
    }
    return redirectTo(req, next, 'That action is not one the AI desk knows.')
  } catch (error) {
    return redirectTo(req, next, error instanceof Error ? error.message : 'That did not work.', undefined)
  }
}
