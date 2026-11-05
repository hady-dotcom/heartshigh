'use client'

import { useEffect } from 'react'

/** Reloads a running job page so the counts move without a second click. */
export function JobPoll({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => window.location.reload(), 1200)
    return () => window.clearInterval(timer)
  }, [active])
  return null
}
