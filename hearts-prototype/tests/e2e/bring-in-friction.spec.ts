import { expect, request as playwrightRequest, test } from '@playwright/test'
import { E2E_BASE } from '../env'

const PLAYLIST = 'https://www.youtube.com/playlist?list=PLheartsround2'
const TRANSCRIPT = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nA line from the fixture.\n'

async function signIn(page: import('@playwright/test').Page, next = '/master/bring-in') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('More options starts closed, give-holders is ticked, and Jibril is not doubled', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  await expect(page.getByTestId('bring-in')).toBeVisible()
  const more = page.getByTestId('bring-in-more')
  expect(await more.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false)
  await more.locator('summary').click()
  const option = page.getByTestId('bring-in-jibril').locator('option').nth(1)
  await expect(option).not.toHaveText(/W1 · W1/)
  await expect(option).toHaveText(/^W1 · /)
})

test('one paste and one tap brings a playlist in, and captions publish it for a learner', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login?next=/p/east-london/admin/bring-in')
  await page.getByTestId('login-email').fill('elm-admin@hearts.test')
  await page.getByTestId('login-password').fill('portal-admin')
  await page.getByTestId('login-submit').click()
  await page.waitForURL(/\/admin\/bring-in/)
  await expect(page.getByTestId('desk-narrow')).toBeHidden()
  await expect(page.getByTestId('bring-in')).toBeVisible()
  const primary = page.getByTestId('bring-in-publish-ready').first()
  await expect(primary).toBeVisible()
  const box = await primary.boundingBox()
  expect(box).toBeTruthy()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  await page.getByTestId('bring-in-urls').fill(PLAYLIST)
  for (let tap = 0; tap < 3; tap++) await primary.click({ trial: true })
  await primary.click()
  await expect(page.getByTestId('bring-in-result')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByTestId('bring-in-give')).toBeChecked()

  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const courses = await (await master.get('/api/courses?where[title][equals]=Round%20two%20sitting&limit=5&depth=0')).json()
  const course = courses.docs?.[0]
  expect(course?.title).toBe('Round two sitting')
  const lessons = await (await master.get(`/api/lessons?where[course][equals]=${course.id}&limit=20&depth=0`)).json()
  const waiting = (lessons.docs || []).filter((lesson: { transcriptNote?: string }) => String(lesson.transcriptNote || '').includes('Bring-in: waiting'))
  expect(waiting.length).toBeGreaterThan(0)
  for (const lesson of waiting) {
    const attached = await master.post('/api/hearts/awaiting-transcript', { data: { lesson: lesson.id, transcript: TRANSCRIPT } })
    expect(attached.ok()).toBeTruthy()
    const body = await attached.json()
    expect(body.publishState).toBe('published')
  }
  await master.dispose()

  await page.goto('/login?next=/p/east-london/lanes')
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('lanes')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('lanes')).toContainText('Round two sitting')
})
