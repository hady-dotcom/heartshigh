'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/** Fades the inline title in once the large title has scrolled under the glass bar. */
export function ScrollChrome() {
  const path = usePathname()
  useEffect(() => {
    const stage = document.querySelector('.app-stage.shell-modern')
    if (!stage) return
    const title = stage.querySelector('.bar-title')
    const read = () => {
      const heading = stage.querySelector('.app-scroll h1')
      if (title) title.textContent = (heading?.textContent || '').replace(/\s+/g, ' ').trim()
    }
    const onScroll = () => {
      stage.classList.toggle('title-collapsed', window.scrollY > 36)
    }
    read()
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    const later = window.setTimeout(read, 60)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(later)
    }
  }, [path])
  return null
}
