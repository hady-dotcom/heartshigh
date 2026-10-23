import { expect, test, type Page } from '@playwright/test'

async function signInTeacher(page: Page) {
  await page.goto('/login')
  await page.getByTestId('login-email').fill('elm-teacher@hearts.test')
  await page.getByTestId('login-password').fill('portal-teacher')
  await page.getByTestId('login-submit').click()
  await page.waitForURL(/\/p\/east-london\/admin\/teach/, { timeout: 30_000 })
}

for (const size of [{ name: 'laptop', width: 1280, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  test(`a teacher can place a question in a talk (${size.name})`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height })
    await signInTeacher(page)
    await page.goto('/p/east-london/admin/content')
    await expect(page.getByTestId('admin-content')).toBeVisible()
    await expect(page.getByText('That page is for the portal admin')).toHaveCount(0)
    await expect(page.getByTestId('local-course-submit')).toHaveCount(0)
    await page.getByTestId('course-row').first().getByRole('link', { name: 'Add questions' }).click()
    await expect(page.getByTestId('admin-course')).toBeVisible()
    await expect(page.getByTestId('course-detail')).toHaveAttribute('data-locked', 'yes')
    const prompt = `Teacher question ${size.name} ${Date.now()}`
    await page.getByTestId('point-prompt').fill(prompt)
    await page.getByTestId('point-submit').click()
    await expect(page.getByText(prompt).first()).toBeVisible({ timeout: 30_000 })
    const wide = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(wide).toBeLessThanOrEqual(size.width + 1)
  })
}
