import { expect, test } from '@playwright/test'
import { mkdirSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { seedCode } from '../env'

const dir = path.resolve(process.cwd(), 'proto-test/verify/legal/round2')

test.use({
  viewport: { width: 390, height: 844 },
  video: { mode: 'on', size: { width: 390, height: 844 } },
})

test.afterEach(async ({}, testInfo) => {
  const video = testInfo.attachments.find((row) => row.contentType?.includes('video') && row.path)
  if (video?.path) copyFileSync(video.path, path.join(dir, 'walk-join-consent-search.webm'))
})

test('phone walk: join, consent, search, tap the timestamp', async ({ page }) => {
  mkdirSync(dir, { recursive: true })
  const suffix = Date.now().toString().slice(-6)
  await page.goto(`/join?code=${seedCode('elm-learner')}`)
  await expect(page.getByTestId('join-consent')).toBeVisible()
  await page.getByTestId('join-name').fill('Walk Learner')
  await page.getByTestId('join-email').fill(`walk-${suffix}@hearts.test`)
  await page.getByTestId('join-password').fill('walk-pass-1')
  await page.getByTestId('join-consent').check()
  await page.getByTestId('join-submit').click()
  await expect(page.getByTestId('consent')).toBeVisible()
  await expect(page.getByTestId('consent-submit')).toBeDisabled()
  await page.getByTestId('age-18+').check()
  await page.getByTestId('consent-agree').check()
  await expect(page.getByTestId('consent-submit')).toBeEnabled()
  await page.getByTestId('consent-submit').click()
  await expect(page.getByTestId('welcome').or(page.getByTestId('splash')).or(page.getByTestId('home')).first()).toBeVisible()
  await page.goto('/p/east-london/search?q=salah')
  await expect(page.getByTestId('search-snippet').first()).toBeVisible()
  await page.getByTestId('search-hit').first().click()
  await expect(page).toHaveURL(/[?&]t=\d+/)
  await expect(page.getByTestId('course').or(page.getByTestId('player')).first()).toBeVisible()
})
