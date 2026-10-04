'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './help-tip.module.css'

const OPEN = 'hearts:help-tip'

export type HelpTipProps = {
  children: ReactNode
  /** Stable name for tests and for one-open-at-a-time grouping. */
  topic?: string
  label?: string
  /** Prefer opening the card to the left when the “?” sits at the end of a row. */
  place?: 'start' | 'end'
}

/**
 * Small “?” that opens two to four plain sentences.
 * Import from `@/components/help-tip` on any desk, including Experiments.
 * A button, not details/summary, so it can sit inside other disclosure rows.
 * The card is portalled to document.body so a panel’s overflow:hidden cannot clip it.
 */
export function HelpTip({ children, topic, label = 'What is this?', place = 'start' }: HelpTipProps) {
  const id = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const markRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState({ top: 0, left: 0, width: 280, placed: false })

  useLayoutEffect(() => {
    if (!open) return
    const placeCard = () => {
      const mark = markRef.current
      const pop = popRef.current
      if (!mark || !pop) return
      const pad = 12
      const width = Math.min(22 * 16, window.innerWidth * 0.72, window.innerWidth - pad * 2)
      const markBox = mark.getBoundingClientRect()
      pop.style.width = `${width}px`
      const height = pop.offsetHeight
      let left = place === 'end' ? markBox.right - width : markBox.left
      if (left + width > window.innerWidth - pad) left = window.innerWidth - pad - width
      if (left < pad) left = pad
      let top = markBox.bottom + 8
      if (top + height > window.innerHeight - pad) top = markBox.top - 8 - height
      if (top < pad) top = pad
      setBox({ top, left, width, placed: true })
    }
    placeCard()
    window.addEventListener('resize', placeCard)
    window.addEventListener('scroll', placeCard, true)
    return () => {
      window.removeEventListener('resize', placeCard)
      window.removeEventListener('scroll', placeCard, true)
    }
  }, [open, place, children])

  useEffect(() => {
    if (!open) return
    const onOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false)
    }
    const onDoc = (event: MouseEvent) => {
      const node = event.target as Node
      if (rootRef.current?.contains(node) || popRef.current?.contains(node)) return
      setOpen(false)
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
      data-open={open ? 'yes' : 'no'}
    >
      <button
        ref={markRef}
        type="button"
        className={styles.mark}
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          const next = !open
          if (next) window.dispatchEvent(new CustomEvent(OPEN, { detail: id }))
          setOpen(next)
        }}
      >
        ?
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={popRef}
            className={styles.pop}
            role="note"
            data-testid="desk-help-pop"
            data-help={topic || undefined}
            data-placed={box.placed ? 'yes' : 'no'}
            style={{ top: box.top, left: box.left, width: box.width }}
          >
            {children}
          </div>,
          document.body,
        )
        : null}
    </span>
  )
}
