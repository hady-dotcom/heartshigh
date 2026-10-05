import { expect, test } from '@playwright/test'
import { signIn } from './legal-helpers'

async function displayFontIsLoaded(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    await document.fonts.ready
    const spec = '600 32px "Cormorant Garamond"'
    if (document.fonts.check(spec)) return true
    await document.fonts.load(spec)
    return document.fonts.check(spec)
  })
}

test('L05 display font is loaded on opening, Home and a desk page', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => displayFontIsLoaded(page)).toBe(true)

  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await expect(page.getByTestId('home').or(page.getByTestId('welcome')).first()).toBeVisible()
  await expect.poll(() => displayFontIsLoaded(page)).toBe(true)

  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'leeds-admin@hearts.test', 'portal-admin', '/p/leeds/admin')
  await expect(page.getByTestId('admin-overview').or(page.locator('.desk')).first()).toBeVisible()
  await expect.poll(() => displayFontIsLoaded(page)).toBe(true)
})
