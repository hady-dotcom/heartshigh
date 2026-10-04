'use client'

import { type ReactNode } from 'react'

/** A small “?” that opens two to four plain sentences. One open at a time on the page. */
export function HelpTip({
  children,
  topic,
  label = 'What is this?',
}: {
  children: ReactNode
  topic?: string
  label?: string
}) {
  return (
    <details
      className="desk-help"
      data-testid="desk-help"
      data-help={topic || undefined}
      onToggle={(event) => {
        if (!event.currentTarget.open) return
        document.querySelectorAll<HTMLDetailsElement>('details.desk-help[open]').forEach((other) => {
          if (other !== event.currentTarget) other.open = false
        })
      }}
    >
      <summary aria-label={label} title={label}>?</summary>
      <div className="desk-help-pop" role="note">{children}</div>
    </details>
  )
}
