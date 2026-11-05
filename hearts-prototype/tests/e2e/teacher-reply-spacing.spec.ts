import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('a fresh reply keeps the time off the reply words', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin/teach')
  const card = page.getByTestId('workbook-review').filter({ hasText: 'Maryam' }).first()
  await expect(card).toBeVisible()
  const reply = `Quiet minute stays whole ${Date.now()}`
  await card.getByTestId('reply-text').fill(reply)
  await card.getByTestId('reply-submit').click()
  await expect(page.getByTestId('notice')).toContainText('Reply saved')

  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london/garden/workbook')
  const entry = page.getByTestId('workbook-entry').filter({ hasText: reply }).first()
  await expect(entry).toBeVisible()
  await entry.getByTestId('workbook-open').click()
  await expect(page.getByTestId('workbook-detail')).toBeVisible()
  const block = page.getByTestId('teacher-reply')
  await expect(block).toContainText('now')
  await expect(page.getByTestId('reply-body')).toHaveText(reply)
  await expect(page.getByTestId('reply-when')).toBeHidden()
  const placed = await block.evaluate((el) => {
    const heading = el.querySelector('b')
    const body = el.querySelector('[data-testid="reply-body"]')
    if (!heading || !body) return null
    const head = heading.getBoundingClientRect()
    const text = body.getBoundingClientRect()
    return { headBottom: head.bottom, textTop: text.top }
  })
  expect(placed).toBeTruthy()
  expect(placed!.textTop).toBeGreaterThan(placed!.headBottom - 1)
})
