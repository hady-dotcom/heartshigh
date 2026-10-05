/**
 * First-open guidance for adding Hady Core to the home screen.
 * The Home strip is skippable. Once dismissed it stays hidden for 14 days,
 * unless someone opens it again from Me. An installed app (standalone) never shows the steps.
 */

export const INSTALL_DISMISSED_KEY = 'hearts.install.dismissed'
export const INSTALL_DISMISS_MS = 14 * 24 * 60 * 60 * 1000
export const INSTALL_HIDE_MS = INSTALL_DISMISS_MS

/** Epoch ms until which a dismissal hides the strip. */
export function dismissUntil(now = Date.now()) {
  return String(now + INSTALL_HIDE_MS)
}

/** True while a stored dismissal is still inside its 14 days. A legacy `'1'` counts as dismissed. */
export function installHidden(raw: string | null | undefined, now = Date.now()) {
  if (!raw) return false
  if (raw === '1') return true
  const until = Number(raw)
  return Number.isFinite(until) && until > now
}

/** Same window as installHidden; kept for tests that store a dismiss time. */
export function isInstallDismissed(raw: string | null, now = Date.now()) {
  return installHidden(raw, now)
}

export const INSTALL_INSTALLED_KEY = 'hearts.install.installed'
export const INSTALL_SKIP = 'Not now'
export const INSTALL_AGAIN = 'Show me again'

export type InstallSlideId = 'ios-share' | 'ios-sheet' | 'ios-add' | 'ios-home' | 'android-menu' | 'android-install' | 'android-home'

export type InstallSlide = { id: InstallSlideId; caption: string }

export type InstallKind = 'ios-safari' | 'ios-other' | 'android-chrome' | 'android-other' | 'desktop'
export type InstallGlyph = 'share' | 'add' | 'menu'

export type InstallCopy = {
  heading: string
  lead: string
  note?: string
  steps: { glyph: InstallGlyph; text: string }[]
  action?: string
  manual?: string
}

export type HeldInstallPrompt = {
  prompt: () => Promise<void>
  userChoice?: Promise<{ outcome?: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __heartsBeforeInstall?: HeldInstallPrompt | null
  }
}

const PHONE_HEADING = 'Keep Hady Core on your phone'
const COMPUTER_HEADING = 'Keep Hady Core on this computer'
const LEAD = 'It then opens full screen, with no browser bars.'

const IOS_STEPS: InstallCopy['steps'] = [
  { glyph: 'share', text: 'Tap Share at the bottom of Safari.' },
  { glyph: 'add', text: 'Tap Add to Home Screen, then Add.' },
]

const ANDROID_STEPS: InstallCopy['steps'] = [
  { glyph: 'menu', text: 'Tap the menu, the three dots at the top of Chrome.' },
  { glyph: 'add', text: 'Tap Install.' },
]

const GENERIC_PHONE_STEPS: InstallCopy['steps'] = [
  { glyph: 'share', text: 'On iPhone, tap Share in Safari, then Add to Home Screen.' },
  { glyph: 'menu', text: 'On Android, tap the Chrome menu, then Install.' },
]

export function installSurface(kind: InstallKind, opts?: { narrow?: boolean; coarse?: boolean }): 'phone' | 'computer' {
  if (kind !== 'desktop') return 'phone'
  if (opts?.narrow || opts?.coarse) return 'phone'
  return 'computer'
}

/** iPhone and iPad, including iPad desktop mode (Macintosh with a touch screen). */
export function installKind(ua: string, opts?: { maxTouchPoints?: number; narrow?: boolean }): InstallKind {
  const touch = opts?.maxTouchPoints ?? 0
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1)
  if (ios) {
    const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo/.test(ua)
    const safari = /Safari/.test(ua) && /Version\//.test(ua) && !otherBrowser
    return safari ? 'ios-safari' : 'ios-other'
  }
  if (/Android/i.test(ua)) {
    const chrome = /Chrome\//.test(ua) && !/EdgA|SamsungBrowser|OPR|UCBrowser|Firefox/.test(ua) && !/\bwv\b/.test(ua)
    return chrome ? 'android-chrome' : 'android-other'
  }
  if (opts?.narrow) return 'android-other'
  return 'desktop'
}

export function shouldShowInstall(state: { standalone: boolean; dismissed: boolean; installed: boolean; forced: boolean }) {
  if (state.standalone || state.installed) return false
  if (state.forced) return true
  return !state.dismissed
}

export function isDisplayStandalone(matchMediaStandalone: boolean, navigatorStandalone?: boolean) {
  return Boolean(matchMediaStandalone || navigatorStandalone)
}

export function hasInstallPrompt(value: { prompt?: unknown } | null | undefined) {
  return typeof value?.prompt === 'function'
}

/** Chromium can offer a one-tap install. iOS never does. */
export function offersInstallButton(kind: InstallKind) {
  return kind === 'android-chrome' || kind === 'android-other' || kind === 'desktop'
}

export function installCopy(kind: InstallKind, prompt: boolean, surface: 'phone' | 'computer' = kind === 'desktop' ? 'computer' : 'phone'): InstallCopy {
  const heading = surface === 'phone' ? PHONE_HEADING : COMPUTER_HEADING
  if (kind === 'desktop') {
    if (surface === 'phone') {
      return { heading, lead: LEAD, steps: GENERIC_PHONE_STEPS }
    }
    return {
      heading,
      lead: LEAD,
      steps: [],
      action: prompt ? 'Install Hady Core' : undefined,
      manual: prompt ? undefined : 'Look for the install icon in the address bar, or open the browser menu and choose Install Hady Core.',
    }
  }
  const phone = kind === 'android-chrome' || kind === 'android-other'
  if (phone && prompt) {
    return { heading, lead: LEAD, steps: [], action: 'Add Hady Core' }
  }
  if (phone) {
    const steps = kind === 'android-other'
      ? [
          { glyph: 'menu' as const, text: 'Tap the menu in your browser.' },
          { glyph: 'add' as const, text: 'Tap Install.' },
        ]
      : ANDROID_STEPS
    return { heading, lead: LEAD, steps }
  }
  return {
    heading,
    lead: LEAD,
    note: kind === 'ios-other' ? 'Open this page in Safari first. That is the browser that can add it.' : undefined,
    steps: IOS_STEPS,
  }
}

/** One pictured step per slide. Desktop has no phone to draw. */
export function installSlides(kind: InstallKind): InstallSlide[] {
  if (kind === 'ios-safari' || kind === 'ios-other') {
    return [
      { id: 'ios-share', caption: 'Tap Share at the bottom of Safari.' },
      { id: 'ios-sheet', caption: 'Tap Add to Home Screen.' },
      { id: 'ios-add', caption: 'Tap Add.' },
      { id: 'ios-home', caption: 'Hady Core lands on your home screen.' },
    ]
  }
  if (kind === 'android-chrome') {
    return [
      { id: 'android-menu', caption: 'Tap the menu, the three dots at the top.' },
      { id: 'android-install', caption: 'Tap Install.' },
      { id: 'android-home', caption: 'Hady Core lands on your home screen.' },
    ]
  }
  if (kind === 'android-other') {
    return [
      { id: 'android-menu', caption: 'Tap the menu in your browser.' },
      { id: 'android-install', caption: 'Tap Install.' },
      { id: 'android-home', caption: 'Hady Core lands on your home screen.' },
    ]
  }
  return []
}

export function installEntry(kind: InstallKind, installed: boolean, surface: 'phone' | 'computer' = kind === 'desktop' ? 'computer' : 'phone') {
  const computer = surface === 'computer'
  if (installed) {
    return {
      title: computer ? 'Hady Core is on this computer' : 'Hady Core is on this phone',
      hint: 'It opens full screen, with no browser bars.',
    }
  }
  return computer
    ? { title: COMPUTER_HEADING, hint: 'Install it so it opens full screen' }
    : { title: PHONE_HEADING, hint: 'Add it to your home screen' }
}

export function readInstallFlags(storage: { getItem(key: string): string | null } | null, cookie = '', now = Date.now()) {
  if (!storage && !cookie) return { dismissed: false, installed: false }
  const fromCookie = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${INSTALL_DISMISSED_KEY}=`))
    ?.slice(INSTALL_DISMISSED_KEY.length + 1)
  return {
    dismissed: installHidden(storage?.getItem(INSTALL_DISMISSED_KEY), now) || installHidden(fromCookie ? decodeURIComponent(fromCookie) : null, now),
    installed: storage?.getItem(INSTALL_INSTALLED_KEY) === '1',
  }
}

/** Captures the browser install event before React hydrates. Leaves a test stub in place. */
export function installBootScript() {
  const installed = JSON.stringify(INSTALL_INSTALLED_KEY)
  return `(function(){try{window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__heartsBeforeInstall=e;window.dispatchEvent(new Event('hearts-install-ready'))});window.addEventListener('appinstalled',function(){try{localStorage.setItem(${installed},'1')}catch(err){}window.__heartsBeforeInstall=null;window.dispatchEvent(new Event('hearts-installed'))})}catch(e){}})();`
}
