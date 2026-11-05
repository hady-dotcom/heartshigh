'use client'

import type { ReactNode } from 'react'

/** A table row that opens a page, and leaves buttons, links and ticks alone. */
export function ClickRow({ href, testId, children }: { href: string; testId?: string; children: ReactNode }) {
  return (
    <tr
      data-href={href}
      data-testid={testId}
      onClick={(event) => {
        const target = event.target as HTMLElement | null
        if (!target) return
        if (target.closest('a, button, input, select, textarea, label, summary, form')) return
        window.location.assign(href)
      }}
    >
      {children}
    </tr>
  )
}
