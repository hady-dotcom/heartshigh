'use client'

import Link from 'next/link'
import { useLayoutEffect, useRef } from 'react'
import type { NavGroup } from './shell'

/** Grouped desk links. Every group starts open so Content stays reachable; the current section stays open after a close. */
export function DeskNav({ groups, active }: { groups: NavGroup[]; active: string }) {
  const root = useRef<HTMLDivElement>(null)
  const started = useRef(false)
  useLayoutEffect(() => {
    if (!root.current) return
    const want = new Set(groups.filter((group) => group.items.some((item) => item.key === active)).map((group) => group.group))
    for (const details of root.current.querySelectorAll('details')) {
      const group = details.getAttribute('data-group') || ''
      if (!started.current || want.has(group)) details.open = true
    }
    started.current = true
  }, [active, groups])

  return (
    <div ref={root} style={{ display: 'contents' }} data-testid="desk-nav">
      {groups.map((group) => (
        <details
          key={group.group}
          className="nav-group"
          data-group={group.group}
          data-testid={`nav-group-${group.group.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <summary className="group">{group.group}</summary>
          {group.description ? <p className="group-desc">{group.description}</p> : null}
          {group.items.map((item) => (
            <Link key={item.key} className={`nav${item.key === active ? ' on' : ''}`} href={item.href} aria-current={item.key === active ? 'page' : undefined} data-testid={`nav-${item.key}`}>
              {item.icon}
              {item.label}
            </Link>
          ))}
        </details>
      ))}
    </div>
  )
}
