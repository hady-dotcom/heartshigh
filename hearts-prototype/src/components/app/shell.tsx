import Link from 'next/link'
import type { ReactNode } from 'react'
import { RouteFade } from '@/components/app/route-fade'
import { PageHelp } from '@/components/app/page-help'
import { learnerBar, type BarKey, type FeatureSource } from '@/lib/features'
import { learnerHelp } from '@/lib/learner-help'

export type Tab = BarKey

export function TabBar({
  base,
  active,
  portal,
  dark = false,
  evening = false,
  unread = 0,
}: {
  base: string
  active?: Tab | null
  portal?: FeatureSource
  dark?: boolean
  evening?: boolean
  unread?: number
}) {
  const tabs = learnerBar(portal)
  return (
    <nav className={`tabbar${dark ? ' dark' : ''}${evening ? ' evening' : ''}`} aria-label="Main" data-testid="tabbar">
      {tabs.map((item) => {
        const href = `${base}${item.path}`
        return (
          <Link key={item.key} href={href} className={`tab${active === item.key ? ' on' : ''}`} aria-current={active === item.key ? 'page' : undefined} data-testid={`tab-${item.key}`}>
            <TabIcon tab={item.key} on={active === item.key} />
            {item.key === 'me' && unread > 0 ? <span className="badge" data-testid="unread-badge">{unread}</span> : null}
            {item.label}
          </Link>
        )
      })}
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
  if (tab === 'week')
    return (
      <svg {...common} className="tab-icon">
        <rect x="3.5" y="5" width="17" height="16" rx="2" />
        <path d="M3.5 10h17" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
        <path d="M8 14h.01M12 14h.01M16 14h.01" />
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
  const paused = Boolean(error && /this account is paused/i.test(error))
  return (
    <>
      {error ? <div className="flash error" role="alert" data-testid="error" {...(paused ? { 'data-paused-when': error } : {})}>{error}</div> : null}
      {notice ? <div className="flash notice" role="status" data-testid="notice">{notice}</div> : null}
    </>
  )
}

export function AppFrame({ children, dark = false, evening = false, testId, tone }: { children: ReactNode; dark?: boolean; evening?: boolean; testId?: string; tone?: 'gather' }) {
  const gather = tone === 'gather'
  const help = learnerHelp(testId)
  return (
    <div className={`app-stage${evening ? ' evening' : ''}${gather ? ' gather-stage' : ''}`}>
      <main id="main-content" className={`app${dark ? ' dark' : ''}${evening ? ' evening' : ''}${gather ? ' gather-shell' : ''}`} data-testid={testId} tabIndex={-1}>
        {help ? <PageHelp topic={testId || 'page'}>{help}</PageHelp> : null}
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
