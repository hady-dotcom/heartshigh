import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const OUT = '/tmp/plain-copy-shots'
const SIZES = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844 },
] as const

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('plain copy screenshots at desktop and phone', async ({ page }) => {
  mkdirSync(OUT, { recursive: true })
  const learnerTips: [string, string][] = [
    ['/p/east-london', 'home'],
    ['/p/east-london/garden', 'garden'],
    ['/p/east-london/me', 'me'],
  ]

  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height })
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/ai')
    await expect(page.locator('[data-testid="ai-registry"]:visible, [data-testid="desk-narrow"]:visible')).toHaveCount(1)
    await page.screenshot({ path: path.join(OUT, `ai-list-${size.name}.png`), fullPage: true })

    await page.goto('/master/ai/quran-harvest')
    await expect(page.locator('[data-testid="ai-step-page"]:visible, [data-testid="desk-narrow"]:visible')).toHaveCount(1)
    if (await page.getByTestId('ai-what').isVisible().catch(() => false)) {
      await expect(page.getByTestId('ai-what')).toContainText('What this does')
      await expect(page.getByTestId('ai-what')).toContainText('exact words')
      await expect(page.getByTestId('ai-for-techies')).toBeVisible()
    }
    await page.screenshot({ path: path.join(OUT, `quran-harvest-${size.name}.png`), fullPage: true })

    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
    for (const [href, name] of learnerTips) {
      await page.goto(href)
      await expect(page.getByTestId('page-help-open')).toBeVisible()
      await page.getByTestId('page-help-open').click()
      await expect(page.getByTestId('page-help-sheet')).toBeVisible()
      await page.screenshot({ path: path.join(OUT, `help-${name}-${size.name}.png`) })
      await page.getByTestId('page-help-close').click()
      await expect(page.getByTestId('page-help-sheet')).toHaveCount(0)
    }
  }
})
