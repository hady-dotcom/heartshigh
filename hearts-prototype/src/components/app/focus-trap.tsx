'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/** Traps Tab inside a pop-up and returns focus to the opener (X02). */
export function FocusTrap({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const last = useRef<HTMLElement | null>(null)

  useEffect(() => {
    last.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const node = root.current
    const focusables = () =>
      node
        ? Array.from(node.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(
            (item) => !item.hasAttribute('disabled'),
          )
        : []
    const first = focusables()[0]
    first?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
        return
      }
      if (event.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      const head = list[0]
      const tail = list[list.length - 1]
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault()
        tail.focus()
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault()
        head.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      last.current?.focus()
    }
  }, [onClose])

  return (
    <div ref={root} data-testid="focus-trap">
      {children}
    </div>
  )
}
