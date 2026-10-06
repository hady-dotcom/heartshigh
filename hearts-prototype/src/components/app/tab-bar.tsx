'use client'

import Link from 'next/link'
import { track } from '@/lib/experiment-track'
import type { FeatureSource } from '@/lib/features'
import { useVariant } from '@/lib/use-variant'

export type Tab = 'home' | 'lanes' | 'week' | 'garden' | 'me' | 'gather'

export function TabBar({ base, active = null, portal: _portal, dark = false, evening = false, unread = 0 }: { base: string; active?: Tab | null; portal?: FeatureSource; dark?: boolean; evening?: boolean; unread?: number }) {
  const lanes = useVariant('lanes-tab-label', { payload: { label: 'Lanes' } })
  const tabs: [Tab, string, string][] = [
    ['home', 'Home', base],
    ['lanes', lanes.label || 'Lanes', `${base}/lanes`],
    ['week', 'My week', `${base}/week`],
    ['garden', 'Garden', `${base}/garden`],
    ['me', 'Me', `${base}/me`],
  ]
  return (
    <nav className={`tabbar${dark ? ' dark' : ''}${evening ? ' evening' : ''}`} aria-label="Main" data-testid="tabbar">
      {tabs.map(([key, label, href]) => (
        <Link
          key={key}
          href={href}
          className={`tab${active === key ? ' on' : ''}`}
          aria-current={active === key ? 'page' : undefined}
          data-testid={`tab-${key}`}
          onClick={key === 'lanes' ? () => track('lanes_tab_tap') : undefined}
        >
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
