'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Scrolls the desk links on a short laptop, with a visible “More below” cue. */
export function SideNav({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const [overflow, setOverflow] = useState(false)
  const [atEnd, setAtEnd] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => {
      const extra = el.scrollHeight - el.clientHeight
      setOverflow(extra > 8)
      setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 12)
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check)
    observer?.observe(el)
    window.addEventListener('resize', check)
    return () => {
      el.removeEventListener('scroll', check)
      observer?.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [])

  return (
    <div className={`side-nav-wrap${overflow ? ' overflow' : ''}${atEnd ? ' at-end' : ''}`}>
      <nav ref={ref} className="side-nav" aria-label="Desk" data-testid="side-nav">
        {children}
      </nav>
      {overflow && !atEnd ? (
        <p className="side-nav-more" data-testid="nav-scroll-cue">More below</p>
      ) : null}
    </div>
  )
}
