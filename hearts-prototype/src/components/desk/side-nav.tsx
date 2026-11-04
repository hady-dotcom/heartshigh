'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Scrolls the desk links on a short laptop, with a visible “More below” cue. */
export function SideNav({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const [overflow, setOverflow] = useState(false)
  const [atEnd, setAtEnd] = useState(true)
  const menuRef = useRef<HTMLDetailsElement>(null)

  // Desktop keeps the rail open. The Menu button is for phones only.
  useEffect(() => {
    const menu = menuRef.current
    if (!menu || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(min-width: 900px)')
    const framed = window.self !== window.top
    const sync = () => { if (mq.matches || framed) menu.open = true }
    sync()
    mq.addEventListener?.('change', sync)
    const onToggle = () => { if (mq.matches && !framed && !menu.open) menu.open = true }
    menu.addEventListener('toggle', onToggle)
    return () => { mq.removeEventListener?.('change', sync); menu.removeEventListener('toggle', onToggle) }
  }, [])

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
    const onScroll = () => document.documentElement.classList.toggle('desk-collapsed', window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', check)
      observer?.disconnect()
      window.removeEventListener('resize', check)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <details ref={menuRef} className="desk-menu">
      <summary className="desk-menu-button" data-testid="desk-menu">Menu</summary>
      <div className={`side-nav-wrap${overflow ? ' overflow' : ''}${atEnd ? ' at-end' : ''}`}>
        <nav ref={ref} className="side-nav" aria-label="Desk" data-testid="side-nav">
          {children}
        </nav>
        {overflow && !atEnd ? (
          <p className="side-nav-more" data-testid="nav-scroll-cue">More below</p>
        ) : null}
      </div>
    </details>
  )
}
