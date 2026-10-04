import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Payload } from 'payload'
import { BrandMark } from '@/components/brand'
import { Flash, Hidden } from '@/components/app/shell'
import { BellIcon, BookIcon, HeartIcon, CalendarIcon, CogIcon, GlobeIcon, HomeIcon, KeyIcon, LibraryIcon, MoonIcon, PeopleIcon, QuestionIcon } from '@/components/icons'
import type { SessionUser } from '@/server/context'
import { rows, shortDate, str } from '../common'

type NavItem = { key: string; label: string; href: string; icon: ReactNode }

export function portalNav(base: string, user: SessionUser): { group: string; items: NavItem[] }[] {
  const teach: NavItem[] = [
    { key: 'teach', label: 'Teach', href: `${base}/admin/teach`, icon: <PeopleIcon /> },
    { key: 'feedback', label: 'Feedback', href: `${base}/admin/feedback`, icon: <QuestionIcon /> },
    { key: 'compass', label: 'Compass', href: `${base}/admin/compass`, icon: <HeartIcon /> },
    { key: 'plans', label: 'Study plans', href: `${base}/admin/plans`, icon: <CalendarIcon /> },
    { key: 'nights', label: 'Nights', href: `${base}/admin/nights`, icon: <MoonIcon /> },
  ]
  if (user.role === 'teacher') return [{ group: 'Portal', items: [{ key: 'overview', label: 'Overview', href: `${base}/admin`, icon: <HomeIcon /> }, ...teach] }]
  return [
    {
      group: 'Portal',
      items: [
        { key: 'overview', label: 'Overview', href: `${base}/admin`, icon: <HomeIcon /> },
        { key: 'content', label: 'Content', href: `${base}/admin/content`, icon: <BookIcon /> },
        { key: 'sheet', label: 'Master sheet', href: `${base}/admin/sheet`, icon: <BookIcon /> },
        { key: 'create', label: 'Sheet creator', href: `${base}/admin/sheet/create`, icon: <BookIcon /> },
        { key: 'library', label: 'Library', href: `${base}/admin/library`, icon: <LibraryIcon /> },
        { key: 'access', label: 'Access codes', href: `${base}/admin/access`, icon: <KeyIcon /> },
        { key: 'opening', label: 'Opening', href: `${base}/admin/opening`, icon: <HeartIcon /> },
        { key: 'circle', label: 'Circle answers', href: `${base}/admin/circle`, icon: <PeopleIcon /> },
        { key: 'ai', label: 'AI steps', href: `${base}/admin/ai`, icon: <CogIcon /> },
      ],
    },
    { group: 'People', items: teach },
    { group: 'Setup', items: [{ key: 'settings', label: 'Settings', href: `${base}/admin/settings`, icon: <CogIcon /> }] },
  ]
}

export function masterNav(): { group: string; items: NavItem[] }[] {
  return [
    {
      group: 'Master desk',
      items: [
        { key: 'portals', label: 'Portals', href: '/master', icon: <GlobeIcon /> },
        { key: 'library', label: 'Library', href: '/master/library', icon: <LibraryIcon /> },
        { key: 'review', label: 'Review', href: '/master/review', icon: <QuestionIcon /> },
        { key: 'ai', label: 'AI steps', href: '/master/ai', icon: <CogIcon /> },
        { key: 'tiers', label: 'Talk tiers', href: '/master/tiers', icon: <BookIcon /> },
        { key: 'packs', label: 'Course packs', href: '/master/packs', icon: <BookIcon /> },
        { key: 'sheet', label: 'Master sheet', href: '/master/sheet', icon: <BookIcon /> },
        { key: 'create', label: 'Sheet creator', href: '/master/sheet/create', icon: <BookIcon /> },
        { key: 'questions', label: 'Placing questions', href: '/master/questions', icon: <QuestionIcon /> },
        { key: 'circle', label: 'Circle answers', href: '/master/circle', icon: <PeopleIcon /> },
      ],
    },
    {
      group: 'Opening',
      items: [
        { key: 'opening', label: 'Scenes', href: '/master/opening', icon: <HeartIcon /> },
        { key: 'lanes', label: 'Lanes', href: '/master/lanes', icon: <BookIcon /> },
        { key: 'simulator', label: 'Simulator', href: '/master/simulator', icon: <CogIcon /> },
        { key: 'personas', label: 'Scales and bands', href: '/master/personas', icon: <HeartIcon /> },
        { key: 'trends', label: 'Network trends', href: '/master/trends', icon: <GlobeIcon /> },
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
  query,
  testId,
  evening,
  children,
}: {
  payload: Payload
  user: SessionUser
  title: string
  intro?: ReactNode
  active: string
  nav: { group: string; items: NavItem[] }[]
  brand: string
  subBrand: string
  /** What the narrow-screen note calls this desk. Defaults to the sub-brand. */
  deskName?: string
  brandHref: string
  extraLinks?: { label: string; href: string }[]
  tools?: ReactNode
  query: { error?: string; notice?: string }
  testId?: string
  evening?: boolean
  children: ReactNode
}) {
  const notes = (await rows(payload, 'notifications', { user: { equals: user.id } }, { sort: '-createdAt', limit: 12 })).filter((note) => note.channel !== 'email-stub')
  const unread = notes.filter((note) => !note.read).length
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
    <div className={evening ? 'desk evening' : 'desk'} data-testid={testId}>
      <aside className="side">
        <Link className="side-brand" href={brandHref}>
          <BrandMark size={40} />
          <span><b>{brand}</b><small>{subBrand}</small></span>
        </Link>
        <nav className="side-nav" aria-label="Desk">
          {nav.map((group) => (
            <div key={group.group} style={{ display: 'contents' }}>
              <div className="group">{group.group}</div>
              {group.items.map((item) => (
                <Link key={item.key} className={`nav${item.key === active ? ' on' : ''}`} href={item.href} aria-current={item.key === active ? 'page' : undefined} data-testid={`nav-${item.key}`}>
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
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
            <h1>{title}</h1>
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
        {children}
      </main>
    </div>
    </>
  )
}

function roleLabel(role: SessionUser['role']) {
  return role === 'master' ? 'Master desk' : role === 'portal-admin' ? 'Portal admin' : role === 'teacher' ? 'Teacher' : 'Learner'
}
