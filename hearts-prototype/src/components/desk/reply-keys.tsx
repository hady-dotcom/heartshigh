'use client'

import { useEffect } from 'react'

/** Laptop keys for the reply queue. J and K move between cards. Ctrl+Enter or Cmd+Enter sends. */
export function ReplyKeys({ nextHref, prevHref }: { nextHref: string; prevHref: string }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      const typing = Boolean(target && (target.closest('textarea, input, select, [contenteditable="true"]')))
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        const form = document.querySelector<HTMLFormElement>('[data-testid="queue-send-form"]')
        if (!form) return
        event.preventDefault()
        form.requestSubmit()
        return
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return
      const href = event.key === 'j' || event.key === 'J' ? nextHref : event.key === 'k' || event.key === 'K' ? prevHref : ''
      if (!href) return
      event.preventDefault()
      window.location.assign(href)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nextHref, prevHref])
  return null
}
