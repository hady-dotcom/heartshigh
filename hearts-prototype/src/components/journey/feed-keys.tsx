'use client'

import { useEffect } from 'react'

/** Arrow keys move the feed; Space pauses. Buttons already exist for each swipe (X02). */
export function FeedKeys() {
  useEffect(() => {
    const click = (id: string) => document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)?.click()
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        click('gesture-next')
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        click('gesture-prev')
      } else if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault()
        click('gesture-pause')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return null
}
