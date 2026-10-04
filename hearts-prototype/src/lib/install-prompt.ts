/**
 * First-open guidance for adding HEARTS to the home screen.
 * The card is skippable. Once it is dismissed, or the app is installed, it stays hidden
 * until someone opens it again from Me. An installed app (standalone) never shows the steps.
 */

export const INSTALL_DISMISSED_KEY = 'hearts.install.dismissed'
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

const PHONE_HEADING = 'Keep HEARTS on your phone'
const COMPUTER_HEADING = 'Keep HEARTS on this computer'
const LEAD = 'It then opens full screen, with no browser bars.'

const IOS_STEPS: InstallCopy['steps'] = [
  { glyph: 'share', text: 'Tap Share at the bottom of Safari.' },
  { glyph: 'add', text: 'Tap Add to Home Screen, then Add.' },
]

const ANDROID_STEPS: InstallCopy['steps'] = [
  { glyph: 'menu', text: 'Tap the menu, the three dots at the top of Chrome.' },
  { glyph: 'add', text: 'Tap Install app, or Add to Home screen.' },
]

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

export function installCopy(kind: InstallKind, prompt: boolean): InstallCopy {
  if (kind === 'desktop') {
    return {
      heading: COMPUTER_HEADING,
      lead: LEAD,
      steps: [],
      action: prompt ? 'Install HEARTS' : undefined,
      manual: prompt ? undefined : 'Look for the install icon in the address bar, or open the browser menu and choose Install HEARTS.',
    }
  }
  const phone = kind === 'android-chrome' || kind === 'android-other'
  if (phone && prompt) {
    return { heading: PHONE_HEADING, lead: LEAD, steps: [], action: 'Add HEARTS' }
  }
  if (phone) {
    const steps = kind === 'android-other'
      ? [
          { glyph: 'menu' as const, text: 'Tap the menu in your browser.' },
          { glyph: 'add' as const, text: 'Tap Install app, or Add to Home screen.' },
        ]
      : ANDROID_STEPS
    return { heading: PHONE_HEADING, lead: LEAD, steps }
  }
  return {
    heading: PHONE_HEADING,
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
      { id: 'ios-home', caption: 'HEARTS lands on your home screen.' },
    ]
  }
  if (kind === 'android-chrome') {
    return [
      { id: 'android-menu', caption: 'Tap the menu, the three dots at the top.' },
      { id: 'android-install', caption: 'Tap Install app.' },
      { id: 'android-home', caption: 'HEARTS lands on your home screen.' },
    ]
  }
  if (kind === 'android-other') {
    return [
      { id: 'android-menu', caption: 'Tap the menu in your browser.' },
      { id: 'android-install', caption: 'Tap Install app, or Add to Home screen.' },
      { id: 'android-home', caption: 'HEARTS lands on your home screen.' },
    ]
  }
  return []
}

export function installEntry(kind: InstallKind, installed: boolean) {
  const computer = kind === 'desktop'
  if (installed) {
    return {
      title: computer ? 'HEARTS is on this computer' : 'HEARTS is on this phone',
      hint: 'It opens full screen, with no browser bars.',
    }
  }
  return computer
    ? { title: COMPUTER_HEADING, hint: 'Install it so it opens full screen' }
    : { title: PHONE_HEADING, hint: 'Add it to your home screen' }
}

export function readInstallFlags(storage: { getItem(key: string): string | null } | null) {
  if (!storage) return { dismissed: false, installed: false }
  return {
    dismissed: storage.getItem(INSTALL_DISMISSED_KEY) === '1',
    installed: storage.getItem(INSTALL_INSTALLED_KEY) === '1',
  }
}

/** Captures the browser install event before React hydrates. Leaves a test stub in place. */
export function installBootScript() {
  const installed = JSON.stringify(INSTALL_INSTALLED_KEY)
  return `(function(){try{window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__heartsBeforeInstall=e;window.dispatchEvent(new Event('hearts-install-ready'))});window.addEventListener('appinstalled',function(){try{localStorage.setItem(${installed},'1')}catch(err){}window.__heartsBeforeInstall=null;window.dispatchEvent(new Event('hearts-installed'))})}catch(e){}})();`
}
