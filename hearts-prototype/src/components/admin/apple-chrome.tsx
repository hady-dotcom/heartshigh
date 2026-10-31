'use client'

import { useEffect, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import { applyAppleLook, watchArtwork } from '@/lib/apple-look'

/** Scroll-collapse and the phone menu for the data console. It does not change fields or saves. */
export function AppleAdminChrome() {
  const path = usePathname()
  useLayoutEffect(() => {
    applyAppleLook()
    return watchArtwork()
  }, [path])
  useEffect(() => {
    const onScroll = () => {
      document.documentElement.classList.toggle('hig-collapsed', window.scrollY > 12)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <button
      type="button"
      className="hig-menu"
      data-testid="cms-menu"
      onClick={() => {
        document.documentElement.classList.toggle('hig-nav-open')
        document.querySelector('.template-default')?.classList.toggle('template-default--nav-open')
      }}
    >
      Menu
    </button>
  )
}
