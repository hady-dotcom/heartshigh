import Link from 'next/link'
import type { ReactNode } from 'react'
import { ExampleInUse } from '@/components/app/care'
import { Hidden } from '@/components/app/shell'
import { Qr } from '@/components/qr'
import { HelpTip } from '@/components/desk/help'
import { ShareLinks } from '@/components/desk/share-links'
import { TOOL } from '@/lib/desk-help'
import { now } from '@/lib/clock'
import { adoptedCourseIds } from '@/server/context'
import { portalName } from '@/server/learner'
import { withDemoQuery } from '@/lib/parenting-demo'
import { DemoFrameTools } from '@/components/demo/frame-tools'
import { type Ctx, clock, portalPeople, rows, str } from '../common'
import { sharedAnswerText } from '@/lib/shared-answers'
import { markTeachVisit, newSharedAnswers, seenFor } from '@/server/teach-seen'
import { DeskFrame, portalNav, type NavGroup } from './shell'
import { PORTAL_TIME_ZONES, portalTimeZone, zoneCity } from '@/lib/zone-time'
import { humanDate } from '@/lib/human-date'
import { ConfirmDeactivate } from '@/components/desk/confirm-deactivate'
import { mcpConnectorStatus, publicAi } from '@/lib/portal-ai'
import { SCENE_PRESETS, courseHomeOf, sceneUrlOf } from '@/lib/portal-look'

function withAnswerBadge(groups: NavGroup[], count: number, href?: string | null): NavGroup[] {
  if (count <= 0) return groups
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => (item.key === 'teach' ? { ...item, badge: count, href: href || item.href } : item)),
  }))
}

export async function AdminFrame({ ctx, active, title, intro, tools, help, children, testId, tone, showOnPhone, primary }: { ctx: Ctx; active: string; title: string; intro?: ReactNode; tools?: ReactNode; help?: ReactNode; children: ReactNode; testId?: string; tone?: 'evening'; showOnPhone?: boolean; primary?: { label: string; href: string } }) {
  const { payload, user, portal, base, query } = ctx
  const demo = ctx.demo
  const seenAt = demo ? null : active === 'teach' ? await markTeachVisit(payload, user, portal.id) : seenFor(user, portal.id)
  const fresh = demo ? { total: 0, docs: [] as { id: number }[] } : await newSharedAnswers(payload, portal.id, seenAt, 1)
  const freshAnswers = fresh.total
  const newestHref = fresh.docs[0] ? `${base}/admin/answers/${fresh.docs[0].id}` : null
  const stamp = (href: string) => (demo ? withDemoQuery(href, demo.token, demo.role) : href)
  const extra = [{ label: 'See what a learner sees', href: stamp(base) }]
  if (user.role === 'master' && !demo) extra.push({ label: 'Back to master desk', href: '/master' })
  const nav = withAnswerBadge(portalNav(base, user, portal), freshAnswers, newestHref).map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item, href: stamp(item.href) })),
  }))
  const brand = demo ? demo.cast.portalName : portalName(portal)
  return (
    <DeskFrame
      payload={payload}
      user={user}
      title={title}
      intro={intro}
      active={active}
      nav={nav}
      brand={brand}
      subBrand={portal.closed ? 'Deactivated' : demo ? (user.role === 'teacher' ? 'Teacher' : 'Portal admin') : 'Portal desk'}
      deskName={`${brand} portal desk`}
      brandHref={stamp(`${base}/admin`)}
      extraLinks={extra}
      tools={
        <>
          <Link className="btn ghost small" href={stamp(base)} data-testid="see-as-learner">See what a learner sees</Link>
          {user.role === 'master' && !demo ? <Link className="btn ghost small" href="/master" data-testid="back-master">Back to master desk</Link> : null}
          {tools}
        </>
      }
      help={help}
      query={query}
      testId={testId}
      primary={primary}
      evening
      showOnPhone={showOnPhone}
      logoUrl={portal.logoUrl}
      gatherDesk={tone === 'evening'}
    >
      {demo ? <DemoFrameTools token={demo.token} role={demo.role} cast={demo.cast} seq={demo.state.seq} /> : null}
      {portal.closed ? <div className="flash error" data-testid="portal-closed">This portal is deactivated. Learners cannot sign in until the master desk opens it again.</div> : null}
      {children}
    </DeskFrame>
  )
}

export async function OverviewScreen(ctx: Ctx) {
  const { payload, user, portal, base, origin } = ctx
  const address = `${origin}${base}`
  const local = await rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }] })
  const localIds = local.map((row) => row.id)
  const [units, lessons, codes, people, adopted] = await Promise.all([
    localIds.length ? rows(payload, 'units', { course: { in: localIds } }) : Promise.resolve([]),
    localIds.length ? rows(payload, 'lessons', { course: { in: localIds } }) : Promise.resolve([]),
    rows(payload, 'access-codes', { portal: { equals: portal.id } }),
    portalPeople(payload, portal.id),
    adoptedCourseIds(payload, portal.id),
  ])
  const resources = lessons.length ? await rows(payload, 'resources', { lesson: { in: lessons.map((row) => row.id) } }) : []
  const countRole = (role: string) => codes.filter((code) => code.role === role).length
  const today = now()
  const days = Array.from({ length: 14 }, (_, index) => new Date(today.getTime() - (13 - index) * 86_400_000))
  const since = days[0].toISOString().slice(0, 10)
  const [completions, answers] = await Promise.all([
    rows(payload, 'completions', { and: [{ portal: { equals: portal.id } }, { createdAt: { greater_than_equal: `${since}T00:00:00.000Z` } }] }, { limit: 2000 }),
    rows(payload, 'answers', { and: [{ portal: { equals: portal.id } }, { createdAt: { greater_than_equal: `${since}T00:00:00.000Z` } }] }, { limit: 2000 }),
  ])
  const bars = days.map((day) => {
    const key = day.toISOString().slice(0, 10)
    return { key, label: humanDate(key), value: [...completions, ...answers].filter((row) => str(row.createdAt).slice(0, 10) === key).length }
  })
  const max = Math.max(1, ...bars.map((bar) => bar.value))
  const learners = people.filter((person) => person.role === 'learner').length
  const staff = people.length - learners
  const fresh = await newSharedAnswers(payload, portal.id, seenFor(user, portal.id), 8)

  return (
    <AdminFrame ctx={ctx} active="overview" title="Overview" intro="Your portal at a glance: who is here, what you have made, and how people are getting on." testId="admin-overview">
      <section className="panel" data-testid="new-answers" style={{ marginBottom: 18 }}>
        <header><div><h2>New answers</h2><p>Shared with you since you last opened Learners. Private answers are not listed. Open one to land on that answer.</p></div></header>
        <div className="body" style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <b data-testid="new-answers-count" style={{ fontSize: 28 }}>{fresh.total}</b>
            <Link className="btn ink" href={fresh.docs[0] ? `${base}/admin/answers/${fresh.docs[0].id}` : `${base}/admin/teach`}>Open Learners</Link>
          </div>
          {fresh.docs.map((answer) => {
            const prompt = (answer.point as { prompt?: string; second?: number } | null)?.prompt
            const second = Number(answer.atSecond ?? (answer.point as { second?: number } | null)?.second ?? 0)
            const talk = str((answer.lesson as { title?: string } | null)?.title)
            return (
              <Link key={answer.id} className="lib-card" href={`${base}/admin/answers/${answer.id}`} data-testid="new-answer-link">
                <b>{(answer.user as { name?: string } | null)?.name || 'A learner'}</b>
                <p className="hint" style={{ margin: '4px 0' }} data-testid="new-answer-place">{talk || 'This talk'} · {clock(second)}</p>
                {prompt ? <p className="hint" style={{ margin: '0 0 4px' }}>{prompt}</p> : null}
                <p style={{ margin: 0 }}>{sharedAnswerText(answer)}</p>
              </Link>
            )
          })}
          {!fresh.total ? <ExampleInUse desk title="A new answer" action={{ href: `${ctx.base}/admin/teach`, label: 'Open learners' }}><p>Maryam shared one line from this morning’s talk.</p></ExampleInUse> : null}
        </div>
      </section>
      {!portal.wizardDone && user.role !== 'teacher' ? <div className="flash notice">The short setup is not finished yet. <Link href={`${base}/admin/wizard`}>Finish it now</Link>.</div> : null}
      <section className="org-band">
        <div>
          <div className="lbl">Organisation name</div>
          <h2 data-testid="org-name">{portalName(portal)}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={`status${portal.closed ? ' off' : ''}`} data-testid="portal-status"><i />{portal.closed ? 'Deactivated' : 'Active'}</span>
        </div>
      </section>
      <div className="grid over">
        <section className="panel">
          <header><div><h2>Portal settings</h2><p>Where people find you</p></div></header>
          <div className="body" style={{ display: 'grid', gap: 14 }}>
            <div>
              <div className="hint" style={{ marginBottom: 6 }}>Portal address</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div className="address address-full" data-testid="portal-address">{address}</div>
                <Link className="btn ink" href={base}>Go</Link>
                <ShareLinks value={address} testId="portal-copy" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'center' }}>
              <Qr value={address} testId="portal-qr" />
              <div style={{ display: 'grid', gap: 10 }}>
                {portal.logoUrl ? <img alt={`${portalName(portal)} logo`} src={portal.logoUrl} style={{ maxHeight: 56, maxWidth: 160, objectFit: 'contain' }} data-testid="portal-logo" /> : <span className="hint">No logo yet. Add one in settings.</span>}
                <a className="btn ghost small" data-testid="share-email" href={`mailto:?subject=${encodeURIComponent(portalName(portal))}&body=${encodeURIComponent(address)}`}>E-mail the address</a>
              </div>
            </div>
          </div>
          {user.role !== 'teacher' ? <div className="foot"><Link className="btn" href={`${base}/admin/settings`}>Portal settings</Link></div> : null}
        </section>
        <section className="panel">
          <header><div><h2>Active user accounts</h2><p>Everyone who has joined with a code</p></div></header>
          <div className="body" style={{ display: 'grid', gap: 10 }}>
            <div className="big-number" data-testid="active-users">{people.length}</div>
            <div className="count-tile"><span>Learners</span><b>{learners}</b></div>
            <div className="count-tile"><span>Teachers and admins</span><b>{staff}</b></div>
          </div>
          <div className="foot"><Link className="btn ghost" href={`${base}/admin/teach`}>See learners</Link></div>
        </section>
        <section className="panel" data-testid="code-counts">
          <header><div><h2>Access</h2><p>Codes that open this portal</p></div></header>
          <div className="body" style={{ display: 'grid', gap: 10 }}>
            <div className="count-tile"><span>Admin code</span><b data-testid="count-admin">{countRole('admin')}</b></div>
            <div className="count-tile"><span>Teacher code</span><b data-testid="count-teacher">{countRole('teacher')}</b></div>
            <div className="count-tile"><span>Learner code</span><b data-testid="count-learner">{countRole('learner')}</b></div>
            <div className="count-tile"><span>Parent code</span><b data-testid="count-parent">{countRole('parent')}</b></div>
          </div>
          {user.role !== 'teacher' ? <div className="foot"><Link className="btn" href={`${base}/admin/access`}>Access settings</Link></div> : null}
        </section>
      </div>
      <div className="grid two" style={{ marginTop: 18 }}>
        <section className="panel" data-testid="own-content">
          <header><div><h2>Content</h2><p>Courses you made here, plus courses linked from the library.</p></div></header>
          <div className="body" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <div className="count-tile"><span>Course</span><b data-testid="own-courses">{local.length + adopted.length}</b></div>
            <div className="count-tile"><span>Topic</span><b data-testid="own-topics">{units.length}</b></div>
            <div className="count-tile"><span>Video</span><b data-testid="own-videos">{lessons.length}</b></div>
            <div className="count-tile"><span>Resource</span><b data-testid="own-resources">{resources.length}</b></div>
            <div className="count-tile" style={{ gridColumn: '1 / -1' }}><span>Linked from the library</span><b data-testid="linked-courses">{adopted.length}</b></div>
          </div>
          {user.role !== 'teacher' ? <div className="foot"><Link className="btn" href={`${base}/admin/content`}>Content settings</Link></div> : null}
        </section>
        <section className="panel">
          <header><div><h2>Activity over 14 days <HelpTip topic="activity">{TOOL.activity}</HelpTip></h2><p>Parts watched and questions answered each day</p></div></header>
          <div className="body">
            <div className="chart" data-testid="activity">
              {bars.map((bar) => (
                <div className="col" key={bar.key} title={`${bar.key}: ${bar.value}`}>
                  <div className="slot" data-testid="chart-slot" data-value={bar.value}><i style={{ height: `${(bar.value / max) * 100}%` }} /></div>
                  <small>{bar.label}</small>
                </div>
              ))}
            </div>
            <div className="chart-legend"><span>{humanDate(bars[0].key)}</span><span>{bars.reduce((sum, bar) => sum + bar.value, 0)} in total</span><span>{humanDate(bars[13].key)}</span></div>
          </div>
        </section>
      </div>
    </AdminFrame>
  )
}

export async function PortalSettingsScreen(ctx: Ctx) {
  const { portal, base, user } = ctx
  const ai = publicAi(portal.aiConnection)
  const field = (label: string, name: keyof typeof portal, extra: Record<string, string> = {}) => (
    <label className="row"><span>{label}</span><input type="text" name={name} defaultValue={str(portal[name])} {...extra} /></label>
  )
  return (
    <AdminFrame ctx={ctx} active="settings" title="Settings" intro="How the portal looks, what it is called, and the films people see when they first arrive." testId="admin-settings">
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)' }}>
        <section className="panel">
          <header className="light"><h2>Portal details</h2></header>
          <form className="body form" action="/api/hearts" method="post" encType="multipart/form-data">
            <Hidden fields={{ action: 'settings', settingsForm: 'yes', portalSlug: portal.slug, next: `${base}/admin/settings` }} />
            {field('Organisation name', 'organisationName', { 'data-testid': 'org-name-input' })}
            <label className="row"><span>Name people see</span><input type="text" name="brandName" defaultValue={str(portal.brandName)} data-testid="brand-name" placeholder="Hady Home" /></label>
            <label className="row top"><span>Welcome line</span><textarea name="welcome" defaultValue={str(portal.welcome)} /></label>
            {field('Logo', 'logoUrl', { placeholder: '/icons/hady-home.svg or https://', 'data-testid': 'logo-url' })}
            {field('Linked calendar', 'calendarUrl', { placeholder: 'https://' })}
            {field('Notification emails', 'notificationEmails')}
            <label className="row"><span>Colour</span><input type="text" name="colour" defaultValue={portal.colour || '#1f1d36'} data-testid="portal-colour" /></label>
            <label className="row"><span>Accent</span><input type="text" name="accent" defaultValue={str(portal.accent)} data-testid="accent-colour" placeholder="#e07a5f" /></label>
            <label className="row"><span>Time zone <HelpTip topic="time-zone">{TOOL.timeZone}</HelpTip></span>
              <select name="timeZone" defaultValue={portalTimeZone(portal)} data-testid="time-zone">
                {[...new Set([portalTimeZone(portal), ...PORTAL_TIME_ZONES])].map((zone) => <option key={zone} value={zone}>{zoneCity(zone)} ({zone})</option>)}
              </select>
            </label>
            <label className="row"><span>Theme</span>
              <select name="theme" defaultValue={portal.theme || 'light'}><option value="light">Light</option><option value="dark">Dark</option></select>
            </label>
            {field('What learners are called', 'learnerLabel')}
            {field('What teachers are called', 'teacherLabel')}
            {field('Learner welcome film', 'learnerWelcomeUrl', { 'data-testid': 'learner-welcome', placeholder: 'https://www.youtube.com/watch?v=' })}
            {field('Learner introduction film', 'learnerIntroUrl', { 'data-testid': 'learner-intro' })}
            {field('Teacher welcome film', 'teacherWelcomeUrl', { 'data-testid': 'teacher-welcome' })}
            {field('Teacher introduction film', 'teacherIntroUrl', { 'data-testid': 'teacher-intro' })}
            <div className="row top"><span>Sharing</span>
              <div className="checks" style={{ flexDirection: 'column' }}>
                <label className="check"><input type="checkbox" name="showOthersAnswers" defaultChecked={portal.showOthersAnswers !== false} /> Learners can see answers others chose to share</label>
                <label className="check"><input type="checkbox" name="watchHistoryOptIn" defaultChecked={Boolean(portal.watchHistoryOptIn)} /> Ask learners if they will share detailed watch history</label>
                <HelpTip topic="watch-history">{TOOL.watchHistory}</HelpTip>
              </div>
            </div>
            <label className="row"><span>Course home layout</span>
              <select name="courseHome" defaultValue={courseHomeOf(portal)} data-testid="course-home">
                <option value="cards">Course cards</option>
                <option value="garden">Garden</option>
              </select>
            </label>
            <div className="row top"><span>Background scene</span>
              <div className="scene-pick" data-testid="scene-picker">
                {SCENE_PRESETS.map((scene) => (
                  <label key={scene.key} data-testid={`scene-${scene.key}`}>
                    <input type="radio" name="sceneKey" value={scene.key} defaultChecked={(portal.sceneKey || 'plain') === scene.key} />
                    {scene.url ? <img src={scene.url} alt="" /> : <span className="scene-swatch" />}
                    <small>{scene.kind}</small>
                    <b>{scene.label}</b>
                  </label>
                ))}
                <label data-testid="scene-upload">
                  <input type="radio" name="sceneKey" value="upload" defaultChecked={portal.sceneKey === 'upload'} />
                  <span className="scene-swatch" />
                  <small>Your picture</small>
                  <b>Upload my own</b>
                </label>
              </div>
            </div>
            <label className="row"><span>Scene picture</span><input type="file" name="sceneFile" accept="image/jpeg,image/png,image/webp" data-testid="scene-file" /></label>
            <label className="row"><span>Or a picture link</span><input type="url" name="sceneUrl" defaultValue={portal.sceneKey === 'upload' ? sceneUrlOf(portal) : ''} placeholder="https://" data-testid="scene-url" /></label>
            <label className="row top"><span>Welcome note</span><textarea name="supportNote" defaultValue={str(portal.supportNote)} data-testid="support-note" placeholder="Leave blank to hide" /></label>
            <label className="row"><span>Welcome mark</span>
              <select name="markKind" defaultValue={portal.markKind === 'hearts' ? 'hearts' : 'plain'} data-testid="mark-kind">
                <option value="plain">Plain</option>
                <option value="hearts">HEARTS arch</option>
              </select>
            </label>
            <div className="actions"><button className="btn ink" data-testid="save-settings" type="submit">Save settings</button></div>
          </form>
        </section>
        <section className="panel">
          <header className="light"><h2>Put the portal on your website</h2></header>
          <div className="body" style={{ display: 'grid', gap: 10 }}>
            <p className="hint">Paste this where you would like a button that opens the portal.</p>
            <p className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Embed <HelpTip topic="embed">{TOOL.embed}</HelpTip></p>
            <pre className="address" data-testid="embed" style={{ whiteSpace: 'pre-wrap' }}>{`<a href="${ctx.origin}${base}" style="background:${portal.colour || '#1f1d36'};color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">${portalName(portal)}</a>`}</pre>
            <Link className="btn ghost" href={`${base}/admin/wizard`}>Run the short setup again</Link>
          </div>
        </section>
        {user.role === 'master' ? (
          <section className="panel" data-testid="danger-zone" style={{ gridColumn: '1 / -1' }}>
            <header className="light"><h2>Danger zone</h2></header>
            <div className="body" style={{ display: 'grid', gap: 10 }}>
              <p>Deactivate stops learners signing in. Their work stays here. You will be asked to confirm.</p>
              <ConfirmDeactivate closed={Boolean(portal.closed)} portalSlug={portal.slug} next={`${base}/admin/settings`} />
              <HelpTip topic="deactivate">{TOOL.deactivate}</HelpTip>
            </div>
          </section>
        ) : null}
        {user.role === 'portal-admin' ? (
          <section className="panel" data-testid="portal-ai-settings" style={{ gridColumn: '1 / -1' }}>
            <header className="light"><h2>This portal’s AI account <HelpTip topic="portal-ai">{TOOL.portalAi}</HelpTip></h2></header>
            <form className="body form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'ai-connect', portalSlug: portal.slug, next: `${base}/admin/settings` }} />
              <p className="hint">Connect your own provider. HEARTS never pays for a run, and a key in the server environment is ignored. Only a portal admin can start a run. The master desk has no spend path.</p>
              <p className="hint" data-testid="mcp-seam">{mcpConnectorStatus().note}</p>
              {ai.connected ? <p className="hint" data-testid="portal-ai-connected">Connected to {ai.baseUrl} as {ai.model}. Key ending {ai.keyHint}. Leave the key blank to keep it.</p> : <p className="hint" data-testid="portal-ai-missing">No account is connected. Desk tools that can use one stay on the built-in path.</p>}
              <label className="row"><span>Address</span><input type="url" name="baseUrl" defaultValue={ai.baseUrl} placeholder="https://api.example.com/v1" data-testid="portal-ai-url" required={!ai.connected} /></label>
              <label className="row"><span>Model</span><input type="text" name="model" defaultValue={ai.model || 'gpt-4o-mini'} data-testid="portal-ai-model" /></label>
              <label className="row"><span>API key</span><input type="password" name="apiKey" autoComplete="off" placeholder={ai.connected ? 'Leave blank to keep the saved key' : 'Your own key'} data-testid="portal-ai-key" /></label>
              <div className="actions">
                <button className="btn ink" type="submit" data-testid="portal-ai-save">Save AI account</button>
                {ai.connected ? <button className="btn ghost" type="submit" name="clear" value="yes" data-testid="portal-ai-clear">Disconnect</button> : null}
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </AdminFrame>
  )
}

export async function WizardScreen(ctx: Ctx) {
  const { portal, base, query } = ctx
  const step = query.step || '1'
  return (
    <AdminFrame ctx={ctx} active="settings" title={`Set up ${portalName(portal)}`} intro={`Step ${step} of 3`} testId="wizard">
      <section className="panel" style={{ maxWidth: 720 }}>
        <div className="body">
          {step === '1' ? (
            <form className="form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'settings', portalSlug: portal.slug, organisationName: portalName(portal), next: `${base}/admin/wizard?step=2` }} />
              <label className="stack">A line of welcome for people arriving<textarea data-testid="wizard-welcome" name="welcome" defaultValue={str(portal.welcome)} /></label>
              <div className="actions"><button className="btn ink" type="submit">Next</button></div>
            </form>
          ) : null}
          {step === '2' ? (
            <form className="form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'create-course', origin: 'local', portalSlug: portal.slug, duration: 8, next: `${base}/admin/wizard?step=3` }} />
              <label className="stack">The name of your first course<input type="text" data-testid="wizard-course" name="title" required /></label>
              <div className="actions"><Link className="btn ghost" href={`${base}/admin/wizard?step=3`}>Skip</Link><button className="btn ink" type="submit">Next</button></div>
            </form>
          ) : null}
          {step === '3' ? (
            <form className="form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'settings', portalSlug: portal.slug, wizardDone: 'on', next: `${base}/admin` }} />
              <p>The portal is ready. When you are, make an access code and send the link to the people you would like to invite.</p>
              <div className="actions"><button className="btn ink" data-testid="wizard-finish" type="submit">Finish</button></div>
            </form>
          ) : null}
        </div>
      </section>
    </AdminFrame>
  )
}