import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Payload } from 'payload'
import { BrandMark } from '@/components/brand'
import { DeskFade } from '@/components/app/route-fade'
import { Flash, Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { SideNav } from '@/components/desk/side-nav'
import { pageHelp } from '@/lib/desk-help'
import { deskAppHref } from '@/lib/landing'
import { BellIcon, BeakerIcon, BinIcon, BookIcon, CalendarIcon, ChartIcon, ClapperIcon, CogIcon, CompassIcon, FilmIcon, FlagIcon, FrameIcon, GlobeIcon, HeartIcon, HomeIcon, KeyIcon, LibraryIcon, MicIcon, MoonIcon, NetworkIcon, PathIcon, PeopleIcon, QuestionIcon, ScaleIcon, SheetIcon, SparkIcon } from '@/components/icons'
import type { SessionUser } from '@/server/context'
import { deskLead, type DeskPrimary } from '@/lib/desk-lead'
import { JOURNAL_LABEL } from '@/lib/journal-copy'
import { deskNavAllowed, type FeatureSource } from '@/lib/features'
import { rows, shortDate, str } from '../common'
import { DeskNav } from './desk-nav'

type NavItem = { key: string; label: string; href: string; icon: ReactNode; badge?: number }
export type NavGroup = { group: string; description?: string; items: NavItem[] }

export function portalNav(base: string, user: SessionUser, portal?: FeatureSource & { shape?: string | null }): NavGroup[] {
  if (portal?.shape === 'sequence') {
    const films = { key: 'sequence', label: 'Course films', href: `${base}/admin/sequence`, icon: <FilmIcon /> }
    if (user.role === 'teacher') {
      return [{ group: 'Course', description: 'The films, in order.', items: [{ key: 'overview', label: 'Overview', href: `${base}/admin`, icon: <HomeIcon /> }, films, { key: 'teach', label: 'Learners', href: `${base}/admin/teach`, icon: <PeopleIcon /> }] }]
    }
    return [{
      group: 'Course',
      description: 'Films in order, people, and how the portal looks.',
      items: [
        { key: 'overview', label: 'Overview', href: `${base}/admin`, icon: <HomeIcon /> },
        films,
        { key: 'features', label: 'Features', href: `${base}/admin/features`, icon: <SparkIcon /> },
        { key: 'teach', label: 'Learners', href: `${base}/admin/teach`, icon: <PeopleIcon /> },
        { key: 'bring-in', label: 'Bring in', href: `${base}/admin/bring-in`, icon: <ClapperIcon /> },
        { key: 'opening', label: 'Opening questions', href: `${base}/admin/opening`, icon: <FrameIcon /> },
        { key: 'access', label: 'Codes', href: `${base}/admin/access`, icon: <KeyIcon /> },
        { key: 'settings', label: 'Settings', href: `${base}/admin/settings`, icon: <CogIcon /> },
        { key: 'bin', label: 'Bin', href: `${base}/admin/bin`, icon: <BinIcon /> },
      ],
    }]
  }
  const keep = (items: NavItem[]) => items.filter((item) => deskNavAllowed(portal, item.key))
  const teach: NavItem[] = keep([
    { key: 'teach', label: 'Learners', href: `${base}/admin/teach`, icon: <PeopleIcon /> },
    { key: 'diaries', label: JOURNAL_LABEL.many, href: `${base}/admin/diaries`, icon: <BookIcon /> },
    { key: 'feedback', label: 'Feedback', href: `${base}/admin/feedback`, icon: <QuestionIcon /> },
    { key: 'compass', label: 'Compass', href: `${base}/admin/compass`, icon: <HeartIcon /> },
    { key: 'plans', label: 'Study plans', href: `${base}/admin/plans`, icon: <CalendarIcon /> },
    { key: 'gather', label: 'Gatherings', href: `${base}/admin/gather`, icon: <PeopleIcon /> },
    { key: 'nights', label: 'Live in person', href: `${base}/admin/nights`, icon: <MoonIcon /> },
    { key: 'live', label: 'Live recordings', href: `${base}/admin/live`, icon: <MicIcon /> },
    { key: 'safety', label: 'Care and safety', href: `${base}/admin/safety`, icon: <HeartIcon /> },
    { key: 'announcements', label: 'Announcements', href: `${base}/admin/announcements`, icon: <BellIcon /> },
  ])
  if (user.role === 'teacher') {
    return [{ group: 'Teaching', description: 'People, gatherings and live sessions in your portal.', items: [{ key: 'overview', label: 'Overview', href: `${base}/admin`, icon: <HomeIcon /> }, { key: 'content', label: 'Questions in talks', href: `${base}/admin/content`, icon: <QuestionIcon /> }, ...teach] }]
  }
  return [
    {
      group: 'People',
      description: 'Who is here, and notes they will see.',
      items: keep([
        { key: 'overview', label: 'Overview', href: `${base}/admin`, icon: <HomeIcon /> },
        { key: 'teach', label: 'Learners', href: `${base}/admin/teach`, icon: <PeopleIcon /> },
        { key: 'diaries', label: JOURNAL_LABEL.many, href: `${base}/admin/diaries`, icon: <BookIcon /> },
        { key: 'access', label: 'Codes', href: `${base}/admin/access`, icon: <KeyIcon /> },
        { key: 'feedback', label: 'Feedback', href: `${base}/admin/feedback`, icon: <QuestionIcon /> },
        { key: 'safety', label: 'Care and safety', href: `${base}/admin/safety`, icon: <HeartIcon /> },
        { key: 'announcements', label: 'Announcements', href: `${base}/admin/announcements`, icon: <BellIcon /> },
        { key: 'bin', label: 'Bin', href: `${base}/admin/bin`, icon: <BinIcon /> },
      ]),
    },
    {
      group: 'Teaching',
      description: 'Courses, study plans, gatherings, live video, and Scenes and Lanes.',
      items: keep([
        { key: 'library', label: 'Library', href: `${base}/admin/library`, icon: <LibraryIcon /> },
        { key: 'content', label: 'Content', href: `${base}/admin/content`, icon: <BookIcon /> },
        { key: 'bring-in', label: 'Bring in', href: `${base}/admin/bring-in`, icon: <ClapperIcon /> },
        { key: 'plans', label: 'Study plans', href: `${base}/admin/plans`, icon: <CalendarIcon /> },
        { key: 'gather', label: 'Gatherings', href: `${base}/admin/gather`, icon: <PeopleIcon /> },
        { key: 'nights', label: 'Live in person', href: `${base}/admin/nights`, icon: <MoonIcon /> },
        { key: 'live', label: 'Live recordings', href: `${base}/admin/live`, icon: <MicIcon /> },
        { key: 'circle', label: 'Circle answers', href: `${base}/admin/circle`, icon: <PeopleIcon /> },
        { key: 'missions', label: 'Missions', href: `${base}/admin/missions`, icon: <FlagIcon /> },
      ]),
    },
    {
      group: 'Look closer',
      description: 'Insights, Compass, the calendar, and how the words are set up.',
      items: keep([
        { key: 'insights', label: 'Insights', href: `${base}/admin/insights`, icon: <ChartIcon /> },
        { key: 'compass', label: 'Compass', href: `${base}/admin/compass`, icon: <CompassIcon /> },
        { key: 'experiments', label: 'Experiments', href: `${base}/admin/experiments`, icon: <BeakerIcon /> },
        { key: 'calendar', label: 'Event Calendar', href: `${base}/admin/calendar`, icon: <CalendarIcon /> },
        { key: 'ai', label: 'AI steps', href: `${base}/admin/ai`, icon: <CogIcon /> },
        { key: 'opening', label: 'Opening questions', href: `${base}/admin/opening`, icon: <FrameIcon /> },
        { key: 'questions', label: 'Joining questions', href: `${base}/admin/questions`, icon: <QuestionIcon /> },
        { key: 'sheet', label: 'Master sheet', href: `${base}/admin/sheet`, icon: <SheetIcon /> },
        { key: 'create', label: 'Sheet creator', href: `${base}/admin/sheet/create`, icon: <BookIcon /> },
        { key: 'settings', label: 'Settings', href: `${base}/admin/settings`, icon: <CogIcon /> },
      ]),
    },
  ]
}

export function masterNav(): NavGroup[] {
  return [
    {
      group: 'People',
      description: 'Portals, the people in them, and notes they will see.',
      items: [
        { key: 'portals', label: 'Portals', href: '/master', icon: <GlobeIcon /> },
        { key: 'learners', label: 'Learners', href: '/master/learners', icon: <PeopleIcon /> },
        { key: 'diaries', label: JOURNAL_LABEL.many, href: '/master/diaries', icon: <BookIcon /> },
        { key: 'codes', label: 'Codes', href: '/master/codes', icon: <KeyIcon /> },
        { key: 'safety', label: 'Care and safety', href: '/master/safety', icon: <HeartIcon /> },
        { key: 'announcements', label: 'Announcements', href: '/master/announcements', icon: <BellIcon /> },
        { key: 'bin', label: 'Bin', href: '/master/bin', icon: <BinIcon /> },
      ],
    },
    {
      group: 'Teaching',
      description: 'Courses, live video, nights, and Scenes and Lanes.',
      items: [
        { key: 'library', label: 'Library', href: '/master/library', icon: <LibraryIcon /> },
        { key: 'bring-in', label: 'Bring in', href: '/master/bring-in', icon: <ClapperIcon /> },
        { key: 'plans', label: 'Study plans', href: '/master/plans', icon: <CalendarIcon /> },
        { key: 'live', label: 'Live recordings', href: '/master/live', icon: <MicIcon /> },
        { key: 'nights', label: 'Live in person', href: '/master/nights', icon: <MoonIcon /> },
        { key: 'circle', label: 'Circle answers', href: '/master/circle', icon: <PeopleIcon /> },
        { key: 'missions', label: 'Missions', href: '/master/missions', icon: <FlagIcon /> },
        { key: 'opening', label: 'Scenes', href: '/master/opening', icon: <SparkIcon /> },
        { key: 'lanes', label: 'Lanes', href: '/master/lanes', icon: <PathIcon /> },
      ],
    },
    {
      group: 'Look closer',
      description: 'Insights, the simulator, scales, and how the words are set up.',
      items: [
        { key: 'insights', label: 'Insights', href: '/master/insights', icon: <ChartIcon /> },
        { key: 'trends', label: 'Network trends', href: '/master/trends', icon: <NetworkIcon /> },
        { key: 'simulator', label: 'Simulator', href: '/master/simulator', icon: <FilmIcon /> },
        { key: 'personas', label: 'Scales', href: '/master/personas', icon: <ScaleIcon /> },
        { key: 'experiments', label: 'Experiments', href: '/master/experiments', icon: <BeakerIcon /> },
        { key: 'calendar', label: 'Event Calendar', href: '/master/calendar', icon: <CalendarIcon /> },
        { key: 'review', label: 'Review', href: '/master/review', icon: <QuestionIcon /> },
        { key: 'tiers', label: 'Talk tiers', href: '/master/tiers', icon: <ClapperIcon /> },
        { key: 'questions', label: 'Placing questions', href: '/master/questions', icon: <QuestionIcon /> },
        { key: 'ai', label: 'AI steps', href: '/master/ai', icon: <CogIcon /> },
        { key: 'framing', label: 'Framing director', href: '/master/framing', icon: <FrameIcon /> },
        { key: 'see-how', label: 'See how', href: '/master/see-how', icon: <FilmIcon /> },
        { key: 'sheet', label: 'Master sheet', href: '/master/sheet', icon: <SheetIcon /> },
        { key: 'transcripts', label: 'Transcripts', href: '/master/transcripts', icon: <SheetIcon /> },
        { key: 'create', label: 'Sheet creator', href: '/master/sheet/create', icon: <BookIcon /> },
      ],
    },
  ]
}

export async function DeskFrame({
  payload,
  user,
  title,
  intro,
  active,
  nav,
  brand,
  subBrand,
  deskName,
  brandHref,
  extraLinks = [],
  tools,
  help,
  query,
  testId,
  evening = true,
  modern = false,
  logoUrl,
  gatherDesk,
  showOnPhone = true,
  primary,
  children,
}: {
  payload: Payload
  user: SessionUser
  title: string
  intro?: ReactNode
  active: string
  nav: NavGroup[]
  brand: string
  subBrand: string
  /** What the narrow-screen note calls this desk. Defaults to the sub-brand. */
  deskName?: string
  brandHref: string
  extraLinks?: { label: string; href: string }[]
  tools?: ReactNode
  help?: ReactNode
  query: { error?: string | string[]; notice?: string | string[] }
  testId?: string
  evening?: boolean
  /** White desk. Used when the portal shell is modern, so the evening garden stays on HEARTS. */
  modern?: boolean
  /** A portal logo, when one has been set. Otherwise the HEARTS arch. */
  logoUrl?: string | null
  /** Gather's desk look. Kept off the library, access and teach desks. */
  gatherDesk?: boolean
  /** Show the desk on a phone, instead of the “open this on a laptop” note. On by default so the nav can be used on a phone. */
  showOnPhone?: boolean
  /** Replaces the catalog button when this page knows a better destination. */
  primary?: DeskPrimary
  children: ReactNode
}) {
  const notes = (await rows(payload, 'notifications', { user: { equals: user.id } }, { sort: '-createdAt', limit: 12 })).filter((note) => note.channel !== 'email-stub')
  const unread = notes.filter((note) => !note.read).length
  const tip = help ?? pageHelp(active, testId)
  const lead = deskLead(active, brandHref)
  const action = primary || lead?.primary
  const purpose = lead?.line
  const headerLine = purpose || (typeof intro === 'string' ? intro : null)
  return (
    <>
    <div className="desk-narrow" data-testid="desk-narrow" role="note">
      <BrandMark size={44} />
      <h1>Open this on a laptop or desktop</h1>
      <p>The {deskName || subBrand.toLowerCase()} needs a wider screen than this. Your work is saved, so you can carry on from a computer.</p>
      {deskAppHref(brandHref) ? (
        <p>
          <Link className="btn ink" href={deskAppHref(brandHref)!} data-testid="desk-open-app">{user.role === 'teacher' ? 'See what a learner sees' : 'Open the app'}</Link>
        </p>
      ) : null}
      <form action="/api/hearts" method="post">
        <Hidden fields={{ action: 'logout' }} />
        <button type="submit" className="btn ghost">Sign out</button>
      </form>
    </div>
    <div className={`desk${evening ? ' evening' : ''}${modern ? ' desk-modern' : ''}${gatherDesk ? ' gather-desk' : ''}${showOnPhone ? ' desk-phone' : ''}`} data-testid={testId}>
      <aside className="side">
        <Link className="side-brand" href={brandHref}>
          {logoUrl ? <img className="side-logo" alt="" src={logoUrl} /> : <BrandMark size={40} />}
          <span><b data-testid="side-brand-name">{brand}</b><small>{subBrand}</small></span>
        </Link>
        <SideNav>
          <DeskNav groups={nav} active={active} />
        </SideNav>
        <div className="side-foot">
          {extraLinks.length ? <div className="group">Elsewhere</div> : null}
          {extraLinks.map((link) => (
            <Link key={link.href} className="nav" href={link.href}>{link.label}</Link>
          ))}
          <div className="who">
            <span className="initial">{(user.name || user.email).slice(0, 1).toUpperCase()}</span>
            <span><b style={{ display: 'block', fontSize: 13 }}>{user.name || user.email}</b><small className="muted">{roleLabel(user.role)}</small></span>
          </div>
          <form action="/api/hearts" method="post">
            <Hidden fields={{ action: 'logout' }} />
            <button type="submit" data-testid="logout">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="main">
        <div className="main-head">
          <div>
            <h1>{title}{tip ? <HelpTip topic={testId || active}>{tip}</HelpTip> : null}</h1>
            {headerLine ? <p data-testid="desk-purpose">{headerLine}</p> : null}
            {purpose && intro && typeof intro !== 'string' ? <div className="desk-back">{intro}</div> : null}
          </div>
          <div className="head-tools">
            {action ? <Link className="btn" href={action.href} data-testid="primary-action">{action.label}</Link> : null}
            {tools}
            <details className="bell" data-testid="bell">
              <summary aria-label={`Notifications, ${unread} unread`}>
                <BellIcon />
                {unread ? <span className="count" data-testid="bell-count">{unread}</span> : null}
              </summary>
              <div className="drop">
                {notes.length ? notes.map((note) => (
                  <Link key={note.id} className="note" href={str(note.href) || '#'} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }} data-testid="desk-notification">
                    <b>{str(note.title)}</b>
                    <p>{str(note.body)}</p>
                    <small className="muted">{shortDate(note.createdAt)}</small>
                  </Link>
                )) : <p className="muted" style={{ margin: 6 }}>Nothing new.</p>}
                {unread ? (
                  <form action="/api/hearts" method="post" style={{ marginTop: 8 }}>
                    <Hidden fields={{ action: 'read-notes', next: brandHref }} />
                    <button className="btn ghost small" type="submit">Mark all as read</button>
                  </form>
                ) : null}
              </div>
            </details>
          </div>
        </div>
        <Flash error={query.error} notice={query.notice} />
        <DeskFade>{children}</DeskFade>
      </main>
    </div>
    </>
  )
}

function roleLabel(role: SessionUser['role']) {
  return role === 'master' ? 'Master desk' : role === 'portal-admin' ? 'Portal admin' : role === 'teacher' ? 'Teacher' : 'Learner'
}
