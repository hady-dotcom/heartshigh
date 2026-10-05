import type { Page } from '@playwright/test'

/** Walk or skip Welcome → Intro so later steps can reach the opening or the desk. */
export async function skipWelcomeFilms(page: Page) {
  if (await page.getByTestId('welcome-begin').count()) {
    await page.getByTestId('welcome-begin').click()
  }
  for (let step = 0; step < 3; step += 1) {
    const skip = page.getByTestId('welcome-skip')
    if (!(await skip.count())) break
    await skip.click()
    await page.waitForTimeout(250)
  }
}
