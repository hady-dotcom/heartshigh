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
}

/** Pin Dawn or Evening on this phone. Auto follows local time, with the same rules as the boot script. */
export function ThemePinControl() {
  const [pin, setPin] = useState<ThemePin>('auto')
  const [ready, setReady] = useState(false)
  useEffect(() => {
    try {
      setPin(readPin(localStorage.getItem(THEME_STORAGE_KEY)))
    } catch {
      setPin('auto')
    }
    setReady(true)
  }, [])
  const live = resolveTheme(new Date(), pin)
  return (
    <section className="card theme-pin" data-testid="theme-pin" data-pin={ready ? pin : 'auto'} data-theme={live}>
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
              apply(option.id)
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="muted theme-now">Showing {live === 'dawn' ? 'Dawn' : 'Evening'}.</p>
    </section>
  )
}
