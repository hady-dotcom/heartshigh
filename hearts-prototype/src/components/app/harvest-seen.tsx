'use client'

import { useEffect } from 'react'

/** Remember this visit after the page has drawn, so lines gathered before it can still show as new. */
export function HarvestSeen({ at }: { at: string }) {
  useEffect(() => {
    document.cookie = `hearts_harvest_seen=${encodeURIComponent(at)}; Path=/; Max-Age=31536000; SameSite=Lax`
  }, [at])
  return null
}
