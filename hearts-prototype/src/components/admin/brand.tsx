'use client'

import { useEffect, useRef } from 'react'

/** Admin wordmark and monogram. Text only, in the system font. No image files. */
/** Inline styles only. A style tag inside the step nav is shown, because that bar sets every element to display:block. */

const fontFamily = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif'

export function Logo() {
  return (
    <p
      className="sls-logo"
      style={{
        margin: 0,
        maxWidth: '100%',
        color: 'var(--theme-elevation-1000, #1d1d1f)',
        fontFamily,
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: '-0.022em',
        lineHeight: 1.15,
        textAlign: 'center',
      }}
    >
      Social Learning System
    </p>
  )
}

export function Icon() {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const home = ref.current?.closest('a')
    if (home) home.href = '/admin/cms'
  }, [])
  return (
    <svg
      ref={ref}
      aria-label="Social Learning System"
      className="sls-icon graphic-icon"
      height="18"
      role="img"
      style={{ display: 'block', color: 'var(--theme-elevation-1000, #1d1d1f)' }}
      viewBox="0 0 36 18"
      width="36"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text fill="currentColor" fontFamily="-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif" fontSize="13" fontWeight="600" textAnchor="middle" x="18" y="14">
        SLS
      </text>
    </svg>
  )
}
