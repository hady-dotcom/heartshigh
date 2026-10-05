import { expect, test } from '@playwright/test'
import { seedCode } from '../env'
import { joinWithConsent, signIn } from './legal-helpers'

const suffix = Date.now().toString().slice(-6)

test('L04 under-13 waits for a grown-up and shows the guardian link in e2e', async ({ page }) => {
  const email = `child-${suffix}@hearts.test`
  await joinWithConsent(page, seedCode('elm-learner'), 'Young Learner', email, 'child-pass-1', 'under-13')
  await expect(page.getByTestId('guardian-form')).toBeVisible()
  await page.getByTestId('guardian-email').fill(`parent-${suffix}@hearts.test`)
  await page.getByTestId('guardian-send').click()
  await expect(page.getByTestId('guardian-link')).toBeVisible()
  const href = await page.getByTestId('guardian-link').locator('a').getAttribute('href')
  expect(href).toContain('/guardian?token=')
  await page.goto(href!)
  await expect(page.getByTestId('guardian')).toBeVisible()
  await page.getByTestId('guardian-agree').check()
  await page.getByTestId('guardian-submit').click()
  await expect(page.getByTestId('guardian-done')).toBeVisible()
})

test('L04 school-offline path: staff can tick a child', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'leeds-admin@hearts.test', 'portal-admin', '/p/leeds/admin/children')
  await expect(page.getByTestId('admin-children')).toBeVisible()
  await page.getByTestId('school-offline').check()
  await page.getByTestId('save-children').click()
  await expect(page.getByTestId('notice')).toContainText(/saved|Children/i)
})
