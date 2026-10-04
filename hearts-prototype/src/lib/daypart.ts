/**
 * Evening garden at every hour.
 * Dawn is retired. A leftover pin of "dawn" is ignored and cleared on boot.
 */

export type HeartsTheme = 'evening'
export type ThemePin = 'auto' | 'evening' | 'dawn'

export const THEME_STORAGE_KEY = 'hearts.theme'

/** Kept so older tests and callers that still pass prayer marks compile. Unused. */
export const FALLBACK_FAJR_MINUTES = 5 * 60
export const FALLBACK_ASR_MINUTES = 16 * 60

export type PrayerMarks = {
  fajr?: number
  asr?: number
}

export function resolveTheme(_at?: Date, _pin?: ThemePin, _prayers?: PrayerMarks): HeartsTheme {
  return 'evening'
}

export function readPin(raw: string | null | undefined): ThemePin {
  if (raw == null || raw === '' || raw === 'auto') return 'auto'
  const plain = raw.replace(/^"|"$/g, '')
  if (plain === 'evening' || plain === 'auto') return plain
  if (plain === 'dawn') return 'auto'
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed === 'evening' || parsed === 'auto') return parsed
  } catch {
    // Not JSON.
  }
  return 'auto'
}

/** Runs before first paint. Always evening. Clears a stored dawn pin so it cannot come back. */
export function themeBootScript() {
  const key = JSON.stringify(THEME_STORAGE_KEY)
  return `(function(){try{var raw=localStorage.getItem(${key});if(raw==='dawn'||raw==='"dawn"')localStorage.removeItem(${key});document.documentElement.dataset.theme='evening';document.documentElement.style.colorScheme='dark'}catch(e){document.documentElement.dataset.theme='evening';document.documentElement.style.colorScheme='dark'}})();`
}
