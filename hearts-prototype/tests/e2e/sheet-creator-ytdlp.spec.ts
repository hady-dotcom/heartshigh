import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page) {
  await page.goto('/login?next=%2Fmaster%2Fsheet%2Fcreate')
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function searchSelectAndBuild(page: Page, buildButton: string) {
  await expect(page.getByTestId('sheet-creator')).toBeVisible()
  await expect(page.getByTestId('desk-narrow')).toBeHidden()
  await expect(page.getByTestId('creator-min')).toHaveValue('300')
  await page.getByTestId('creator-topic').fill('patience')
  await page.getByTestId('creator-search').click()
  await expect(page.getByTestId('creator-candidate')).toHaveCount(2)
  await expect(page.getByTestId('creator-captions').filter({ hasText: 'Has captions' })).toHaveCount(1)
  await expect(page.getByTestId('creator-captions').filter({ hasText: 'No captions' })).toHaveCount(1)
  await expect(page.getByText('A ninety second clip')).toHaveCount(0)

  await page.getByTestId('creator-select-all').click()
  await expect(page.getByTestId('creator-ticked')).toHaveText('2 ticked')
  await expect(page.getByTestId('creator-queued')).toContainText('Patience in the evening')
  await expect(page.getByTestId('creator-queued')).toContainText('A talk with no captions')

  await page.getByTestId('creator-clear-all').click()
  await expect(page.getByTestId('creator-ticked')).toHaveText('0 ticked')
  await expect(page.getByTestId('creator-queued')).not.toContainText('Patience in the evening')

  await page.getByTestId('creator-paste').fill('https://vimeo.com/76979871')
  await expect(page.getByTestId('creator-queue-row').filter({ hasText: 'vimeo.com/76979871' })).toBeVisible()
  await page.getByTestId('creator-queue-row').filter({ hasText: 'vimeo.com/76979871' }).getByTestId('creator-remove').click()
  await expect(page.getByTestId('creator-paste')).toHaveValue('')

  await page.getByTestId('creator-select-all').click()
  await page.getByTestId(buildButton).click()
  await expect(page.getByTestId('creator-progress-row').first()).toContainText('Reading captions')
  await page.waitForURL(/\/master\/sheet\?preview=\d+/)
  await expect(page.getByTestId('sheet-preview')).toBeVisible()
  await expect(page.getByTestId('sheet-apply')).toBeVisible()
  await expect(page.getByTestId('sheet-warnings')).toContainText('No captions on this talk')
  await expect(page.getByTestId('sheet-changes')).toContainText('Patience in the evening')
  await expect(page.getByTestId('sheet-changes')).toContainText('A talk with no captions')
}

test('search, select all, and build a draft at 1280x800', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await signIn(page)
  await searchSelectAndBuild(page, 'creator-build-candidates')
})

test('search, select all, and build a draft at 390x844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  await searchSelectAndBuild(page, 'creator-build')
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
  expect(fits).toBeTruthy()
})
