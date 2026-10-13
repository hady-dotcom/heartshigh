import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const SHOTS = process.env.DESK_NAV_SHOTS || '/opt/cursor/artifacts/desk-nav'
const VIEWS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 844 },
] as const

const SKIP_PRIMARY = new Set(['codes', 'ai'])

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

function slug(href: string) {
  return href.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

async function healthy(page: Page, where: string) {
  await expect(page.getByTestId('error'), where).toHaveCount(0)
  const body = await page.locator('body').innerText()
  expect(body, where).not.toMatch(/coming soon/i)
  expect(body, where).not.toMatch(/Application error/i)
  expect(body, where).not.toMatch(/Internal Server Error/)
}

async function walk(page: Page, home: string, view: string) {
  mkdirSync(SHOTS, { recursive: true })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(home)
  await expect(page.getByTestId('desk-nav')).toBeVisible()
  const links = page.locator('[data-testid="desk-nav"] a.nav')
  const hrefs = await links.evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).getAttribute('href') || '').filter(Boolean))
  expect(hrefs.length).toBeGreaterThan(8)
  for (const href of hrefs) {
    const item = page.locator(`[data-testid="desk-nav"] a.nav[href="${href}"]`)
    await item.scrollIntoViewIfNeeded()
    const key = ((await item.getAttribute('data-testid')) || '').replace('nav-', '')
    await item.click()
    await page.waitForURL((url) => url.pathname + url.search === href || url.pathname === href.split('?')[0])
    await healthy(page, href)
    await expect(page.getByTestId('desk-purpose').or(page.locator('.main-head h1')).first()).toBeVisible()
    if (!SKIP_PRIMARY.has(key)) {
      const primary = page.getByTestId('primary-action')
      await expect(primary, href).toBeVisible()
      const target = await primary.getAttribute('href')
      await primary.click()
      if (target && !target.startsWith('#')) {
        await page.waitForLoadState('domcontentloaded')
      }
      await healthy(page, `${href} primary ${target}`)
    }
    await page.screenshot({ path: path.join(SHOTS, `${view}-${slug(href)}.png`), fullPage: false })
    await page.goto(home)
    await expect(page.getByTestId('desk-nav')).toBeVisible()
  }
  expect(errors, errors.join('\n')).toEqual([])
}

test.describe('desk nav and primary buttons', () => {
  test.setTimeout(600_000)
  for (const view of VIEWS) {
    test(`master desk at ${view.width}x${view.height}`, async ({ page }) => {
      await page.setViewportSize({ width: view.width, height: view.height })
      await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
      await walk(page, '/master', `master-${view.name}`)
    })

    test(`portal desk at ${view.width}x${view.height}`, async ({ page }) => {
      await page.setViewportSize({ width: view.width, height: view.height })
      await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin')
      await walk(page, '/p/east-london/admin', `portal-${view.name}`)
    })
  }

  test('live sessions are dark type on the cream page', async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true })
    await page.setViewportSize({ width: 1280, height: 800 })
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/live')
    await expect(page.getByTestId('master-live')).toBeVisible()
    const contrast = await page.getByTestId('desk-purpose').evaluate((el) => {
      const parse = (value: string) => value.match(/\d+/g)?.slice(0, 3).map(Number) || [0, 0, 0]
      const rel = (channel: number) => {
        const c = channel / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      }
      const lum = (rgb: number[]) => 0.2126 * rel(rgb[0]) + 0.7152 * rel(rgb[1]) + 0.0722 * rel(rgb[2])
      const color = parse(getComputedStyle(el).color)
      const main = el.closest('.main') as HTMLElement
      const background = parse(getComputedStyle(main).backgroundColor)
      const lighter = Math.max(lum(color), lum(background))
      const darker = Math.min(lum(color), lum(background))
      return (lighter + 0.05) / (darker + 0.05)
    })
    expect(contrast).toBeGreaterThan(4.5)
    await page.screenshot({ path: path.join(SHOTS, 'master-live-contrast.png'), fullPage: true })
  })
})
