import Link from 'next/link'
import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { JobPoll } from '@/components/desk/job-poll'
import { STEP_PAGE_COPY, diffLines, roleWords, stepBySlug, stepDoes, stepListBadge, stepPlainLine, type Placeholder } from '@/lib/ai-steps'
import type { SessionUser } from '@/server/context'
import { loadDesk, loadPortalActivity, pendingForLesson, touchActivitySeen } from '@/server/ai-desk'
import type { Ctx } from '../common'
import { partTitle } from '@/lib/talk-title'
import { ref, rows, str } from '../common'
import { PortalActivity } from './ai-activity'
import { HelpTip } from '@/components/desk/help'
import { PortalAiConfirm } from '@/components/desk/paid-ai'
import { TOOL } from '@/lib/desk-help'
import { AdminFrame } from './overview'
import styles from './ai.module.css'
import { DeskFrame, masterNav } from './shell'

type Query = Record<string, string | undefined>
type Doc = Record<string, unknown> & { id: number; createdAt?: string }

const STATUS_LABEL: Record<string, [string, string]> = {
  'not-run': ['Not run', 'grey'],
  running: ['Running', 'gold'],
  'draft-ready': ['Draft ready', 'teal'],
  approved: ['Approved', 'teal'],
  failed: ['Failed', 'rose'],
}

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function when(value: unknown) {
  if (!value) return ''
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function Frame({
  ctx,
  master,
  title,
  intro,
  testId,
  showOnPhone,
  children,
}: {
  ctx: Ctx | null
  master: { payload: Payload; user: SessionUser; query: Query } | null
  title: string
  intro: string
  testId: string
  showOnPhone?: boolean
  children: React.ReactNode
}) {
  if (ctx) return <AdminFrame ctx={ctx} active="ai" title={title} intro={intro} testId={testId}>{children}</AdminFrame>
  const desk = master!
  return (
    <DeskFrame payload={desk.payload} user={desk.user} title={title} intro={intro} active="ai" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={desk.query} testId={testId} showOnPhone={showOnPhone}>
      {children}
    </DeskFrame>
  )
}

function queryOf(ctx: Ctx | null, master: { query: Query } | null) {
  return (ctx?.query || master?.query || {}) as Query
}

export async function AiPages({ ctx, master, path }: { ctx?: Ctx | null; master?: { payload: Payload; user: SessionUser; query: Query } | null; path: string[] }) {
  const payload = ctx?.payload || master!.payload
  const user = ctx?.user || master!.user
  const query = queryOf(ctx || null, master || null)
  const base = ctx ? `${ctx.base}/admin/ai` : '/master/ai'
  const portalId = ctx?.portal?.id || null
  const desk = await loadDesk(payload, user, user.role === 'master' ? null : portalId)
  if (!desk.canView) return <Frame ctx={ctx || null} master={master || null} title="AI steps" intro="" testId="ai-denied"><p>The AI steps are for the master desk and portal admins.</p></Frame>
  const [head, rest] = path
  if (head === 'job' && rest) return <JobPage ctx={ctx || null} master={master || null} base={base} id={Number(rest)} desk={desk} />
  if (head === 'ingest') return <IngestPage ctx={ctx || null} master={master || null} base={base} lessonId={rest ? Number(rest) : 0} desk={desk} />
  if (head) return <StepPage ctx={ctx || null} master={master || null} base={base} slug={head} desk={desk} />
  return <Registry ctx={ctx || null} master={master || null} base={base} desk={desk} />
}

function Banner({ desk }: { desk: Awaited<ReturnType<typeof loadDesk>> }) {
  const mock = desk.mode === 'mock'
  return (
    <div className={styles.banner} data-testid={mock ? 'ai-mock-mode' : 'ai-portal-connected'} data-mode={desk.mode}>
      <b>{desk.master ? 'Built-in drafts' : mock ? 'AI is off' : 'This portal’s AI account'}</b>
      <p className={styles.quiet} style={{ margin: '4px 0 0' }}>{desk.banner}</p>
    </div>
  )
}

function Grant({ base, desk, master }: { base: string; desk: Awaited<ReturnType<typeof loadDesk>>; master: boolean }) {
  if (!master) return null
  return (
    <form action="/api/ai-steps" method="post" className="actions" style={{ marginBottom: 16 }}>
      <Hidden fields={{ action: 'grant', value: desk.portalMayEdit ? 'off' : 'on', next: base }} />
      <button className="btn ghost small" type="submit" data-testid="ai-grant">{desk.portalMayEdit ? 'Stop portal admins editing' : 'Let portal admins edit'}</button>
      <HelpTip topic="ai-grant">{TOOL.aiGrant}</HelpTip>
      <span className="hint">{desk.portalMayEdit ? 'Portal admins can edit the steps.' : 'Portal admins can read the steps, not change them.'}</span>
    </form>
  )
}

async function Registry({ ctx, master, base, desk }: { ctx: Ctx | null; master: { payload: Payload; user: SessionUser; query: Query } | null; base: string; desk: Awaited<ReturnType<typeof loadDesk>> }) {
  const payload = ctx?.payload || master!.payload
  const query = queryOf(ctx, master)
  const user = ctx?.user || master?.user
  const isMaster = user?.role === 'master'
  const portalId = ctx?.portal?.id || null
  const steps = await rows(payload, 'ai-steps', undefined, { limit: 30, sort: 'pipelineOrder' })
  const forks = !isMaster && portalId ? await rows(payload, 'ai-step-versions', { and: [{ portal: { equals: portalId } }, { live: { equals: true } }] }, { limit: 30 }) : []
  const forkByStep = new Map(forks.map((fork) => [ref(fork.step), fork]))
  const seenAt = isMaster ? await touchActivitySeen(payload) : null
  const activity = isMaster
    ? await loadPortalActivity(payload, { portalId: Number(query.portal) || null, stepSlug: query.step || null, day: query.on || null }, seenAt)
    : null
  return (
    <Frame ctx={ctx} master={master} title="AI steps" intro="Each row is one job that runs after a talk comes in. Open it to see what it does, try one talk, then mark a version live." testId="ai-registry" showOnPhone={isMaster}>
      <Banner desk={desk} />
      <Grant base={base} desk={desk} master={(ctx?.user || master?.user)?.role === 'master'} />
      <div className="actions" style={{ marginBottom: 14 }}>
        <Link className="btn ghost small" href={`${base}/ingest`} data-testid="ai-ingest-link">Each talk</Link>
      </div>
      <div className={styles.list}>
        {steps.map((step) => (
          <Link key={step.id} className={styles.row} href={`${base}/${step.slug}`} data-testid="ai-step" data-slug={str(step.slug)}>
            <span>
              <h2>{str(step.name)}</h2>
              <p data-testid="ai-step-line">{stepPlainLine(str(step.slug)) || str(step.description)}</p>
            </span>
            <span className={styles.meta}>
              {forkByStep.get(step.id) ? <span className={styles.mark}>{`Your v${str(forkByStep.get(step.id)?.number)}`}</span> : null}
              <span className={styles.mark} data-testid="ai-step-state">{stepListBadge({ inPipeline: Boolean(step.inPipeline), connected: desk.connected, master: desk.master })}</span>
            </span>
          </Link>
        ))}
      </div>
      {activity ? (
        <PortalActivity base={base} query={query} fresh={activity.fresh} hasAny={activity.hasAny} groups={activity.groups} portals={activity.portals} steps={activity.steps} />
      ) : null}
      {(ctx?.user || master?.user)?.role === 'master' ? (
        <details style={{ marginTop: 18 }}>
          <summary className={styles.quiet}>Who pays</summary>
          <p className={styles.quiet} data-testid="ai-env">A key in the server environment is ignored. A portal admin connects this portal’s own AI account in Settings. The master desk never sends a talk out.</p>
        </details>
      ) : null}
    </Frame>
  )
}

async function StepPage({ ctx, master, base, slug, desk }: { ctx: Ctx | null; master: { payload: Payload; user: SessionUser; query: Query } | null; base: string; slug: string; desk: Awaited<ReturnType<typeof loadDesk>> }) {
  const payload = ctx?.payload || master!.payload
  const query = queryOf(ctx, master)
  const step = (await rows(payload, 'ai-steps', { slug: { equals: slug } }, { limit: 1 }))[0]
  if (!step) return <Frame ctx={ctx} master={master} title="AI steps" intro="" testId="ai-missing"><p>That step is not in the registry. <Link href={base}>Back to the list</Link>.</p></Frame>
  const allVersions = await rows(payload, 'ai-step-versions', { step: { equals: step.id } }, { limit: 100, sort: 'number' })
  const portalId = ctx?.portal?.id || null
  const versions = allVersions.filter((version) => (desk.master || !portalId ? ref(version.portal) == null : ref(version.portal) === portalId))
  const portalLive = !desk.master && portalId ? allVersions.find((version) => ref(version.portal) === portalId && version.live) : null
  const promptValue = portalLive ? str(portalLive.prompt) : str(step.prompt)
  const lessons = await rows(payload, 'lessons', undefined, { limit: 80, sort: 'title' })
  const courses = await rows(payload, 'courses', undefined, { limit: 40, sort: 'title' })
  const from = versions.find((version) => String(version.number) === query.from) || versions[0]
  const to = versions.find((version) => String(version.number) === query.to) || versions[versions.length - 1]
  const diff = from && to ? diffLines(str(from.prompt), str(to.prompt)) : []
  const triedLesson = Number(query.tried)
  const attempt = triedLesson ? (await rows(payload, 'ai-step-outputs', { and: [{ stepSlug: { equals: slug } }, { lesson: { equals: triedLesson } }, { mode: { equals: 'try' } }] }, { limit: 1, sort: '-createdAt' }))[0] : null
  const compared = (attempt?.output || null) as { draft?: unknown; live?: unknown; draftProblems?: string[]; liveProblems?: string[] } | null
  const spec = stepBySlug(slug)
  const placeholders = (spec ? spec.placeholders : (step.placeholders as Placeholder[])) || []
  const fills = spec?.fills || str(step.fills)
  const order = spec?.pipelineOrder ?? Number(step.pipelineOrder || 0)
  const does = stepDoes(slug)
  const canEdit = desk.canEdit
  const here = `${base}/${slug}`
  return (
    <Frame ctx={ctx} master={master} title={str(step.name)} intro={stepPlainLine(slug) || str(step.description)} testId="ai-step-page">
      <Banner desk={desk} />
      <p style={{ marginTop: 0 }}><Link href={base}>‹ All steps</Link></p>
      <section className="panel" data-testid="ai-what">
        <header className="light"><h2>{STEP_PAGE_COPY.doesTitle}</h2></header>
        <div className="body">
          <ul className={styles.doesList}>
            {does.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <h3 style={{ fontSize: 14, margin: '14px 0 6px' }}>{STEP_PAGE_COPY.lands}</h3>
          <p className={styles.quiet} data-testid="ai-fills">{fills}</p>
        </div>
      </section>
      <details className={styles.techies} data-testid="ai-for-techies">
        <summary>{STEP_PAGE_COPY.techies}</summary>
        <div className={styles.layout}>
        <section className="panel">
          <header className="light"><h2>{STEP_PAGE_COPY.instructions} <HelpTip topic="ai-prompt">{TOOL.aiPrompt}</HelpTip></h2>{portalLive ? <span className={styles.mark}>{`Your portal’s version ${str(portalLive.number)}`}</span> : null}</header>
          <div className="body">
            {!desk.master && canEdit ? <p className={styles.quiet}>Saving this only changes the step for your portal. Other portals, and the HEARTS wording, stay as they are.</p> : null}
            {canEdit ? (
              <form action="/api/ai-steps" method="post" className="form" data-testid="ai-prompt-form">
                <Hidden fields={{ action: 'save-version', slug, next: here }} />
                <label className="stack">{STEP_PAGE_COPY.instructions}
                  <textarea name="prompt" rows={16} defaultValue={promptValue} data-testid="ai-prompt" />
                </label>
                <div className="actions">
                  <label className="stack">{STEP_PAGE_COPY.who}
                    <select name="provider" defaultValue={str(step.provider) || 'anthropic'} data-testid="ai-provider">
                      <option value="anthropic">Anthropic</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </label>
                  <label className="stack">{STEP_PAGE_COPY.helper}<input name="model" defaultValue={str(step.model)} data-testid="ai-model" /></label>
                  <label className="stack">{STEP_PAGE_COPY.stick}<input name="temperature" type="number" step="0.1" min="0" max="1" defaultValue={String(step.temperature ?? 0)} /></label>
                  <label className="stack">{STEP_PAGE_COPY.length}<input name="maxTokens" type="number" min="64" max="8000" defaultValue={String(step.maxTokens ?? 1200)} /></label>
                </div>
                <p className="hint">{STEP_PAGE_COPY.stickHint} {STEP_PAGE_COPY.runHint}</p>
                <label className="stack">Note for this version<input name="note" placeholder="What changed, and why" data-testid="ai-note" /></label>
                <button className="btn teal" type="submit" data-testid="ai-save">{desk.master ? 'Save as a new version' : 'Save for this portal'}</button>
              </form>
            ) : (
              <pre className={styles.schema} data-testid="ai-prompt-readonly">{promptValue}</pre>
            )}
            {!desk.master && portalLive && canEdit ? (
              <form action="/api/ai-steps" method="post" style={{ marginTop: 10 }}>
                <Hidden fields={{ action: 'use-hearts', slug, next: here }} />
                <button className="btn ghost small" type="submit" data-testid="ai-use-hearts">Use the HEARTS version</button>
              </form>
            ) : null}
          </div>
        </section>
        <div>
          <section className="panel">
            <header className="light"><h2>{STEP_PAGE_COPY.blanks}</h2></header>
            <div className="body">
              <p className={styles.quiet} data-testid="ai-order">{STEP_PAGE_COPY.order}: {order}. {STEP_PAGE_COPY.orderNote}</p>
              <ul className={styles.quiet} data-testid="ai-placeholders">
                {placeholders.length ? placeholders.map((item) => <li key={item.token}><code>{`{{${item.token}}}`}</code>{item.required ? '' : ' (optional)'} — {item.meaning}</li>) : <li>{STEP_PAGE_COPY.noBlanks}</li>}
              </ul>
              <h3 style={{ fontSize: 14, margin: '14px 0 6px' }}>{STEP_PAGE_COPY.shape}</h3>
              <pre className={styles.schema} data-testid="ai-schema">{pretty(step.outputSchema)}</pre>
            </div>
          </section>
        </div>
        </div>
      </details>

      <section className="panel" style={{ marginTop: 18 }} data-testid="ai-versions">
        <header className="light"><h2>Versions</h2></header>
        <div className="body">
          <table className={styles.versions}>
            <thead><tr><th>Version</th><th>Who</th><th>When</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id} data-testid="ai-version" data-number={version.number} data-live={version.live ? 'yes' : 'no'}>
                  <td>{version.live ? <b>v{str(version.number)}</b> : `v${str(version.number)}`}</td>
                  <td>{str(version.authorName) || '—'}{version.authorRole ? ` · ${roleWords(str(version.authorRole))}` : ''}</td>
                  <td>{when(version.createdAt)}</td>
                  <td>{str(version.note)}</td>
                  <td>
                    {canEdit && !version.live ? (
                      <span className="actions">
                        <form action="/api/ai-steps" method="post"><Hidden fields={{ action: 'mark-live', slug, version: str(version.number), next: here }} /><button className="btn small teal" type="submit" data-testid="ai-mark-live">Make live</button></form>
                        <form action="/api/ai-steps" method="post"><Hidden fields={{ action: 'rollback', slug, version: str(version.number), next: here }} /><button className="btn small ghost" type="submit" data-testid="ai-rollback">Roll back to this</button></form>
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {from && to ? (
            <form className="actions" method="get" style={{ marginTop: 14 }} data-testid="ai-diff-form">
              <label className="stack">From
                <select name="from" defaultValue={String(from.number)}>{versions.map((version) => <option key={version.id} value={String(version.number)}>v{str(version.number)}</option>)}</select>
              </label>
              <label className="stack">To
                <select name="to" defaultValue={String(to.number)}>{versions.map((version) => <option key={version.id} value={String(version.number)}>v{str(version.number)}</option>)}</select>
              </label>
              <button className="btn ghost small" type="submit">Show the diff</button>
            </form>
          ) : null}
          {from && to && String(from.number) !== String(to.number) ? (
            <div className={styles.diff} data-testid="ai-diff" data-from={from.number} data-to={to.number} style={{ marginTop: 12 }}>
              {diff.map((line, index) => <div key={index} className={line.kind === 'add' ? styles.add : line.kind === 'del' ? styles.del : undefined} data-kind={line.kind}>{line.kind === 'add' ? '+ ' : line.kind === 'del' ? '− ' : '  '}{line.text || ' '}</div>)}
            </div>
          ) : <p className="hint">Choose two different versions to see what changed.</p>}
        </div>
      </section>

      {canEdit ? (
        <section className="panel" style={{ marginTop: 18 }} data-testid="ai-try">
          <header className="light"><h2>Try it on one talk</h2></header>
          <div className="body">
            <p className="hint">Runs the draft below beside the live version. Nothing is written onto a clip, a question, or a learner’s page. Saving a version is separate, and does not make it live.</p>
            <form action="/api/ai-steps" method="post" className="form" data-testid="ai-try-draft">
              <Hidden fields={{ action: 'try', slug, next: here }} />
              <label className="stack">Talk
                <select name="lesson" data-testid="ai-try-lesson" defaultValue={String(triedLesson || lessons[0]?.id || '')}>
                  {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{partTitle(lesson)}</option>)}
                </select>
              </label>
              <label className="stack">Draft prompt
                <textarea name="prompt" rows={8} defaultValue={promptValue} data-testid="ai-try-prompt" />
              </label>
              <PortalAiConfirm connected={desk.connected} master={desk.master} calls={2} />
              <button className="btn ink" type="submit" data-testid="ai-try-submit">Compare with the live output</button>
            </form>
            {compared ? (
              <div className={styles.compare} style={{ marginTop: 14 }} data-testid="ai-try-compare" data-different={pretty(compared.draft) === pretty(compared.live) ? 'no' : 'yes'}>
                <div>
                  <b>This draft</b>
                  {compared.draftProblems?.length ? <p className="hint">{compared.draftProblems[0]}</p> : null}
                  <pre className={styles.schema} data-testid="try-draft">{pretty(compared.draft)}</pre>
                </div>
                <div>
                  <b>Live version</b>
                  {compared.liveProblems?.length ? <p className="hint">{compared.liveProblems[0]}</p> : null}
                  <pre className={styles.schema} data-testid="try-live">{pretty(compared.live)}</pre>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {canEdit && step.inPipeline ? (
        <section className="panel" style={{ marginTop: 18 }}>
          <header className="light"><h2>Re-run the live version</h2></header>
          <div className="body">
            <p className="hint">Drafts land on Review. Approved cuts and anything a person has edited stay as they are, with “new draft available” beside them.</p>
            <RerunForm base={base} slug={slug} lessons={lessons} courses={courses} connected={desk.connected} master={desk.master} />
          </div>
        </section>
      ) : null}
    </Frame>
  )
}

function RerunForm({ base, slug, lessons, courses, lessonId, connected, master, perTalk = 1 }: { base: string; slug: string; lessons: Doc[]; courses: Doc[]; lessonId?: number; connected: boolean; master: boolean; perTalk?: number }) {
  return (
    <form action="/api/ai-steps" method="post" className="form" data-testid="ai-rerun">
      <Hidden fields={{ action: 'start-job', slug, jobBase: base, next: base }} />
      <label className="stack">Scope
        <select name="scope" defaultValue={lessonId ? 'talk' : 'talk'} data-testid="ai-scope">
          <option value="talk">One talk</option>
          <option value="selection">A selection</option>
          <option value="course">A course</option>
          <option value="all">Everything</option>
        </select>
      </label>
      <label className="stack">Talk
        <select name="lesson" defaultValue={String(lessonId || lessons[0]?.id || '')} data-testid="ai-rerun-lesson">
          {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{partTitle(lesson)}</option>)}
        </select>
      </label>
      <label className="stack">More talks, if the scope is a selection
        <select name="lesson" multiple size={4} data-testid="ai-rerun-selection">
          {lessons.slice(0, 12).map((lesson) => <option key={lesson.id} value={lesson.id}>{partTitle(lesson)}</option>)}
        </select>
      </label>
      <label className="stack">Course
        <select name="course" data-testid="ai-rerun-course">
          <option value="">Choose a course</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{str(course.title)}</option>)}
        </select>
      </label>
      <PortalAiConfirm connected={connected} master={master} calls={null} perTalk={perTalk} />
      <button className="btn teal" type="submit" data-testid="ai-rerun-submit">Re-run</button>
    </form>
  )
}

async function JobPage({ ctx, master, base, id, desk }: { ctx: Ctx | null; master: { payload: Payload; user: SessionUser; query: Query } | null; base: string; id: number; desk: Awaited<ReturnType<typeof loadDesk>> }) {
  const payload = ctx?.payload || master!.payload
  const job = (await rows(payload, 'ai-step-jobs', { id: { equals: id } }, { limit: 1 }))[0]
  if (!job) return <Frame ctx={ctx} master={master} title="Re-run" intro="" testId="ai-job-missing"><p>That job was not found.</p></Frame>
  const results = (Array.isArray(job.results) ? job.results : []) as { id: number; ok: boolean; error?: string; detail?: { title?: string; steps?: { slug: string; ok: boolean; error?: string; disposition?: string }[] } }[]
  const running = job.status === 'queued' || job.status === 'running'
  return (
    <Frame ctx={ctx} master={master} title="Re-run" intro={`${str(job.note) || str(job.stepSlug)} · ${str(job.scope)}`} testId="ai-job">
      <JobPoll active={running} />
      <Banner desk={desk} />
      <p style={{ marginTop: 0 }}><Link href={base}>‹ AI steps</Link></p>
      <section className="panel" data-testid="ai-job-card" data-status={str(job.status)} data-finished={str(job.finished)} data-failed={str(job.failedCount)} data-total={str(job.total)}>
        <header className="light">
          <h2>{running ? 'Working through the talks' : job.status === 'failed' ? 'Stopped' : 'Finished'}</h2>
          <span className={styles.mark} data-tone={job.status === 'failed' ? 'rose' : running ? 'gold' : 'teal'} data-testid="ai-job-progress">{str(job.finished) || '0'} of {str(job.total) || '0'}{Number(job.failedCount) ? `, ${str(job.failedCount)} with an error` : ''}</span>
        </header>
        <div className="body">
          {str(job.error) ? <p className="hint">{str(job.error)}</p> : null}
          <ul className={styles.list} data-testid="ai-job-results">
            {results.map((result) => (
              <li key={result.id} data-testid="ai-job-row" data-ok={result.ok ? 'yes' : 'no'}>
                <b>{result.detail?.title || `Talk ${result.id}`}</b>
                {result.ok ? <span className="badge teal">Done</span> : <span className="badge rose">Error</span>}
                {result.error ? <p className="hint" data-testid="ai-job-error">{result.error}</p> : null}
                {result.detail?.steps?.length ? (
                  <p className="hint">{result.detail.steps.map((step) => `${step.slug}: ${step.ok ? step.disposition || 'done' : step.error || 'failed'}`).join(' · ')}</p>
                ) : null}
              </li>
            ))}
          </ul>
          {!results.length && running ? <p className="hint">Starting. The count updates on its own.</p> : null}
        </div>
      </section>
    </Frame>
  )
}

function stepStatus(step: Doc, outputs: Doc[], tier: Doc | null, points: Doc[], running: boolean) {
  if (running) return 'running'
  const latest = outputs.find((row) => row.mode === 'run')
  if (!latest) return 'not-run'
  if (latest.disposition === 'failed') return 'failed'
  if (latest.disposition === 'pending') return 'draft-ready'
  if (step.fillsTier && tier?.status === 'checked' && latest.disposition === 'applied') return 'approved'
  if (step.fillsPoints) {
    const mine = points.filter((point) => str(point.draftNote).startsWith(`AI draft from ${step.slug}`))
    if (mine.length && mine.every((point) => point.status === 'published')) return 'approved'
  }
  if (latest.disposition === 'applied' || latest.disposition === 'preview') return 'draft-ready'
  return 'not-run'
}

async function IngestPage({ ctx, master, base, lessonId, desk }: { ctx: Ctx | null; master: { payload: Payload; user: SessionUser; query: Query } | null; base: string; lessonId: number; desk: Awaited<ReturnType<typeof loadDesk>> }) {
  const payload = ctx?.payload || master!.payload
  const steps = (await rows(payload, 'ai-steps', undefined, { limit: 30, sort: 'pipelineOrder' })).filter((step) => step.inPipeline)
  const lessons = await rows(payload, 'lessons', undefined, { limit: 200, sort: 'title' })
  if (!lessonId) {
    return (
      <Frame ctx={ctx} master={master} title="Each talk" intro="One row per talk. Open it to see each job, then run it or send the draft to Review." testId="ai-ingest">
        <Banner desk={desk} />
        <p style={{ marginTop: 0 }}><Link href={base}>‹ AI steps</Link></p>
        <div className={styles.list}>
          {lessons.map((lesson) => (
            <Link key={lesson.id} className={styles.row} href={`${base}/ingest/${lesson.id}`} data-testid="ingest-talk">
              <span>
                <h2>{partTitle(lesson)}</h2>
                <p>{str(lesson.speaker)}{lesson.transcript || lesson.youtubeId ? '' : ' · no transcript yet'}</p>
              </span>
              <span className={styles.mark}>Open</span>
            </Link>
          ))}
        </div>
      </Frame>
    )
  }
  const lesson = lessons.find((row) => row.id === lessonId) || (await rows(payload, 'lessons', { id: { equals: lessonId } }, { limit: 1 }))[0]
  if (!lesson) return <Frame ctx={ctx} master={master} title="Each talk" intro="" testId="ai-ingest-missing"><p>That talk was not found.</p></Frame>
  const [outputs, tierRows, points, jobs] = await Promise.all([
    rows(payload, 'ai-step-outputs', { lesson: { equals: lesson.id } }, { limit: 200, sort: '-createdAt' }),
    rows(payload, 'talk-tiers', { lesson: { equals: lesson.id } }, { limit: 1 }),
    rows(payload, 'engagement-points', { lesson: { equals: lesson.id } }, { limit: 100 }),
    rows(payload, 'ai-step-jobs', { status: { in: ['queued', 'running'] } }, { limit: 20 }),
  ])
  const tier = tierRows[0] || null
  const courses = await rows(payload, 'courses', undefined, { limit: 40 })
  const pending = await pendingForLesson(payload, lesson.id)
  return (
    <Frame ctx={ctx} master={master} title={partTitle(lesson)} intro="Each job in the order it runs. A draft waits for a person. If one job fails, the error stays on this card and the rest of the talk is left alone." testId="ai-ingest-talk">
      <Banner desk={desk} />
      <p style={{ marginTop: 0 }}><Link href={`${base}/ingest`}>‹ All talks</Link></p>
      {pending.length ? <p className="hint" data-testid="new-draft-available">New draft available. Approved and hand-edited work on this talk was not overwritten.</p> : null}
      {desk.canEdit ? (
        <form action="/api/ai-steps" method="post" className="actions" style={{ marginBottom: 14 }}>
          <Hidden fields={{ action: 'start-job', slug: 'pipeline', scope: 'talk', lesson: lesson.id, jobBase: base, next: `${base}/ingest/${lesson.id}` }} />
          <PortalAiConfirm connected={desk.connected} master={desk.master} calls={steps.length} />
          <button className="btn ink" type="submit" data-testid="ai-run-pipeline">Run every job on this talk</button>
        </form>
      ) : null}
      <div className={styles.pipe}>
        {steps.map((step) => {
          const own = outputs.filter((row) => row.stepSlug === step.slug)
          const running = jobs.some((job) => {
            const ids = Array.isArray(job.lessonIds) ? (job.lessonIds as unknown[]).map(Number) : []
            return (job.stepSlug === step.slug || job.stepSlug === 'pipeline') && ids.includes(lesson.id)
          })
          const status = stepStatus(step, own, tier, points, running)
          const [label, tone] = STATUS_LABEL[status] || STATUS_LABEL['not-run']
          const latest = own[0]
          const reviewHref = step.fillsPoints ? '/master/review/popups' : '/master/review'
          return (
            <article key={step.id} data-testid="ingest-step" data-slug={str(step.slug)} data-status={status}>
              <span className={styles.mark} data-tone={tone} data-testid="ingest-status">{label}</span>
              <span>
                <b>{str(step.name)}</b>
                <div className={styles.note}>{stepBySlug(str(step.slug))?.fills || str(step.fills)}</div>
                {latest?.error ? <div className={styles.note} data-testid="ingest-error">{str(latest.error)}</div> : null}
                {latest?.disposition === 'pending' ? <div className={styles.note}>New draft available.</div> : null}
              </span>
              <span className="actions">
                {desk.canEdit ? (
                  <form action="/api/ai-steps" method="post">
                    <Hidden fields={{ action: 'start-job', slug: str(step.slug), scope: 'talk', lesson: lesson.id, jobBase: base, next: `${base}/ingest/${lesson.id}` }} />
                    <PortalAiConfirm connected={desk.connected} master={desk.master} calls={1} />
                    <button className="btn small ghost" type="submit" data-testid="ingest-run">{status === 'not-run' ? 'Run' : 'Re-run'}</button>
                  </form>
                ) : null}
                {!ctx ? <Link className="btn small ghost" href={step.fillsTier || step.fillsPoints ? reviewHref : `${base}/${step.slug}`} data-testid="ingest-review">Open review</Link> : <Link className="btn small ghost" href={`${base}/${step.slug}`}>Open the step</Link>}
              </span>
            </article>
          )
        })}
      </div>
      {desk.canEdit ? <div style={{ marginTop: 18 }}><RerunForm base={base} slug="pipeline" lessons={[lesson, ...lessons.filter((row) => row.id !== lesson.id)].slice(0, 40)} courses={courses} lessonId={lesson.id} connected={desk.connected} master={desk.master} perTalk={steps.length} /></div> : null}
      <p className="hint" style={{ marginTop: 8 }}>The form under the list runs every job on a wider set. This talk is already selected in it.</p>
    </Frame>
  )
}
