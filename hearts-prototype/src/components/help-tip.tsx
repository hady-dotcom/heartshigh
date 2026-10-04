'use client'

import { type ReactNode } from 'react'
import styles from './help-tip.module.css'

export type HelpTipProps = {
  children: ReactNode
  /** Stable name for tests and for one-open-at-a-time grouping. */
  topic?: string
  label?: string
  /** Open the card to the right when the “?” sits at the end of a row. */
  place?: 'start' | 'end'
}

/**
 * Small “?” that opens two to four plain sentences.
 * Import this from `@/components/help-tip` on any desk, including Experiments.
 */
export function HelpTip({ children, topic, label = 'What is this?', place = 'start' }: HelpTipProps) {
  return (
    <details
      className={styles.root}
      data-testid="desk-help"
      data-help={topic || undefined}
      data-place={place}
      onToggle={(event) => {
        if (!event.currentTarget.open) return
        document.querySelectorAll<HTMLDetailsElement>('details[data-testid="desk-help"][open]').forEach((other) => {
          if (other !== event.currentTarget) other.open = false
        })
      }}
    >
      <summary aria-label={label} title={label}>?</summary>
      <div className={styles.pop} role="note">{children}</div>
    </details>
  )
}
