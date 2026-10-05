import { expect, test, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { seedCode } from '../env'
import { skipWelcomeFilms } from './welcome-walk'

test.skip(process.env.HEARTS_R5C_EVIDENCE !== '1', 'Heavy evidence capture. Set HEARTS_R5C_EVIDENCE=1 to run.')

const ROOT = process.env.R5C_ART || path.join(process.cwd(), 'artifacts/r5c-look')
const PHONE = { width: 390, height: 844 }
const DESK = { width: 1440, height: 900 }
const BASE = '/p/east-london'
const TEN = '2026-10-04T10:00:00-04:00'
const EIGHT = '2026-10-04T20:00:00-04:00'
const PICKS: [string, string][] = [['extra', 'pause'], ['queue', 'let-go'], ['thumb', 'lives'], ['visitor', 'spin'], ['news', 'nobody'], ['account', 'lord'], ['doors', 'calmer']]

const LEARNER_ROUTES: [string, string][] = [
  ['door', '/'],
  ['join', `/join?code=${seedCode('elm-learner')}&from=Aisha`],
  ['login', '/login'],
  ['welcome', `${BASE}/welcome?step=start`],
  ['home', BASE],
  ['feed', `${BASE}/feed`],
  ['lanes', `${BASE}/lanes`],
  ['speaker', `${BASE}/speaker/mikaeel-smith`],
  ['course', `${BASE}/course/1`],
  ['garden', `${BASE}/garden`],
  ['garden-general', `${BASE}/garden/general`],
  ['garden-jibril', `${BASE}/garden/jibril`],
  ['garden-door', `${BASE}/garden/jibril/10`],
  ['garden-ghunya', `${BASE}/garden/ghunya`],
  ['garden-harvest', `${BASE}/garden/harvest`],
  ['workbook', `${BASE}/garden/workbook`],
  ['me', `${BASE}/me`],
  ['me-circle', `${BASE}/me/circle`],
  ['me-plan', `${BASE}/me/plan`],
  ['me-settings', `${BASE}/me/settings`],
  ['me-saved', `${BASE}/me/saved`],
  ['me-path', `${BASE}/me/path`],
  ['gather', `${BASE}/gather`],
  ['start', `${BASE}/start`],
]

type ContrastRow = { route: string; href?: string; testid?: string; tag?: string; text: string; ratio: number; need: number; pass: boolean; size: number; weight: number; color: string; bg: string }

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function setClock(page: Page, iso: string) {
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
  const response = await page.request.post('/api/hearts', { form: { action: 'clock', iso, next: '/' }, maxRedirects: 0 })
  expect(response.status(), `clock ${iso}`).toBe(303)
}

async function shot(page: Page, file: string) {
  mkdirSync(path.dirname(file), { recursive: true })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(400)
  await page.screenshot({ path: file, caret: 'initial' })
}

async function captureSwarm(page: Page) {
  await page.goto(`${BASE}/course/3`)
  await expect(page.getByTestId('timeline-dot').first()).toBeVisible()
  await page.getByTestId('timeline-dot').first().click({ force: true })
  await expect(page.getByTestId('popup')).toBeVisible()
  const pointId = Number(await page.getByTestId('popup').getAttribute('data-point'))
  expect(pointId).toBeGreaterThan(0)
  const saved = await page.request.post('/api/answers', {
    headers: { accept: 'application/json' },
    data: { pointId, body: 'I sat with the names after Fajr.', keepPrivate: false, shareWithLearners: true },
  })
  expect(saved.ok(), await saved.text()).toBeTruthy()
  await page.goto(`${BASE}/course/3`)
  await page.getByTestId('timeline-dot').first().click({ force: true })
  await expect(page.getByTestId('popup')).toBeVisible()
  const swarm = page.getByTestId('swarm')
  await expect(swarm).toBeVisible()
  await expect(page.getByTestId('swarm-like-mine')).toBeVisible()
  await swarm.scrollIntoViewIfNeeded()
  await page.getByTestId('swarm-like-mine').click()
  await expect(swarm).toHaveAttribute('data-mode', 'like')
  await swarm.screenshot({ path: path.join(ROOT, 'after', 'swarm-like-mine.png') })
  await page.getByTestId('swarm-surprise').click()
  await expect(swarm).toHaveAttribute('data-mode', 'surprise')
  await swarm.screenshot({ path: path.join(ROOT, 'after', 'swarm-surprise.png') })
}

async function audit(page: Page, route: string, href: string): Promise<ContrastRow[]> {
  return page.evaluate(({ route, href }) => {
    const rgb = (value: string) => (value.match(/[\d.]+/g) || []).map(Number)
    const lum = (c: number[]) => {
      const [r, g, b] = c.slice(0, 3).map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const mix = (fg: number[], bg: number[]) => {
      const a = fg[3] == null || Number.isNaN(fg[3]) ? 1 : fg[3]
      return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a))
    }
    const hexRgb = (hex: string) => {
      const raw = hex.replace('#', '')
      const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6)
      return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
    }
    const paint = (style: CSSStyleDeclaration): number[] | null => {
      const [r, g, b, a = 1] = rgb(style.backgroundColor)
      if (a > 0.6) return [r, g, b]
      const img = style.backgroundImage || ''
      if (img && img !== 'none') {
        const rgba = img.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s\/]+([\d.]+))?\)/)
        if (rgba) {
          const aa = rgba[4] == null ? 1 : Number(rgba[4])
          if (aa > 0.45) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])]
        }
        const hex = img.match(/#([0-9a-f]{3,8})\b/i)
        if (hex) return hexRgb(hex[0])
      }
      return null
    }
    const backing = (el: Element | null): number[] => {
      for (let at = el; at; at = at.parentElement) {
        const found = paint(getComputedStyle(at))
        if (found) return found
      }
      return [14, 42, 43]
    }
    const skip = (el: HTMLElement) => {
      if (el.closest('.sr-only, [hidden], script, style, noscript')) return true
      if (el.getAttribute('aria-hidden') === 'true') return true
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.15) return true
      const box = el.getBoundingClientRect()
      if (box.width < 2 || box.height < 2) return true
      return false
    }
    const rows: Array<{ route: string; href: string; testid: string; tag: string; text: string; ratio: number; need: number; pass: boolean; size: number; weight: number; color: string; bg: string }> = []
    const seen = new Set<string>()
    for (const el of document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, p, a, button, label, span, small, li, td, th, legend, summary, b, em, strong, figcaption')) {
      if (skip(el)) continue
      const first = el.childNodes[0]
      const raw = el.childNodes.length === 1 && first && first.nodeType === 3 ? el.textContent || '' : [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent || '').join('')
      const text = raw.replace(/\s+/g, ' ').trim()
      if (!text || text.length < 2) continue
      const style = getComputedStyle(el)
      const size = parseFloat(style.fontSize)
      const weight = parseInt(style.fontWeight, 10) || 400
      if (!Number.isFinite(size) || size < 10) continue
      const fg = rgb(style.color)
      const bg = backing(el)
      const [hi, lo] = [lum(mix(fg, bg)), lum(bg)].sort((x, y) => y - x)
      const ratio = (hi + 0.05) / (lo + 0.05)
      const large = size >= 24 || (size >= 18.66 && weight >= 700)
      const need = large ? 3 : 4.5
      const key = `${el.tagName}|${text.slice(0, 40)}|${style.color}|${bg.join(',')}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({
        route,
        href,
        testid: el.getAttribute('data-testid') || el.closest('[data-testid]')?.getAttribute('data-testid') || '',
        tag: el.tagName.toLowerCase(),
        text: text.slice(0, 80),
        ratio: Number(ratio.toFixed(2)),
        need,
        pass: ratio + 0.01 >= need,
        size,
        weight,
        color: style.color,
        bg: bg.join(','),
      })
    }
    return rows
  }, { route, href })
}

test.describe.configure({ timeout: 360_000 })

test('contrast at 10:00 and 20:00 Toronto, and the after screenshots', async ({ page }) => {
  mkdirSync(ROOT, { recursive: true })
  const fails: ContrastRow[] = []
  for (const [label, iso] of [['10', TEN], ['20', EIGHT]] as const) {
    await page.setViewportSize(PHONE)
    await setClock(page, iso)
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', BASE)
    await expect(page.getByTestId('home')).toBeVisible()
    const hour: ContrastRow[] = []
    const byRoute: Record<string, ContrastRow[]> = {}
    for (const [name, href] of LEARNER_ROUTES) {
      await page.goto(href)
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(350)
      const rows = await audit(page, name, href)
      byRoute[name] = rows
      hour.push(...rows)
      if (['welcome', 'home', 'lanes', 'workbook', 'me', 'join'].includes(name)) {
        await shot(page, path.join(ROOT, 'after', label, `${name}.png`))
      }
    }
    const hourFails = hour.filter((row) => !row.pass)
    writeFileSync(path.join(ROOT, `contrast-${label}.json`), JSON.stringify({
      when: iso,
      zone: 'America/Toronto',
      routes: Object.fromEntries(Object.entries(byRoute).map(([name, rows]) => [name, {
        href: LEARNER_ROUTES.find(([key]) => key === name)?.[1],
        elements: rows.map((row) => ({ testid: row.testid, tag: row.tag, text: row.text, ratio: row.ratio, need: row.need, pass: row.pass, size: row.size, weight: row.weight, color: row.color, bg: row.bg })),
      }])),
      fails: hourFails,
    }, null, 2))
    fails.push(...hourFails)
    await page.goto(`${BASE}/welcome?step=start`)
    await shot(page, path.join(ROOT, 'after', `welcome-${label}.png`))
    await page.goto(BASE)
    await shot(page, path.join(ROOT, 'after', `home-${label}.png`))
    await page.goto(`${BASE}/lanes`)
    await expect(page.getByTestId('lanes-sub')).toContainText('Paths to walk, one theme at a time.')
    await shot(page, path.join(ROOT, 'after', `lanes-${label}.png`))
    await page.goto(`${BASE}/garden/workbook`)
    await shot(page, path.join(ROOT, 'after', `workbook-${label}.png`))
    await page.goto(`${BASE}/me`)
    await expect(page.getByText('Light', { exact: true })).toHaveCount(0)
    await shot(page, path.join(ROOT, 'after', `me-${label}.png`))
    await page.goto(`/join?code=${seedCode('elm-learner')}&from=Aisha`)
    await expect(page.getByTestId('join-pitch')).toContainText('Idris from East London Mosque invited you')
    await shot(page, path.join(ROOT, 'after', `join-${label}.png`))
    await page.goto(`${BASE}/me/settings`)
    await expect(page.getByText('Light', { exact: true })).toHaveCount(0)
    await expect(page.getByTestId('theme-pin')).toHaveCount(0)
    await shot(page, path.join(ROOT, 'after', `me-settings-${label}.png`))
  }

  await page.setViewportSize(PHONE)
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `${BASE}/lanes`)
  await page.getByTestId('page-help-open').click()
  await expect(page.getByTestId('page-help-sheet')).toBeVisible()
  await shot(page, path.join(ROOT, 'after', 'page-help.png'))

  await page.goto(BASE)
  await expect(page.getByTestId('home')).toBeVisible()
  await page.addStyleTag({ content: '.app::before{height:47px!important;margin-bottom:-47px!important;background:#081c1b!important}.app-head,.main-head{padding-top:47px!important}.app-scroll{padding-top:calc(14px + 47px)!important}' })
  await shot(page, path.join(ROOT, 'after', 'safe-area-standalone.png'))

  await captureSwarm(page)

  await page.setViewportSize(DESK)
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `${BASE}/admin/compass`)
  await expect(page.getByRole('heading', { name: 'Compass' }).first()).toBeVisible()
  await shot(page, path.join(ROOT, 'after', 'compass-live.png'))
  await page.goto(`${BASE}/admin/compass/proposed`)
  await expect(page.getByTestId('compass-proposed')).toBeVisible()
  await expect(page.getByTestId('privacy-flag')).toContainText('off')
  await shot(page, path.join(ROOT, 'after', 'compass-proposed.png'))

  writeFileSync(path.join(ROOT, 'contrast-summary.md'), `# Contrast\n\nPer-route, per-element ratios at 10:00 and 20:00 America/Toronto are in contrast-10.json and contrast-20.json.\n\nMeasured fails (${fails.length}):\n\n${fails.length ? fails.map((row) => `- ${row.route}: “${row.text}” ${row.ratio}:1 (need ${row.need}) ${row.color} on ${row.bg}`).join('\n') : 'None.'}\n`)
  expect(fails.filter((row) => ['home', 'lanes', 'me', 'join'].includes(row.route))).toEqual([])
})

test('swarm Answers like mine and Surprise me', async ({ page }) => {
  mkdirSync(ROOT, { recursive: true })
  await page.setViewportSize(PHONE)
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', BASE)
  await captureSwarm(page)
})

test('a new learner from the join link reaches the first talk', async ({ browser }) => {
  const context = await browser.newContext({ viewport: PHONE, recordVideo: { dir: ROOT, size: PHONE } })
  const page = await context.newPage()
  await page.addInitScript(() => {
    const hide = () => document.querySelectorAll('nextjs-portal, [data-nextjs-toast], [data-next-mark]').forEach((node) => node.remove())
    hide()
    new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true })
  })
  await page.addStyleTag({ content: 'nextjs-portal,[data-nextjs-toast],[data-next-mark]{display:none!important}' }).catch(() => {})
  await page.route(/youtube\.com|ytimg|googlevideo|doubleclick/, (route) => route.abort())
  const stamp = Date.now().toString().slice(-8)
  await page.goto(`/join?code=${seedCode('elm-learner')}&from=Aisha`)
  await expect(page.getByTestId('join-pitch')).toContainText('Idris from East London Mosque invited you')
  await page.getByTestId('join-name').fill(`Nora ${stamp}`)
  await page.getByTestId('join-email').fill(`nora-${stamp}@hearts.test`)
  await page.getByTestId('join-password').fill('harbour-learner')
  await page.getByTestId('join-submit').click()
  await page.waitForURL(/\/p\/east-london/)
  await skipWelcomeFilms(page)
  if (!page.url().includes('/start')) await page.goto(`${BASE}/start`)
  await expect(page.getByTestId('lets-play')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('opener-heading')).toHaveText('A calm place to start')
  await page.waitForTimeout(900)
  await page.getByTestId('lets-play').click()
  for (const [scene, option] of PICKS) {
    const card = page.locator(`[data-testid="scene"][data-scene="${scene}"]`)
    await expect(card.first()).toBeVisible({ timeout: 15_000 })
    await card.last().locator(`[data-testid="tile"][data-option="${option}"]`).click()
  }
  await expect(page.getByTestId('journey')).toHaveAttribute('data-phase', 'feed', { timeout: 25_000 })
  await expect(page.getByTestId('poster-title')).toHaveCount(0)
  if (await page.getByTestId('learn-more').count()) await page.getByTestId('learn-more').click()
  await page.waitForTimeout(1400)
  const video = page.video()
  await context.close()
  if (video) {
    const from = await video.path()
    copyFileSync(from, path.join(ROOT, 'join-to-first-talk.webm'))
    try {
      execFileSync('ffmpeg', ['-y', '-i', from, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', path.join(ROOT, 'join-to-first-talk.mp4')], { stdio: 'pipe' })
    } catch {
      copyFileSync(from, path.join(ROOT, 'join-to-first-talk.mp4'))
    }
  }
})
