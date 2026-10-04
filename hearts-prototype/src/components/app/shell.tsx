import Link from 'next/link'
import type { ReactNode } from 'react'
import { RouteFade } from '@/components/app/route-fade'

export type Tab = 'home' | 'lanes' | 'gather' | 'garden' | 'me'

export function TabBar({ base, active, dark = false, evening = false, unread = 0 }: { base: string; active: Tab; dark?: boolean; evening?: boolean; unread?: number }) {
  const tabs: [Tab, string, string][] = [
    ['home', 'Home', base],
    ['lanes', 'Lanes', `${base}/lanes`],
    ['gather', 'Gather', `${base}/gather`],
    ['garden', 'Garden', `${base}/garden`],
    ['me', 'Me', `${base}/me`],
  ]
  return (
    <nav className={`tabbar${dark ? ' dark' : ''}${evening ? ' evening' : ''}`} aria-label="Main" data-testid="tabbar">
      {tabs.map(([key, label, href]) => (
        <Link key={key} href={href} className={`tab${active === key ? ' on' : ''}`} aria-current={active === key ? 'page' : undefined} data-testid={`tab-${key}`}>
          <TabIcon tab={key} on={active === key} />
          {key === 'me' && unread > 0 ? <span className="badge" data-testid="unread-badge">{unread}</span> : null}
          {label}
        </Link>
      ))}
    </nav>
  )
}

function TabIcon({ tab, on }: { tab: Tab; on: boolean }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: on ? 2.2 : 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (tab === 'home')
    return (
      <svg {...common} className="tab-icon">
        <path d="M3.5 11 12 4l8.5 7" />
        <path d="M5.5 9.5V20h13V9.5" fill={on ? 'currentColor' : 'none'} fillOpacity={on ? 0.12 : 0} />
        <path d="M10 20v-5h4v5" />
      </svg>
    )
  if (tab === 'lanes')
    return (
      <svg {...common} className="tab-icon">
        <rect x="3.5" y="4" width="5" height="16" rx="1.5" />
        <rect x="9.5" y="4" width="5" height="16" rx="1.5" fill={on ? 'currentColor' : 'none'} fillOpacity={on ? 0.12 : 0} />
        <path d="m16.2 5.2 3.6-1 3 15.2-3.6 1z" />
      </svg>
    )
  if (tab === 'gather')
    return (
      <svg {...common} className="tab-icon">
        <path d="M12 21c-4-3-7-6.2-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 3.8-3 7-7 10z" fill={on ? 'currentColor' : 'none'} fillOpacity={on ? 0.15 : 0} />
        <path d="M12 11v4" />
        <path d="M9 8.5c.4-2 1.4-3.5 3-4.5 1.6 1 2.6 2.5 3 4.5" />
      </svg>
    )
  if (tab === 'garden')
    return (
      <svg {...common} className="tab-icon">
        <path d="M12 21v-8" />
        <path d="M12 16c-3.5 0-5.5-2-6-5 3 0 5.5 1.5 6 5z" />
        <circle cx="12" cy="7.5" r="3.5" fill={on ? 'currentColor' : 'none'} fillOpacity={on ? 0.15 : 0} />
      </svg>
    )
  return (
    <svg {...common} className="tab-icon">
      <circle cx="12" cy="8" r="4" fill={on ? 'currentColor' : 'none'} fillOpacity={on ? 0.12 : 0} />
      <path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" />
    </svg>
  )
}

export function Flash({ error, notice }: { error?: string; notice?: string }) {
  return (
    <>
      {error ? <div className="flash error" role="alert" data-testid="error">{error}</div> : null}
      {notice ? <div className="flash notice" role="status" data-testid="notice">{notice}</div> : null}
    </>
  )
}

export function AppFrame({ children, dark = false, evening = false, testId, tone }: { children: ReactNode; dark?: boolean; evening?: boolean; testId?: string; tone?: 'gather' }) {
  const gather = tone === 'gather'
  return (
    <div className={`app-stage${evening ? ' evening' : ''}${gather ? ' gather-stage' : ''}`}>
      <main className={`app${dark ? ' dark' : ''}${evening ? ' evening' : ''}${gather ? ' gather-shell' : ''}`} data-testid={testId}>
        <RouteFade>{children}</RouteFade>
      </main>
    </div>
  )
}

export function Back({ href, label }: { href: string; label: string }) {
  return (
    <Link className="back" href={href} data-testid="back">
      ‹ {label}
    </Link>
  )
}

export function Hidden({ fields }: { fields: Record<string, string | number | undefined | null> }) {
  return (
    <>
      {Object.entries(fields).map(([name, value]) => (value === undefined || value === null ? null : <input key={name} type="hidden" name={name} value={String(value)} />))}
    </>
  )
}
