import { expect, test } from '@playwright/test'
import { fakeYouTube } from './fake-youtube'

const BASE = '/p/east-london'
const PHONE = { width: 390, height: 844 }

test.use({
  video: { mode: 'on', size: PHONE },
  viewport: PHONE,
})

test('phone walk: buffet, schedule, My week, today, think, next part', async ({ page }) => {
  await fakeYouTube(page)
  await page.goto(`/login?next=${encodeURIComponent(`${BASE}/lanes`)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await expect(page.getByTestId('lesson-link').first()).toBeVisible()
  const href = await page.getByTestId('lesson-link').first().getAttribute('href')
  expect(href).toBeTruthy()
  await page.goto(href!)
  await expect(page.getByTestId('course-overview')).toBeVisible()
  await expect(page.getByTestId('buffet-talk').first()).toBeVisible()
  await page.getByTestId('schedule-all').click()
  await expect(page.getByTestId('plan')).toBeVisible()
  if (!(await page.getByTestId('weekday-1').isChecked())) await page.locator('label:has([data-testid=weekday-1])').click()
  await page.getByTestId('schedule-submit').click()
  await expect(page.getByTestId('schedule-plan').first()).toBeVisible()
  if (await page.getByTestId('week-open-today').count()) await page.getByTestId('week-open-today').click()
  else await page.getByTestId('schedule-slot').first().click()
  await expect(page.getByTestId('player')).toBeVisible()
  if (await page.getByTestId('timeline-dot').count()) {
    await page.getByTestId('timeline-dot').first().click()
    await expect(page.getByTestId('popup')).toBeVisible()
    await expect(page.getByTestId('paused-note')).toContainText('Paused')
    if (await page.getByTestId('think-about-this').count()) await page.getByTestId('think-about-this').click()
  }
  if (await page.getByTestId('up-next').count()) await page.getByTestId('up-next').click()
})
