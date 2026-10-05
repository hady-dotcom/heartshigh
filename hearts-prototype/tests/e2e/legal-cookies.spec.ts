import { expect, test } from '@playwright/test'

test('L05 privacy page lists cookies and storage and does not load Google Fonts', async ({ page }) => {
  const fonts: string[] = []
  page.on('request', (req) => {
    if (/fonts\.googleapis|fonts\.gstatic/.test(req.url())) fonts.push(req.url())
  })
  await page.goto('/privacy')
  await expect(page.getByTestId('legal-body')).toContainText('Cookies and storage')
  await expect(page.getByTestId('legal-body')).toContainText('hearts.heart.v1')
  await expect(page.getByTestId('legal-body')).toContainText('Turnstile')
  await expect(page.getByTestId('legal-body')).toContainText('YouTube')
  expect(fonts, 'Google Fonts should not load').toEqual([])
})
