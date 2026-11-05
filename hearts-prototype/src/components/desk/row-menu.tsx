'use client'

import { type ReactNode } from 'react'

/** Per-row actions on a tight laptop: a ⋯ menu instead of a clipped button row. */
export function RowMenu({ children, label = 'More' }: { children: ReactNode; label?: string }) {
  return (
    <details className="row-menu" data-testid="row-menu">
      <summary className="btn ghost small" aria-label={label}>⋯</summary>
      <div className="row-menu-drop">{children}</div>
    </details>
  )
}
