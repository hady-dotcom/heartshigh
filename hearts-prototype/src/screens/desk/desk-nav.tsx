'use client'

import Link from 'next/link'
import { useLayoutEffect, useRef } from 'react'
import type { NavGroup } from './shell'

export function DeskNav({ groups, active }: { groups: NavGroup[]; active: string }) {
  const root = useRef<HTMLElement>(null)
  const booted = useRef(false)
  useLayoutEffect(() => {
    if (booted.current || !root.current) return
    booted.current = true
    const want = new Set(groups.filter((group) => group.items.some((item) => item.key === active)).map((group) => group.group))
    for (const details of root.current.querySelectorAll('details')) {
      details.open = want.has(details.getAttribute('data-group') || '')
    }
  }, [active, groups])

  return (
    <nav ref={root} className="side-nav" aria-label="Desk" data-testid="desk-nav">
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
    </nav>
  )
}
