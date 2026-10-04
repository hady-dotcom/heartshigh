'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { NavGroup } from './shell'

export function DeskNav({ groups, active }: { groups: NavGroup[]; active: string }) {
  const [opened, setOpened] = useState(() => groups.filter((group) => group.items.some((item) => item.key === active)).map((group) => group.group))
  return (
    <nav className="side-nav" aria-label="Desk" data-testid="desk-nav">
      {groups.map((group) => (
        <details
          key={group.group}
          className="nav-group"
          open={opened.includes(group.group)}
          onToggle={(event) => {
            const isOpen = event.currentTarget.open
            setOpened((current) => (isOpen ? [...new Set([...current, group.group])] : current.filter((name) => name !== group.group)))
          }}
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
