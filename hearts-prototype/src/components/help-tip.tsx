'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import styles from './help-tip.module.css'

const OPEN = 'hearts:help-tip'

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
 * Import from `@/components/help-tip` on any desk, including Experiments.
 * A button, not details/summary, so it can sit inside other disclosure rows.
 */
export function HelpTip({ children, topic, label = 'What is this?', place = 'start' }: HelpTipProps) {
  const id = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false)
    }
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener(OPEN, onOther)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener(OPEN, onOther)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, id])

  return (
    <span
      ref={rootRef}
      className={styles.root}
      data-testid="desk-help"
      data-help={topic || undefined}
      data-place={place}
      data-open={open ? 'yes' : 'no'}
    >
      <button
        type="button"
        className={styles.mark}
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={() => {
          const next = !open
          if (next) window.dispatchEvent(new CustomEvent(OPEN, { detail: id }))
          setOpen(next)
        }}
      >
        ?
      </button>
      {open ? <div className={styles.pop} role="note">{children}</div> : null}
    </span>
  )
}
