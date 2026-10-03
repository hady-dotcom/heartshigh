/**
 * Dawn and Evening, from one clock.
 *
 * Dawn runs from about Fajr until mid-afternoon. Evening runs from late afternoon through the night.
 * Pass `prayers` when a timetable is available; until then the fallback minutes stand in for Fajr and Asr.
 * A pin of "dawn" or "evening" always wins over the clock.
 */

export type HeartsTheme = 'dawn' | 'evening'
export type ThemePin = 'auto' | HeartsTheme

export const THEME_STORAGE_KEY = 'hearts.theme'

/** Local minutes from midnight. A stand-in for Fajr until prayer times are wired in. */
export const FALLBACK_FAJR_MINUTES = 5 * 60
/** Local minutes from midnight. A stand-in for late afternoon until Asr is wired in. */
export const FALLBACK_ASR_MINUTES = 16 * 60

export type PrayerMarks = {
  /** Local minutes from midnight when Dawn begins. */
  fajr?: number
  /** Local minutes from midnight when Evening begins. */
  asr?: number
}

function mark(value: number | undefined, fallback: number) {
  if (value == null || !Number.isFinite(value)) return fallback
  const minutes = Math.round(value)
  if (minutes < 0 || minutes >= 24 * 60) return fallback
  return minutes
}

export function resolveTheme(at: Date, pin: ThemePin = 'auto', prayers?: PrayerMarks): HeartsTheme {
  if (pin === 'dawn' || pin === 'evening') return pin
  const fajr = mark(prayers?.fajr, FALLBACK_FAJR_MINUTES)
  let asr = mark(prayers?.asr, FALLBACK_ASR_MINUTES)
  if (asr <= fajr) asr = FALLBACK_ASR_MINUTES
  const start = asr > fajr ? fajr : FALLBACK_FAJR_MINUTES
  const minutes = at.getHours() * 60 + at.getMinutes()
  return minutes >= start && minutes < asr ? 'dawn' : 'evening'
}

export function readPin(raw: string | null | undefined): ThemePin {
  if (raw == null || raw === '' || raw === 'auto') return 'auto'
  const plain = raw.replace(/^"|"$/g, '')
  if (plain === 'dawn' || plain === 'evening' || plain === 'auto') return plain
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed === 'dawn' || parsed === 'evening' || parsed === 'auto') return parsed
  } catch {
    // Not JSON. The plain check above already covered the stored words.
  }
  return 'auto'
}

/** Runs before first paint. Same storage key and the same fallback minutes as resolveTheme. */
export function themeBootScript() {
  const key = JSON.stringify(THEME_STORAGE_KEY)
  return `(function(){try{var raw=localStorage.getItem(${key});var pin='auto';if(raw==='dawn'||raw==='evening'||raw==='auto')pin=raw;else if(raw){try{var p=JSON.parse(raw);if(p==='dawn'||p==='evening'||p==='auto')pin=p}catch(e){}}if(pin!=='dawn'&&pin!=='evening'){var d=new Date();var m=d.getHours()*60+d.getMinutes();pin=(m>=${FALLBACK_FAJR_MINUTES}&&m<${FALLBACK_ASR_MINUTES})?'dawn':'evening'}document.documentElement.dataset.theme=pin;document.documentElement.style.colorScheme=pin==='dawn'?'light':'dark'}catch(e){document.documentElement.dataset.theme='evening'}})();`
}
