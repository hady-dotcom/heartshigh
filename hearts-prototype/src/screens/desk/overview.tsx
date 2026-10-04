import Link from 'next/link'
import type { ReactNode } from 'react'
import { Hidden } from '@/components/app/shell'
import { Qr } from '@/components/qr'
import { HelpTip } from '@/components/desk/help'
import { ShareLinks } from '@/components/desk/share-links'
import { TOOL } from '@/lib/desk-help'
import { now } from '@/lib/clock'
import { adoptedCourseIds } from '@/server/context'
import { portalName } from '@/server/learner'
import { type Ctx, portalPeople, rows, str } from '../common'
import { DeskFrame, portalNav } from './shell'
import { PORTAL_TIME_ZONES, portalTimeZone, zoneCity } from '@/lib/zone-time'

export async function AdminFrame({ ctx, active, title, intro, tools, children, testId, tone }: { ctx: Ctx; active: string; title: string; intro?: ReactNode; tools?: ReactNode; children: ReactNode; testId?: string; tone?: 'evening' }) {
  const { payload, user, portal, base, query } = ctx
  const extra = [{ label: 'Open the learner app', href: base }]
  if (user.role === 'master') extra.push({ label: 'Back to the master desk', href: '/master' })
  return (
    <DeskFrame
      payload={payload}
      user={user}
      title={title}
      intro={intro}
      active={active}
      nav={portalNav(base, user)}
      brand={portalName(portal)}
      subBrand={portal.closed ? 'Deactivated' : 'Portal desk'}
      deskName={`${portalName(portal)} portal desk`}
      brandHref={`${base}/admin`}
      extraLinks={extra}
      tools={tools}
      query={query}
      testId={testId}
      evening
      logoUrl={portal.logoUrl}
      gatherDesk={tone === 'evening'}
    >
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
    return { key, label: day.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' }), value: [...completions, ...answers].filter((row) => str(row.createdAt).slice(0, 10) === key).length }
  })
  const max = Math.max(1, ...bars.map((bar) => bar.value))
  const learners = people.filter((person) => person.role === 'learner').length
  const staff = people.length - learners

  return (
    <AdminFrame ctx={ctx} active="overview" title="Overview" intro="Your portal at a glance: who is here, what you have made, and how people are getting on." testId="admin-overview">
      {!portal.wizardDone && user.role !== 'teacher' ? <div className="flash notice">The short setup is not finished yet. <Link href={`${base}/admin/wizard`}>Finish it now</Link>.</div> : null}
      <section className="org-band">
        <div>
          <div className="lbl">Organisation name</div>
          <h2 data-testid="org-name">{portalName(portal)}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={`status${portal.closed ? ' off' : ''}`} data-testid="portal-status"><i />{portal.closed ? 'Deactivated' : 'Active'}</span>
          {user.role === 'master' ? (
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'deactivate', portalSlug: portal.slug, closed: portal.closed ? 'no' : 'yes', next: `${base}/admin` }} />
              <button className="btn line-light" data-testid="deactivate" type="submit">{portal.closed ? 'Activate' : 'Deactivate'}</button>
              <HelpTip topic="deactivate">{TOOL.deactivate}</HelpTip>
            </form>
          ) : null}
        </div>
      </section>
      <div className="grid over">
        <section className="panel">
          <header><div><h2>Portal settings</h2><p>Where people find you</p></div></header>
          <div className="body" style={{ display: 'grid', gap: 14 }}>
            <div>
              <div className="hint" style={{ marginBottom: 6 }}>Portal address</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div className="address" style={{ flex: 1, minWidth: 0 }} data-testid="portal-address" title={address.replace(/^https?:\/\//, '')}>{address.replace(/^https?:\/\//, '')}</div>
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
          <header><div><h2>Content</h2><p>Made in this portal. Courses linked from the library are counted separately.</p></div></header>
          <div className="body" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <div className="count-tile"><span>Course</span><b data-testid="own-courses">{local.length}</b></div>
            <div className="count-tile"><span>Topic</span><b data-testid="own-topics">{units.length}</b></div>
            <div className="count-tile"><span>Video</span><b data-testid="own-videos">{lessons.length}</b></div>
            <div className="count-tile"><span>Resource</span><b data-testid="own-resources">{resources.length}</b></div>
            <div className="count-tile" style={{ gridColumn: '1 / -1', background: '#fbefd2' }}><span>Linked from the library</span><b data-testid="linked-courses">{adopted.length}</b></div>
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
            <div className="chart-legend"><span>{bars[0].key}</span><span>{bars.reduce((sum, bar) => sum + bar.value, 0)} in total</span><span>{bars[13].key}</span></div>
          </div>
        </section>
      </div>
    </AdminFrame>
  )
}

export async function PortalSettingsScreen(ctx: Ctx) {
  const { portal, base } = ctx
  const field = (label: string, name: keyof typeof portal, extra: Record<string, string> = {}) => (
    <label className="row"><span>{label}</span><input type="text" name={name} defaultValue={str(portal[name])} {...extra} /></label>
  )
  return (
    <AdminFrame ctx={ctx} active="settings" title="Settings" intro="How the portal looks, what it is called, and the films people see when they first arrive." testId="admin-settings">
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)' }}>
        <section className="panel">
          <header className="light"><h2>Portal details</h2></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'settings', settingsForm: 'yes', portalSlug: portal.slug, next: `${base}/admin/settings` }} />
            {field('Organisation name', 'organisationName', { 'data-testid': 'org-name-input' })}
            <label className="row top"><span>Welcome line</span><textarea name="welcome" defaultValue={str(portal.welcome)} /></label>
            {field('Logo link', 'logoUrl', { placeholder: 'https://' })}
            {field('Linked calendar', 'calendarUrl', { placeholder: 'https://' })}
            {field('Notification emails', 'notificationEmails')}
            <label className="row"><span>Colour</span><input type="text" name="colour" defaultValue={portal.colour || '#1f1d36'} /></label>
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