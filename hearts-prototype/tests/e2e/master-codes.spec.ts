import { expect, test, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'

async function signIn(page: Page) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: E2E_BASE })
  await page.goto('/login?next=/master/codes')
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('master-codes-page')).toBeVisible({ timeout: 30_000 })
  // Copy is a client button. Wait until it has hydrated before the first tap.
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="code-copy"]')
    return Boolean(button && Object.keys(button).some((key) => key.startsWith('__reactProps')))
  })
}

test('each code row has a join link with the code in it, and Copy writes that link', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page)
  const rows = page.getByTestId('master-code-row')
  const count = await rows.count()
  expect(count).toBeGreaterThan(0)
  const origin = new URL(page.url()).origin
  for (let index = 0; index < count; index++) {
    const row = rows.nth(index)
    const code = (await row.getByTestId('code-value').innerText()).trim()
    const share = (await row.getByTestId('share-url').innerText()).replace(/\s+/g, '')
    expect(share).toBe(`${origin}/join?code=${encodeURIComponent(code)}`)
    await expect(row.getByTestId('code-qr')).toHaveAttribute('data-value', share)
    await expect(row.getByTestId('share-whatsapp')).toHaveAttribute('href', `https://wa.me/?text=${encodeURIComponent(share)}`)
    await expect(row.getByTestId('change-pack')).toHaveAttribute('href', /\/p\/[^/]+\/admin\/access$/)
    await row.getByTestId('code-copy').click()
    await expect(row.getByTestId('code-copy')).toHaveText('Copied')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(share)
  }
})

test('the link to send wraps inside a phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  await expect(page.getByTestId('desk-narrow')).toBeHidden()
  const url = page.getByTestId('share-url').first()
  await expect(url).toBeVisible()
  const whiteSpace = await url.evaluate((el) => getComputedStyle(el).whiteSpace)
  expect(whiteSpace).not.toBe('nowrap')
  const box = (await url.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
  expect(overflow).toBe(true)
})
