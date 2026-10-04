import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  INSTALL_DISMISS_MS,
  INSTALL_INSTALLED_KEY,
  installBootScript,
  installCopy,
  installEntry,
  installKind,
  installSlides,
  installSurface,
  isInstallDismissed,
  offersInstallButton,
  shouldShowInstall,
} from './install-prompt'

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1'
const FIREFOX_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36'
const SAMSUNG = 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.6167.164 Mobile Safari/537.36'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

test('install kind distinguishes Safari, other iOS browsers, Android Chrome and desktop', () => {
  assert.equal(installKind(SAFARI), 'ios-safari')
  assert.equal(installKind(CHROME_IOS), 'ios-other')
  assert.equal(installKind(FIREFOX_IOS), 'ios-other')
  assert.equal(installKind(IPAD, { maxTouchPoints: 5 }), 'ios-safari')
  assert.equal(installKind(IPAD, { maxTouchPoints: 0 }), 'desktop')
  assert.equal(installKind(ANDROID), 'android-chrome')
  assert.equal(installKind(SAMSUNG), 'android-other')
  assert.equal(installKind(DESKTOP), 'desktop')
  assert.equal(offersInstallButton('android-chrome'), true)
  assert.equal(offersInstallButton('ios-safari'), false)
})

test('the card stays hidden once dismissed, installed, or opened full screen', () => {
  assert.equal(shouldShowInstall({ standalone: false, dismissed: false, installed: false, forced: false }), true)
  assert.equal(shouldShowInstall({ standalone: false, dismissed: true, installed: false, forced: false }), false)
  assert.equal(shouldShowInstall({ standalone: false, dismissed: true, installed: false, forced: true }), true)
  assert.equal(shouldShowInstall({ standalone: false, dismissed: false, installed: true, forced: true }), false)
  assert.equal(shouldShowInstall({ standalone: true, dismissed: false, installed: false, forced: true }), false)
})

test('a dismiss lasts 14 days, then the strip can show again', () => {
  const now = Date.parse('2026-10-04T12:00:00Z')
  assert.equal(isInstallDismissed(null, now), false)
  assert.equal(isInstallDismissed('1', now), true)
  assert.equal(isInstallDismissed(String(now + INSTALL_DISMISS_MS), now), true)
  assert.equal(isInstallDismissed(String(now + 1000), now), true)
  assert.equal(isInstallDismissed(String(now - 1000), now), false)
})

test('a narrow or touch surface says phone even when the browser looks like a desktop', () => {
  assert.equal(installSurface('desktop'), 'computer')
  assert.equal(installSurface('desktop', { narrow: true }), 'phone')
  assert.equal(installSurface('desktop', { coarse: true }), 'phone')
  assert.equal(installSurface('ios-safari'), 'phone')
  assert.equal(installCopy('desktop', false, 'phone').heading, 'Keep HEARTS on your phone')
  assert.match(installCopy('desktop', false, 'phone').steps[0].text, /Share/)
  assert.match(installCopy('desktop', false, 'phone').steps[1].text, /Install/)
})

test('copy is the two iPhone steps, an Android install button, or the menu', () => {
  const safari = installCopy('ios-safari', false)
  assert.equal(safari.heading, 'Keep HEARTS on your phone')
  assert.equal(safari.lead, 'It then opens full screen, with no browser bars.')
  assert.equal(safari.note, undefined)
  assert.deepEqual(safari.steps.map((step) => step.glyph), ['share', 'add'])
  assert.match(safari.steps[0].text, /Share/)
  assert.match(safari.steps[1].text, /Add to Home Screen/)

  const other = installCopy('ios-other', false)
  assert.match(other.note || '', /Safari/)
  assert.equal(other.steps.length, 2)

  const prompted = installCopy('android-chrome', true)
  assert.equal(prompted.action, 'Add HEARTS')
  assert.equal(prompted.steps.length, 0)

  const menu = installCopy('android-chrome', false)
  assert.match(menu.steps[0].text, /three dots/)
  assert.match(menu.steps[1].text, /Install/)

  const desktop = installCopy('desktop', true)
  assert.equal(desktop.heading, 'Keep HEARTS on this computer')
  assert.equal(desktop.action, 'Install HEARTS')
  assert.match(installCopy('desktop', false).manual || '', /address bar/)

  assert.equal(installEntry('ios-safari', false).title, 'Keep HEARTS on your phone')
  assert.equal(installEntry('ios-safari', true).title, 'HEARTS is on this phone')
  assert.equal(installEntry('desktop', true).title, 'HEARTS is on this computer')
})

test('a phone card is a row of pictured steps, one slide each', () => {
  const ios = installSlides('ios-safari')
  assert.deepEqual(ios.map((slide) => slide.id), ['ios-share', 'ios-sheet', 'ios-add', 'ios-home'])
  assert.match(ios[0].caption, /Share/)
  assert.match(ios[1].caption, /Add to Home Screen/)
  assert.match(ios[2].caption, /^Tap Add/)
  assert.match(ios[3].caption, /home screen/)
  assert.equal(installSlides('ios-other').length, 4)
  const android = installSlides('android-chrome')
  assert.deepEqual(android.map((slide) => slide.id), ['android-menu', 'android-install', 'android-home'])
  assert.match(android[0].caption, /three dots/)
  assert.match(android[1].caption, /Install/)
  assert.match(installSlides('android-other')[0].caption, /menu/)
  assert.equal(installSlides('desktop').length, 0)
})

test('the boot script holds the install prompt and remembers when the app is installed', () => {
  const script = installBootScript()
  assert.match(script, /beforeinstallprompt/)
  assert.match(script, /preventDefault/)
  assert.match(script, /appinstalled/)
  assert.match(script, new RegExp(INSTALL_INSTALLED_KEY.replace('.', '\\.')))
  assert.doesNotMatch(script, /__heartsBeforeInstall=null;window.addEventListener/)
})
