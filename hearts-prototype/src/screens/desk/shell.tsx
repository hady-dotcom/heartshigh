import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Payload } from 'payload'
import { BrandMark } from '@/components/brand'
import { DeskFade } from '@/components/app/route-fade'
import { Flash, Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { SideNav } from '@/components/desk/side-nav'
import { pageHelp } from '@/lib/desk-help'
import { BellIcon, BeakerIcon, BookIcon, CalendarIcon, ChartIcon, ClapperIcon, CogIcon, CompassIcon, FilmIcon, FlagIcon, FrameIcon, GlobeIcon, HeartIcon, HomeIcon, KeyIcon, LibraryIcon, MoonIcon, NetworkIcon, PathIcon, PeopleIcon, QuestionIcon, ScaleIcon, SheetIcon, SparkIcon } from '@/components/icons'
import type { SessionUser } from '@/server/context'
import { rows, shortDate, str } from '../common'
import { DeskNav } from './desk-nav'

type NavItem = { key: string; label: string; href: string; icon: ReactNode }
export type NavGroup = { group: string; description?: string; items: NavItem[] }

export function portalNav(base: string, user: SessionUser): NavGroup[] {
  const teach: NavItem[] = [
    { key: 'teach', label: 'Learners', href: `${base}/admin/teach`, icon: <PeopleIcon /> },
    { key: 'feedback', label: 'Feedback', href: `${base}/admin/feedback`, icon: <QuestionIcon /> },
    { key: 'compass', label: 'Compass', href: `${base}/admin/compass`, icon: <HeartIcon /> },
    { key: 'plans', label: 'Study plans', href: `${base}/admin/plans`, icon: <CalendarIcon /> },
    { key: 'nights', label: 'Nights', href: `${base}/admin/nights`, icon: <MoonIcon /> },
    { key: 'gather', label: 'Gather', href: `${base}/admin/gather`, icon: <PeopleIcon /> },
  ]
  if (user.role === 'teacher') {
    return [{ group: 'Beginner', description: 'Everyday work with the people in your portal.', items: [{ key: 'overview', label: 'Overview', href: `${base}/admin`, icon: <HomeIcon /> }, ...teach] }]
  }
  return [
    {
      group: 'Beginner',
      description: 'Everyday tasks: learners, codes and the library.',
      items: [
        { key: 'overview', label: 'Overview', href: `${base}/admin`, icon: <HomeIcon /> },
        { key: 'teach', label: 'Learners', href: `${base}/admin/teach`, icon: <PeopleIcon /> },
        { key: 'access', label: 'Codes', href: `${base}/admin/access`, icon: <KeyIcon /> },
        { key: 'library', label: 'Library', href: `${base}/admin/library`, icon: <LibraryIcon /> },
      ],
    },
    {
      group: 'Intermediate',
      description: 'Course packs, study plans, Gather, live nights, missions, Scenes and Lanes.',
      items: [
        { key: 'content', label: 'Content', href: `${base}/admin/content`, icon: <BookIcon /> },
        { key: 'plans', label: 'Study plans', href: `${base}/admin/plans`, icon: <CalendarIcon /> },
        { key: 'circle', label: 'Gather', href: `${base}/admin/circle`, icon: <PeopleIcon /> },
        { key: 'nights', label: 'Live', href: `${base}/admin/nights`, icon: <MoonIcon /> },
        { key: 'missions', label: 'Missions', href: `${base}/admin/missions`, icon: <FlagIcon /> },
      ],
    },
    {
      group: 'In-depth',
      description: 'Experiments, Insights, AI, framing and the sheet.',
      items: [
        { key: 'experiments', label: 'Experiments', href: `${base}/admin/experiments`, icon: <BeakerIcon /> },
        { key: 'insights', label: 'Insights', href: `${base}/admin/insights`, icon: <ChartIcon /> },
        { key: 'calendar', label: 'Calendar', href: `${base}/admin/calendar`, icon: <CalendarIcon /> },
        { key: 'ai', label: 'AI steps', href: `${base}/admin/ai`, icon: <CogIcon /> },
        { key: 'opening', label: 'Framing director', href: `${base}/admin/opening`, icon: <FrameIcon /> },
        { key: 'sheet', label: 'Master sheet', href: `${base}/admin/sheet`, icon: <SheetIcon /> },
        { key: 'create', label: 'Sheet creator', href: `${base}/admin/sheet/create`, icon: <BookIcon /> },
        { key: 'feedback', label: 'Feedback', href: `${base}/admin/feedback`, icon: <QuestionIcon /> },
        { key: 'compass', label: 'Compass', href: `${base}/admin/compass`, icon: <CompassIcon /> },
        { key: 'settings', label: 'Settings', href: `${base}/admin/settings`, icon: <CogIcon /> },
      ],
    },
  ]
}

export function masterNav(): NavGroup[] {
  return [
    {
      group: 'Beginner',
      description: 'Everyday tasks: portals, learners, codes and the library.',
      items: [
        { key: 'portals', label: 'Portals', href: '/master', icon: <GlobeIcon /> },
        { key: 'learners', label: 'Learners', href: '/master/learners', icon: <PeopleIcon /> },
        { key: 'codes', label: 'Codes', href: '/master/codes', icon: <KeyIcon /> },
        { key: 'library', label: 'Library', href: '/master/library', icon: <LibraryIcon /> },
      ],
    },
    {
      group: 'Intermediate',
      description: 'Course packs, study plans, Gather, live nights, missions, Scenes and Lanes.',
      items: [
        { key: 'packs', label: 'Course packs', href: '/master/packs', icon: <BookIcon /> },
        { key: 'plans', label: 'Study plans', href: '/master/plans', icon: <CalendarIcon /> },
        { key: 'circle', label: 'Gather', href: '/master/circle', icon: <PeopleIcon /> },
        { key: 'nights', label: 'Live', href: '/master/nights', icon: <MoonIcon /> },
        { key: 'missions', label: 'Missions', href: '/master/missions', icon: <FlagIcon /> },
        { key: 'opening', label: 'Scenes', href: '/master/opening', icon: <SparkIcon /> },
        { key: 'lanes', label: 'Lanes', href: '/master/lanes', icon: <PathIcon /> },
      ],
    },
    {
      group: 'In-depth',
      description: 'Experiments, Insights, AI, framing, the sheet, the simulator and scales.',
      items: [
        { key: 'experiments', label: 'Experiments', href: '/master/experiments', icon: <BeakerIcon /> },
        { key: 'insights', label: 'Insights', href: '/master/insights', icon: <ChartIcon /> },
        { key: 'calendar', label: 'Calendar', href: '/master/calendar', icon: <CalendarIcon /> },
        { key: 'ai', label: 'AI steps', href: '/master/ai', icon: <CogIcon /> },
        { key: 'framing', label: 'Framing director', href: '/master/framing', icon: <FrameIcon /> },
        { key: 'sheet', label: 'Master sheet', href: '/master/sheet', icon: <SheetIcon /> },
        { key: 'simulator', label: 'Simulator', href: '/master/simulator', icon: <FilmIcon /> },
        { key: 'personas', label: 'Scales', href: '/master/personas', icon: <ScaleIcon /> },
        { key: 'review', label: 'Review', href: '/master/review', icon: <QuestionIcon /> },
        { key: 'tiers', label: 'Talk tiers', href: '/master/tiers', icon: <ClapperIcon /> },
        { key: 'create', label: 'Sheet creator', href: '/master/sheet/create', icon: <BookIcon /> },
        { key: 'questions', label: 'Placing questions', href: '/master/questions', icon: <QuestionIcon /> },
        { key: 'trends', label: 'Network trends', href: '/master/trends', icon: <NetworkIcon /> },
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
  logoUrl,
  gatherDesk,
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
  query: { error?: string; notice?: string }
  testId?: string
  evening?: boolean
  /** A portal logo, when one has been set. Otherwise the HEARTS arch. */
  logoUrl?: string | null
  /** Gather's desk look. Kept off the library, access and teach desks. */
  gatherDesk?: boolean
  children: ReactNode
}) {
  const notes = (await rows(payload, 'notifications', { user: { equals: user.id } }, { sort: '-createdAt', limit: 12 })).filter((note) => note.channel !== 'email-stub')
  const unread = notes.filter((note) => !note.read).length
  const tip = help ?? pageHelp(active, testId)
  return (
    <>
    <div className="desk-narrow" data-testid="desk-narrow" role="note">
      <BrandMark size={44} />
      <h1>Open this on a laptop or desktop</h1>
      <p>The {deskName || subBrand.toLowerCase()} needs a wider screen than this. Your work is saved, so you can carry on from a computer.</p>
      <form action="/api/hearts" method="post">
        <Hidden fields={{ action: 'logout' }} />
        <button type="submit" className="btn ghost">Sign out</button>
      </form>
    </div>
    <div className={`desk${evening ? ' evening' : ''}${gatherDesk ? ' gather-desk' : ''}`} data-testid={testId}>
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
            {intro ? <p>{intro}</p> : null}
          </div>
          <div className="head-tools">
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
