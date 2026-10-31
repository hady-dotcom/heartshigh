'use client'

import { useLayoutEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { applyAppleLook, watchArtwork } from '@/lib/apple-look'

/** Paints the learner look for this URL. It does not change saves or fields. */
export function AppleLook() {
  const path = usePathname()
  const search = useSearchParams()
  useLayoutEffect(() => {
    applyAppleLook()
    return watchArtwork()
  }, [path, search])
  return null
}
