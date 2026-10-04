'use client'

import { useEffect, useState } from 'react'
import { THEME_STORAGE_KEY, readPin, resolveTheme, type ThemePin } from '@/lib/daypart'

const OPTIONS: { id: ThemePin; label: string }[] = [
  { id: 'auto', label: 'Follow the day' },
  { id: 'dawn', label: 'Dawn' },
  { id: 'evening', label: 'Evening' },
]

function apply(pin: ThemePin) {
  const theme = resolveTheme(new Date(), pin)
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme === 'dawn' ? 'light' : 'dark'
  try {
    if (pin === 'auto') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(pin))
  } catch {
    // Private browsing still gets the theme for this visit.
  }
  return theme
}

/** Pin Dawn or Evening on this phone. Auto follows local time, with the same rules as the boot script. */
export function ThemePinControl() {
  const [pin, setPin] = useState<ThemePin>('auto')
  // The time of day is read on the phone only: the server's clock is UTC, so a server label would not match.
  const [live, setLive] = useState<'dawn' | 'evening' | null>(null)
  useEffect(() => {
    let stored: ThemePin = 'auto'
    try {
      stored = readPin(localStorage.getItem(THEME_STORAGE_KEY))
    } catch {
      stored = 'auto'
    }
    setPin(stored)
    const theme = resolveTheme(new Date(), stored)
    setLive(theme)
    if (document.documentElement.dataset.theme !== theme) {
      document.documentElement.dataset.theme = theme
      document.documentElement.style.colorScheme = theme === 'dawn' ? 'light' : 'dark'
    }
  }, [])
  return (
    <section className="card theme-pin" data-testid="theme-pin" data-pin={live ? pin : 'auto'} data-theme={live || undefined}>
      <h3>Light</h3>
      <p>Dawn from early morning until mid-afternoon, and evening after that. Pin one if you would rather it stayed.</p>
      <div className="theme-pin-row" role="group" aria-label="Light">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`chip theme-choice${pin === option.id ? ' on' : ''}`}
            aria-pressed={pin === option.id}
            data-testid={`theme-${option.id}`}
            onClick={() => {
              setPin(option.id)
              setLive(apply(option.id))
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="muted theme-now" data-testid="theme-now">{live ? `Showing ${live === 'dawn' ? 'Dawn' : 'Evening'}.` : '\u00a0'}</p>
    </section>
  )
}
