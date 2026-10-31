import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('Straight away stays on one line in the Opens column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/content')
  await expect(page.getByTestId('admin-content')).toBeVisible()
  await page.getByTestId('course-row').first().getByRole('link', { name: /Edit|View/ }).click()
  await expect(page.getByTestId('admin-course')).toBeVisible()
  const cell = page.locator('[data-testid="point-row"] td', { hasText: /^Straight away$/ }).first()
  await expect(cell).toBeVisible()
  const linesOf = (el: HTMLElement) => {
    const style = getComputedStyle(el)
    const range = document.createRange()
    range.selectNodeContents(el)
    const font = parseFloat(style.fontSize) || 16
    const parsed = parseFloat(style.lineHeight)
    const linePx = Number.isFinite(parsed) ? parsed : font * 1.2
    return { whiteSpace: style.whiteSpace, text: (el.textContent || '').replace(/\s+/g, ' ').trim(), lines: range.getBoundingClientRect().height / linePx }
  }
  const wide = await cell.evaluate(linesOf)
  expect(wide.text).toBe('Straight away')
  expect(wide.whiteSpace).toBe('nowrap')
  expect(wide.lines).toBeLessThan(1.6)

  await page.setViewportSize({ width: 800, height: 900 })
  const narrow = await cell.evaluate(linesOf)
  expect(narrow.whiteSpace).toBe('nowrap')
  expect(narrow.lines).toBeLessThan(1.6)
})

test('Send keeps the teacher on that workbook answer', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 })
  await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin/teach')
  const cards = page.getByTestId('workbook-review')
  await expect(cards.first()).toBeVisible()
  const count = await cards.count()
  const target = cards.nth(count - 1)
  const id = await target.getAttribute('id')
  expect(id).toMatch(/^reply-\d+$/)
  await target.getByTestId('reply-text').fill(`Stay on this answer ${Date.now()}`)
  await target.getByTestId('reply-submit').click()
  await expect(page).toHaveURL(new RegExp(`#${id}$`))
  await expect(page.getByTestId('notice')).toContainText('Reply saved')
  const top = await page.locator(`#${id}`).evaluate((el) => el.getBoundingClientRect().top)
  expect(top).toBeGreaterThan(40)
  expect(top).toBeLessThan(160)
})
