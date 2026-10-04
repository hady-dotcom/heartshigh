'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/** A short fade and slide when the route changes, so a tap does not cut. */
export function RouteFade({ children }: { children: ReactNode }) {
  const path = usePathname()
  return (
    <div key={path} className="route-fade">
      {children}
    </div>
  )
}
