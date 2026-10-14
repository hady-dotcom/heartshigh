'use client'

import { useEffect } from 'react'

/** Keeps a demo-stage frame on the read-only flag, and stops its forms from saving. */
export function StageFrameGuard() {
  useEffect(() => {
    if (window.parent === window) return
    let staged = false
    try {
      staged = new URL(window.location.href).searchParams.get('stage') === '1'
    } catch {
      staged = false
    }
    if (!staged) return

    const push = history.pushState.bind(history)
    const replace = history.replaceState.bind(history)
    const keep = () => {
      const url = new URL(window.location.href)
      if (url.searchParams.get('stage') === '1') return
      url.searchParams.set('stage', '1')
      replace(history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }
    history.pushState = ((...args: Parameters<History['pushState']>) => {
      push(...args)
      keep()
    }) as History['pushState']
    history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      replace(...args)
      keep()
    }) as History['replaceState']

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = (event.target as Element | null)?.closest?.('a')
      if (!link) return
      const href = link.getAttribute('href')
      if (!href || href.startsWith('#') || link.target === '_blank') return
      let next: URL
      try {
        next = new URL(href, window.location.href)
      } catch {
        return
      }
      if (next.origin !== window.location.origin || next.searchParams.get('stage') === '1') return
      next.searchParams.set('stage', '1')
      link.setAttribute('href', `${next.pathname}${next.search}${next.hash}`)
    }
    const onSubmit = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('click', onClick, true)
    document.addEventListener('submit', onSubmit, true)
    return () => {
      history.pushState = push as History['pushState']
      history.replaceState = replace as History['replaceState']
      window.removeEventListener('click', onClick, true)
      document.removeEventListener('submit', onSubmit, true)
    }
  }, [])
  return null
}
