'use client'

import Link from 'next/link'
import { track } from '@/lib/experiment-track'
import { useVariant } from '@/lib/use-variant'

export type Tab = 'home' | 'lanes' | 'week' | 'garden' | 'me' | 'gather'

export function TabBar({ base, active = null, portal, dark = false, evening = false, unread = 0, showLanes = true }: { base: string; active?: Tab | null; portal?: { features?: unknown; shape?: string | null; shell?: string | null } | null; dark?: boolean; evening?: boolean; unread?: number; showLanes?: boolean }) {
  const lanes = useVariant('lanes-tab-label', { payload: { label: 'Lanes' } })
  const lanesOn = showLanes && portal?.shell !== 'modern'
  const tabs: [Tab, string, string][] = [
    ['home', 'Home', base],
    ...(lanesOn ? [['lanes', lanes.label || 'Lanes', `${base}/lanes`] as [Tab, string, string]] : []),
    ['week', 'My week', `${base}/week`],
    ['garden', 'Courses', `${base}/courses`],
    ['me', 'Me', `${base}/me`],
  ]
  return (
    <nav className={`tabbar${dark ? ' dark' : ''}${evening ? ' evening' : ''}`} aria-label="Main" data-testid="tabbar" data-shape={portal?.shape || 'hearts'} data-tabs={tabs.length}>
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
        <g className="tab-line">
          <path d="M3.5 11 12 4l8.5 7" />
          <path d="M5.5 9.5V20h13V9.5" fill={on ? 'currentColor' : 'none'} fillOpacity={on ? 0.12 : 0} />
          <path d="M10 20v-5h4v5" />
        </g>
        <path className="tab-solid" d="M4 11.2 12 4.4l8 6.8V20a1 1 0 0 1-1 1h-4.2v-5.2h-5.6V21H5a1 1 0 0 1-1-1V11.2z" fill="currentColor" stroke="none" />
      </svg>
    )
  if (tab === 'lanes')
    return (
      <svg {...common} className="tab-icon">
        <g className="tab-line">
          <rect x="3.5" y="4" width="5" height="16" rx="1.5" />
          <rect x="9.5" y="4" width="5" height="16" rx="1.5" fill={on ? 'currentColor' : 'none'} fillOpacity={on ? 0.12 : 0} />
          <path d="m16.2 5.2 3.6-1 3 15.2-3.6 1z" />
        </g>
        <path className="tab-solid" d="M3.5 5.2A1.2 1.2 0 0 1 4.7 4h3.6a1.2 1.2 0 0 1 1.2 1.2v13.6a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2V5.2zm6 0A1.2 1.2 0 0 1 10.7 4h3.6a1.2 1.2 0 0 1 1.2 1.2v13.6a1.2 1.2 0 0 1-1.2 1.2h-3.6a1.2 1.2 0 0 1-1.2-1.2V5.2z" fill="currentColor" stroke="none" />
      </svg>
    )
  if (tab === 'week')
    return (
      <svg {...common} className="tab-icon">
        <g className="tab-line">
          <rect x="3.5" y="5" width="17" height="16" rx="2" />
          <path d="M3.5 10h17" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M8 14h.01M12 14h.01M16 14h.01" />
        </g>
        <path className="tab-solid" d="M7 3.2a1 1 0 0 1 1-1h.2a1 1 0 0 1 1 1V5h5.6V3.2a1 1 0 0 1 1-1h.2a1 1 0 0 1 1 1V5H19a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2V3.2zM4.2 10.2V19h15.6v-8.8H4.2z" fill="currentColor" stroke="none" />
      </svg>
    )
  if (tab === 'garden')
    return (
      <svg {...common} className="tab-icon">
        <g className="tab-plant">
          <path d="M12 21v-8" />
          <path d="M12 16c-3.5 0-5.5-2-6-5 3 0 5.5 1.5 6 5z" />
          <circle cx="12" cy="7.5" r="3.5" fill={on ? 'currentColor' : 'none'} fillOpacity={on ? 0.15 : 0} />
        </g>
        <g className="tab-book">
          <g className="tab-line">
            <path d="M4.5 5.5c2.4-.7 4.6-.3 7.5.9 2.9-1.2 5.1-1.6 7.5-.9" />
            <path d="M12 6.4V19" />
            <path d="M4.5 5.5V17c2.4-.5 4.6-.1 7.5 1.1" />
            <path d="M19.5 5.5V17c-2.4-.5-4.6-.1-7.5 1.1" />
          </g>
          <path className="tab-solid" d="M12 6.2c-2.6-1.2-5-1.5-7.4-.8A1 1 0 0 0 4 6.3V17.2c2.5-.6 5-.2 8 1.3 3-1.5 5.5-1.9 8-1.3V6.3a1 1 0 0 0-.6-.9C17 4.7 14.6 5 12 6.2z" fill="currentColor" stroke="none" />
        </g>
      </svg>
    )
  return (
    <svg {...common} className="tab-icon">
      <g className="tab-line">
        <circle cx="12" cy="8" r="3.2" fill={on ? 'currentColor' : 'none'} fillOpacity={on ? 0.12 : 0} />
        <path d="M5 20c.8-3.6 3.4-5.4 7-5.4s6.2 1.8 7 5.4" />
      </g>
      <path className="tab-solid" d="M12 4.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6zM5.2 19.8c.9-3.8 3.6-5.8 6.8-5.8s5.9 2 6.8 5.8c.1.5-.3.9-.8.9H6c-.5 0-.9-.4-.8-.9z" fill="currentColor" stroke="none" />
    </svg>
  )
}
